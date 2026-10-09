const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const jwt = require('jsonwebtoken');

const JWT_SECRET = 'test-only-secret-that-is-long-enough-32';
process.env.JWT_SECRET = JWT_SECRET;
process.env.ADMIN_USERNAME = 'security-test-admin';
process.env.ADMIN_PASSWORD = 'security-test-password';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:test@127.0.0.1:1/neighborhub';

const app = require('../src/app');
const schedulerService = require('../src/services/schedulerService');
const { getJwtSecret, getAdminCredentials, signToken } = require('../src/config/authConfig');
const { collectUserUpdate } = require('../src/services/userServices');
const { buildReportCreateData, buildReportUpdateData } = require('../src/services/reportServices');

let server;
let base;

before(async () => {
  server = app.listen(0);
  const address = server.address();
  base = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  schedulerService.stop();
  if (server) {
    await new Promise((resolve) => server.close(resolve));
  }
});

function sign(payload, options = {}) {
  return jwt.sign(payload, JWT_SECRET, { algorithm: 'HS256', ...options });
}

async function send(method, route, { token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${base}${route}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  return response;
}

test('server refuses a missing or published JWT secret', () => {
  for (const secret of ['', 'short-secret', 'your-super-secret-jwt-key-here', 'your_long_secure_jwt_secret_key_here']) {
    const result = spawnSync(process.execPath, ['src/server.js'], {
      cwd: path.join(__dirname, '..'),
      env: { ...process.env, JWT_SECRET: secret, PORT: '0' },
      encoding: 'utf8',
      timeout: 8000,
    });
    assert.equal(result.status, 1, `expected startup to fail for ${JSON.stringify(secret)}`);
    assert.match(result.stderr, /Refusing to start/);
    if (secret) {
      assert.equal(result.stdout.includes(secret), false);
      assert.equal(result.stderr.includes(secret), false);
    }
  }
});

test('published admin credentials are rejected', () => {
  const previousUser = process.env.ADMIN_USERNAME;
  const previousPassword = process.env.ADMIN_PASSWORD;
  try {
    process.env.ADMIN_USERNAME = 'admin-account';
    process.env.ADMIN_PASSWORD = 'security-test-password';
    assert.equal(getAdminCredentials(), null);
    process.env.ADMIN_USERNAME = 'security-test-admin';
    process.env.ADMIN_PASSWORD = 'admin123';
    assert.equal(getAdminCredentials(), null);
  } finally {
    process.env.ADMIN_USERNAME = previousUser;
    process.env.ADMIN_PASSWORD = previousPassword;
  }
  assert.deepEqual(
    { username: getAdminCredentials().username },
    { username: 'security-test-admin' }
  );
});

test('login tokens include an expiry and unsigned or non-expiring tokens are rejected', async () => {
  const issued = signToken({ userId: 'user-1' }, '7d');
  const decoded = jwt.verify(issued, JWT_SECRET, { algorithms: ['HS256'] });
  assert.ok(decoded.exp - decoded.iat >= 7 * 24 * 60 * 60 - 5);

  const neverExpires = sign({ userId: 'admin', role: 'admin' });
  const hs384 = sign({ userId: 'admin', role: 'admin', exp: Math.floor(Date.now() / 1000) + 60 }, { algorithm: 'HS384' });
  const expired = sign({ userId: 'admin', role: 'admin', exp: 1 });
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify({ userId: 'admin', role: 'admin' })).toString('base64url');
  const noneToken = `${header}.${payload}.`;

  for (const token of [neverExpires, hs384, expired, noneToken, 'not-a-token']) {
    const response = await send('GET', '/api/users', { token });
    assert.equal(response.status, 401);
  }
});

test('admin login accepts only the configured account', async () => {
  const leaked = await send('POST', '/api/auth/admin/login', {
    body: { username: 'admin-account', password: 'admin123' },
  });
  assert.equal(leaked.status, 400);

  const ok = await send('POST', '/api/auth/admin/login', {
    body: { username: 'security-test-admin', password: 'security-test-password' },
  });
  assert.equal(ok.status, 200);
  const body = await ok.json();
  const decoded = jwt.verify(body.token, getJwtSecret(), { algorithms: ['HS256'] });
  assert.equal(decoded.role, 'admin');
  assert.equal(typeof decoded.exp, 'number');
});

test('user records and admin actions require the right caller', async () => {
  const member = sign({ userId: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 });
  const admin = sign({ userId: 'admin', role: 'admin', exp: Math.floor(Date.now() / 1000) + 3600 });

  assert.equal((await send('GET', '/api/users')).status, 401);
  assert.equal((await send('GET', '/api/users/user-2', { token: member })).status, 403);
  assert.equal((await send('PUT', '/api/users/user-2', { token: member, body: { username: 'taken' } })).status, 403);
  assert.equal((await send('DELETE', '/api/users/user-1', { token: member })).status, 403);
  assert.equal((await send('POST', '/api/announcements', { token: member, body: { title: 't', description: 'd' } })).status, 403);
  assert.equal((await send('POST', '/api/admin/cleanup/force', { token: member })).status, 403);
  assert.equal((await send('PUT', '/api/reports/some-id', { token: member, body: { status: 'CLOSED' } })).status, 403);
  assert.equal((await send('GET', '/api/reports/pdf/all', { token: member })).status, 403);

  const ownProfile = await send('GET', '/api/users/user-1', { token: member });
  assert.equal(ownProfile.status === 401 || ownProfile.status === 403, false);

  const directory = await send('GET', '/api/users', { token: admin });
  assert.equal(directory.status === 401 || directory.status === 403, false);
});

test('emergency report reads require a logged-in caller and creates cannot set status', async () => {
  assert.equal((await send('GET', '/api/reports')).status, 401);
  assert.equal((await send('GET', '/api/reports/heatmap/data')).status, 401);

  const member = sign({ userId: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 });
  const heatmap = await send('GET', '/api/reports/heatmap/data?neLat=1&neLng=1&swLat=0&swLng=0', { token: member });
  assert.equal(heatmap.status === 401 || heatmap.status === 403, false);

  const created = buildReportCreateData({
    title: 'Fire',
    description: 'Smoke',
    latitude: 1,
    longitude: 2,
    status: 'CLOSED',
    id: 'attacker',
    resetToken: 'x',
  });
  assert.equal(created.status, 'OPEN');
  assert.equal(created.title, 'Fire');
  assert.equal(Object.hasOwn(created, 'id'), false);
  assert.equal(Object.hasOwn(created, 'resetToken'), false);

  const updated = buildReportUpdateData({ status: 'RESOLVED', title: 'Updated', password: 'nope' });
  assert.equal(updated.status, 'RESOLVED');
  assert.equal(updated.title, 'Updated');
  assert.equal(Object.hasOwn(updated, 'password'), false);
});

test('user updates cannot assign reset tokens or other private columns', () => {
  const update = collectUserUpdate({
    username: 'ada',
    password: 'new-password',
    resetToken: 'known-token',
    resetTokenExpiry: new Date().toISOString(),
    id: 'other-user',
    role: 'admin',
  });
  assert.equal(update.username, 'ada');
  assert.equal(update.password, 'new-password');
  assert.equal(Object.hasOwn(update, 'resetToken'), false);
  assert.equal(Object.hasOwn(update, 'resetTokenExpiry'), false);
  assert.equal(Object.hasOwn(update, 'id'), false);
  assert.equal(Object.hasOwn(update, 'role'), false);

  const cleared = collectUserUpdate({ password: null, resetToken: 'x' });
  assert.equal(Object.hasOwn(cleared, 'password'), false);
  assert.equal(Object.hasOwn(cleared, 'resetToken'), false);
});

test('committed runtime config and auth code do not keep the old admin password or JWT secret', () => {
  const root = path.join(__dirname, '..');
  const compose = fs.readFileSync(path.join(root, 'docker-compose.yml'), 'utf8');
  const routes = fs.readFileSync(path.join(root, 'src/routes/authRoutes.js'), 'utf8');
  const middleware = fs.readFileSync(path.join(root, 'src/middlewares/authMiddleware.js'), 'utf8');
  assert.equal(compose.includes('your-super-secret-jwt-key-here'), false);
  assert.equal(compose.includes('POSTGRES_PASSWORD=password'), false);
  assert.equal(compose.includes('admin123'), false);
  assert.equal(routes.includes('admin123'), false);
  assert.equal(routes.includes('admin-account'), false);
  assert.equal(middleware.includes('console.'), false);
});

test('community events and announcements stay publicly readable', async () => {
  const events = await send('GET', '/api/events');
  const announcements = await send('GET', '/api/announcements');
  assert.notEqual(events.status, 401);
  assert.notEqual(announcements.status, 401);
});
