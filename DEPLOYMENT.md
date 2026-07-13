# Production Deployment Guide

## Prerequisites

- Node.js 18+ installed
- PostgreSQL database (recommended for production)
- Domain name with SSL certificate
- Cloud hosting (VPS, AWS, DigitalOcean, etc.)

## Environment Configuration

### 1. Set up Production Environment Variables

Create `.env.production` in the server directory:

```bash
PORT=5000
DATABASE_URL="postgresql://user:password@localhost:5432/watchparty"
JWT_SECRET="your-super-secure-random-secret-minimum-32-characters"
NODE_ENV=production

# SMTP Configuration (Required for production)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-16-digit-app-password

# Twilio SMS Configuration (Optional but recommended)
TWILIO_ACCOUNT_SID=your_account_sid
TWILIO_AUTH_TOKEN=your_auth_token
TWILIO_PHONE_NUMBER=+1234567890

# Razorpay API Credentials (Required for payments)
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret

# Geo-IP Service Configuration (Optional)
GEOIP_API_KEY=your_ipapi_co_key
GEOIP_SERVICE=ipapi
```

### 2. Generate Secure Secrets

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## Database Setup

### 1. Install PostgreSQL

```bash
# Ubuntu/Debian
sudo apt-get install postgresql postgresql-contrib

# macOS
brew install postgresql
```

### 2. Create Database

```bash
sudo -u postgres psql
CREATE DATABASE watchparty;
CREATE USER watchparty_user WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE watchparty TO watchparty_user;
\q
```

### 3. Update DATABASE_URL

```bash
DATABASE_URL="postgresql://watchparty_user:secure_password@localhost:5432/watchparty"
```

### 4. Run Migrations

```bash
cd server
npm run prisma:generate
npm run prisma:migrate
```

## SSL/HTTPS Setup

### Option 1: Using Let's Encrypt (Free)

```bash
# Install Certbot
sudo apt-get install certbot python3-certbot-nginx

# Generate SSL Certificate
sudo certbot --nginx -d yourdomain.com

# Auto-renewal is configured automatically
```

### Option 2: Using Cloudflare (Recommended)

1. Sign up for Cloudflare
2. Add your domain
3. Change nameservers to Cloudflare
4. Enable "Always Use HTTPS" in Cloudflare dashboard
5. Set SSL/TLS mode to "Full"

### Option 3: Self-signed Certificate (Development Only)

```bash
openssl req -nodes -new -x509 -keyout server.key -out server.cert
```

## Building for Production

### 1. Build Client

```bash
cd client
npm run build
```

### 2. Update Server to Serve Static Files

In `server/src/index.js`, add:

```javascript
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static files from client build
app.use(express.static(path.join(__dirname, '../../client/dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../client/dist/index.html'));
});
```

## Process Management

### Using PM2 (Recommended)

```bash
# Install PM2 globally
npm install -g pm2

# Start application
pm2 start npm --name "watch-party-server" -- run start --prefix server

# Save PM2 configuration
pm2 save

# Setup startup script
pm2 startup
```

### Using systemd

Create `/etc/systemd/system/watchparty.service`:

```ini
[Unit]
Description=Watch Party Server
After=network.target

[Service]
Type=simple
User=www-data
WorkingDirectory=/path/to/Watch-party-app/server
ExecStart=/usr/bin/node src/index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable watchparty
sudo systemctl start watchparty
```

## Nginx Reverse Proxy (Recommended)

### Install Nginx

```bash
sudo apt-get install nginx
```

### Configure Nginx

Create `/etc/nginx/sites-available/watchparty`:

```nginx
server {
    listen 80;
    server_name yourdomain.com;

    # Redirect to HTTPS
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name yourdomain.com;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # Security Headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Proxy to Node.js server
    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/watchparty /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## Firewall Configuration

```bash
# Allow SSH
sudo ufw allow 22/tcp

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable firewall
sudo ufw enable
```

## Monitoring & Logging

### 1. Application Logs

```bash
# Using PM2
pm2 logs watch-party-server

# Using systemd
sudo journalctl -u watchparty -f
```

### 2. Error Tracking

Consider integrating with:
- Sentry (error tracking)
- LogRocket (session replay)
- New Relic (APM)

## Security Checklist

- [ ] Change all default passwords
- [ ] Use strong JWT_SECRET (minimum 32 characters)
- [ ] Enable HTTPS with valid SSL certificate
- [ ] Configure firewall rules
- [ ] Set up automatic security updates
- [ ] Enable rate limiting
- [ ] Configure CORS for production domain
- [ ] Set up database backups
- [ ] Monitor logs for suspicious activity
- [ ] Keep dependencies updated

## Backup Strategy

### Database Backups

```bash
# Create backup script
#!/bin/bash
pg_dump -U watchparty_user watchparty > backup_$(date +%Y%m%d_%H%M%S).sql

# Add to crontab for daily backups
0 2 * * * /path/to/backup-script.sh
```

### File Backups

```bash
# Backup uploads and invoices
tar -czf backups/uploads_$(date +%Y%m%d).tar.gz server/secure_uploads server/invoices
```

## Scaling Considerations

1. **Database**: Use managed PostgreSQL (AWS RDS, DigitalOcean Managed DB)
2. **Static Files**: Use CDN (Cloudflare, AWS CloudFront)
3. **Session Storage**: Use Redis for distributed sessions
4. **Load Balancing**: Use Nginx load balancer or cloud load balancer
5. **Caching**: Implement Redis caching for frequently accessed data

## Troubleshooting

### Server won't start
- Check if port 5000 is available: `netstat -tulpn | grep 5000`
- Check logs: `pm2 logs` or `journalctl -u watchparty`
- Verify environment variables are set

### Database connection failed
- Verify DATABASE_URL is correct
- Check PostgreSQL is running: `sudo systemctl status postgresql`
- Test connection: `psql -U watchparty_user -d watchparty`

### WebSocket connection issues
- Verify Nginx WebSocket configuration
- Check firewall allows WebSocket connections
- Ensure Socket.io CORS settings match production domain

## Support

For issues or questions:
- Check server logs first
- Review Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
- Review application logs: `pm2 logs watch-party-server`
