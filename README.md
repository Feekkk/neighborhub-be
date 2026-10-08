# Backend Project Structure

This directory contains the backend codebase for the NeighborHub application, which provides API endpoints for a Flutter frontend. The structure is designed for scalability, maintainability, and clarity.

## Tech Stack
- **Node.js** with **Express** for the server and API
- **PostgreSQL** as the database
- **Prisma** as the ORM
- **JWT** and **bcrypt** for authentication and password hashing

## Folder Structure

- `src/` - Main source code for the backend
  - `controllers/` - Route handlers and controllers for API endpoints
  - `models/` - Data models and schemas
  - `routes/` - API route definitions
  - `services/` - Business logic and service layer
  - `middlewares/` - Custom middleware functions
  - `utils/` - Utility functions and helpers
  - `config/` - Configuration files (env, database, etc.)
  - `jobs/` - Background jobs, schedulers, or workers (optional)
  - `repositories/` - Data access layer (optional, for complex apps)
- `prisma/` - Prisma schema and migration files
  - `schema.prisma` - Main Prisma schema file
- `.env` - Environment variables (not committed)
- `package.json` - Node.js dependencies and scripts
- `tests/` - Automated tests (unit, integration, etc.)
- `scripts/` - Utility scripts for setup, migration, etc.
- `public/` - Static files (if needed)

> Next, you can start building your Express app in `src/`, define your Prisma models in `prisma/schema.prisma`, and configure your database in `.env`.

---

# 🚀 DigitalOcean Deployment Guide

Complete step-by-step guide to deploy NeighborHub Backend to DigitalOcean Droplet.

## Prerequisites

- DigitalOcean account
- GitHub repository with your backend code
- Basic SSH knowledge
- Gmail account (for email functionality)

---

## 📋 Step 1: Create DigitalOcean Droplet

1. **Login to DigitalOcean** and click "Create" → "Droplets"
2. **Choose Configuration**:
   - **Image**: Ubuntu 22.04 LTS
   - **Size**: Basic $6/month (1 GB RAM, 1 vCPU)
   - **Region**: Choose closest to your users
   - **Add SSH Key**: Upload your SSH public key for secure access
3. **Create Droplet** and note the IP address

---

## 🔧 Step 2: Initial Server Setup

**Connect to your droplet from your local machine:**

```bash
# Connect via SSH (replace with your droplet IP)
ssh root@your_droplet_ip
```

**Update system and install required software:**

```bash
# Update system packages
apt update && apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
apt-get install -y nodejs

# Install PostgreSQL
apt install postgresql postgresql-contrib -y

# Install PM2 for process management
npm install -g pm2

# Install Nginx reverse proxy
apt install nginx -y

# Install Git
apt install git -y
```

---

## 🗄️ Step 3: Database Setup

**Create PostgreSQL database and user:**

```bash
# Switch to postgres user
sudo -u postgres psql

# Create database and user (replace 'your_secure_password' with strong password)
CREATE DATABASE neighborhub;
CREATE USER neighborhub_user WITH PASSWORD 'your_secure_password';
ALTER USER neighborhub_user CREATEDB;
GRANT ALL PRIVILEGES ON DATABASE neighborhub TO neighborhub_user;
ALTER DATABASE neighborhub OWNER TO neighborhub_user;

# Exit PostgreSQL
\q
```

---

## 📥 Step 4: Deploy Application Code

**Clone your repository:**

```bash
# Clone your GitHub repository (replace with your repo URL)
git clone https://github.com/yourusername/neighborhub-backend.git
cd neighborhub-backend

# If your backend is in a subdirectory, navigate to it
# cd backend (if applicable)

# Install dependencies
npm ci
```

---

## ⚙️ Step 5: Configure Environment Variables

**Create production .env file:**

```bash
# Create .env file
nano .env
```

**Add the following configuration (replace placeholders with actual values):**

```env
# Database Configuration
DATABASE_URL="postgresql://neighborhub_user:your_secure_password@localhost:5432/neighborhub"
POSTGRES_PASSWORD="your_secure_password"

# JWT secret. Generate one; do not reuse a published example.
#   openssl rand -base64 48
JWT_SECRET="<paste the generated value>"

# Admin login (POST /api/auth/admin/login). Password must be at least 12 characters.
# Do not use admin-account / admin123.
ADMIN_USERNAME="<new admin username>"
ADMIN_PASSWORD="<long random password>"

# Server Port
PORT=3000

# Email Configuration (use Gmail App Password)
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your-gmail-app-password

# Frontend URL (your droplet IP)
FRONTEND_URL=http://your_droplet_ip
```

The process exits on startup if `JWT_SECRET` is missing, shorter than 32 characters, or one of the old published examples. Login tokens expire after 7 days. Tokens that were issued without an expiry are rejected.

**Save and exit nano:** `Ctrl + X`, then `Y`, then `Enter`

### 📧 Setting up Gmail App Password

1. **Enable 2-Factor Authentication** on your Gmail account
2. **Go to**: Google Account → Security → 2-Step Verification → App passwords
3. **Generate App Password** for "Mail"
4. **Use the 16-character password** in your .env file

---

## 🗃️ Step 6: Setup Database Schema

**Run Prisma migrations and seed data:**

```bash
# Generate Prisma client
npx prisma generate

# Apply database migrations
npx prisma migrate deploy

# Seed database with initial data (if you have seed file)
npx prisma db seed
```

---

## 🚀 Step 7: Start Application with PM2

**Start your application as a background service:**

```bash
# Start app with PM2 (adjust path if needed)
pm2 start src/server.js --name "neighborhub-backend"

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup

# Follow the command PM2 provides (usually something like):
# sudo env PATH=$PATH:/usr/bin /usr/lib/node_modules/pm2/bin/pm2 startup systemd -u root --hp /root

# Check if app is running
pm2 status
pm2 logs neighborhub-backend
```

---

## 🌐 Step 8: Configure Nginx Reverse Proxy

**Create Nginx configuration:**

```bash
# Create Nginx site configuration
nano /etc/nginx/sites-available/neighborhub
```

**Add this configuration (replace `your_droplet_ip` with actual IP):**

```nginx
server {
    listen 80;
    server_name your_droplet_ip;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

**Enable the site:**

```bash
# Enable site
ln -s /etc/nginx/sites-available/neighborhub /etc/nginx/sites-enabled/

# Remove default Nginx site
rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

---

## ✅ Step 9: Test Deployment

**Test your API endpoints:**

```bash
# Test basic API
curl http://localhost:3000
curl http://your_droplet_ip

# Test specific endpoints
curl http://your_droplet_ip/api/events
curl http://your_droplet_ip/api/announcements
curl -H "Authorization: Bearer <admin-token>" http://your_droplet_ip/api/users
```

**Check PM2 status:**

```bash
pm2 status
pm2 logs neighborhub-backend
```

---

## 🔒 Step 10: Security Setup (Optional but Recommended)

**Setup SSL Certificate with Let's Encrypt:**

```bash
# Install Certbot
apt install certbot python3-certbot-nginx -y

# Get SSL certificate (if you have a domain)
certbot --nginx -d yourdomain.com

# For IP-only setup, you can skip SSL or use self-signed certificates
```

**Setup Basic Firewall:**

```bash
# Enable UFW firewall
ufw enable

# Allow SSH, HTTP, and HTTPS
ufw allow ssh
ufw allow 80
ufw allow 443

# Check firewall status
ufw status
```

---

## 📱 Step 11: Update Flutter App

**Update your Flutter app's API base URL:**

```dart
// In your Flutter app configuration
const String baseUrl = 'http://your_droplet_ip';

// Your API endpoints will be:
// http://your_droplet_ip/api/events
// http://your_droplet_ip/api/auth/login
// http://your_droplet_ip/api/announcements
// etc.
```

---

## 🛠️ Management Commands

**PM2 Process Management:**

```bash
# Check app status
pm2 status

# View logs
pm2 logs neighborhub-backend

# Restart app
pm2 restart neighborhub-backend

# Stop app
pm2 stop neighborhub-backend

# Monitor resources
pm2 monit
```

**Application Updates:**

```bash
# Pull latest code
git pull origin main

# Restart app with new code
pm2 restart neighborhub-backend

# Check logs for any issues
pm2 logs neighborhub-backend
```

**Database Management:**

```bash
# Connect to database
sudo -u postgres psql neighborhub

# Run new migrations (if any)
npx prisma migrate deploy

# Generate Prisma client after schema changes
npx prisma generate
```

---

## 🔍 Troubleshooting

**Common Issues and Solutions:**

**1. Permission denied for schema public**
```bash
sudo -u postgres psql
\c neighborhub
GRANT ALL ON SCHEMA public TO neighborhub_user;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO neighborhub_user;
\q
```

**2. App not starting**
```bash
# Check logs
pm2 logs neighborhub-backend

# Check if port 3000 is available
netstat -tulpn | grep 3000

# Try running directly to see errors
node src/server.js
```

**3. Nginx 404 errors**
```bash
# Check Nginx error logs
tail -f /var/log/nginx/error.log

# Test Nginx configuration
nginx -t

# Make sure your app is running on port 3000
curl http://localhost:3000
```

**4. Database connection issues**
```bash
# Check PostgreSQL status
systemctl status postgresql

# Test database connection
sudo -u postgres psql neighborhub
```

---

## 🎉 Success!

Your NeighborHub backend is now successfully deployed and running 24/7 on DigitalOcean!

**Your API is accessible at:** `http://your_droplet_ip`

**Key Features:**
- ✅ Always running with PM2
- ✅ Auto-restart on crashes
- ✅ Starts automatically on server reboot
- ✅ Professional Nginx reverse proxy
- ✅ PostgreSQL database
- ✅ Secure environment configuration

---

## 📞 Support

If you encounter any issues during deployment:

1. Check PM2 logs: `pm2 logs neighborhub-backend`
2. Check Nginx logs: `tail -f /var/log/nginx/error.log`
3. Test individual components: database, app, nginx
4. Verify firewall settings and port availability

**Remember to:**
- Keep your `.env` file secure and never commit it to Git
- Regularly backup your database
- Update your system packages periodically
- Monitor your droplet's resource usage