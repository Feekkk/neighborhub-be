try {
  require('dotenv').config();
} catch (err) {
  if (err.code !== 'MODULE_NOT_FOUND') {
    throw err;
  }
}

const { getJwtSecret } = require('./config/authConfig');

try {
  getJwtSecret();
} catch {
  console.error('Refusing to start: set JWT_SECRET to a unique random string of at least 32 characters.');
  process.exit(1);
}

const app = require('./app');
const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
