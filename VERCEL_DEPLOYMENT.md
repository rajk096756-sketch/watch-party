# Vercel Deployment Guide

## Prerequisites

- Backend server deployed (Railway, Render, DigitalOcean, etc.)
- Backend server URL (e.g., https://your-server.com)
- Backend server configured with your Vercel domain in CORS

## Client Deployment (Vercel)

### 1. Set Environment Variables in Vercel

Go to your Vercel project settings → Environment Variables and add:

```
VITE_API_URL=https://your-server-domain.com/api
```

**Important:** Replace `your-server-domain.com` with your actual backend server URL.

### 2. Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

Or connect your GitHub repository to Vercel for automatic deployments.

## Server Configuration

### 1. Update Server CORS

In your server `.env` file, add your Vercel domain:

```bash
CLIENT_URL=https://your-vercel-app.vercel.app
```

### 2. Restart Server

After updating the `.env` file, restart your server for changes to take effect.

## Common Issues & Solutions

### Issue: "Network Error" or "Failed to fetch"

**Cause:** Client is trying to connect to localhost instead of production server.

**Solution:**
1. Set `VITE_API_URL` environment variable in Vercel
2. Redeploy the Vercel application
3. Verify the URL is correct (should be your server URL, not localhost)

### Issue: "CORS Error" or "Not allowed by CORS"

**Cause:** Server doesn't recognize your Vercel domain.

**Solution:**
1. Add your Vercel domain to server's `CLIENT_URL` environment variable
2. Restart the server
3. Verify the domain matches exactly (including https://)

### Issue: Socket Connection Failed

**Cause:** Socket.io trying to connect to wrong URL.

**Solution:**
The socket connection now uses the same `VITE_API_URL` (with `/api` removed). Ensure this is set correctly.

## Testing Checklist

- [ ] `VITE_API_URL` set in Vercel environment variables
- [ ] `CLIENT_URL` set in server environment variables
- [ ] Server restarted after CORS changes
- [ ] Vercel app redeployed after environment variable changes
- [ ] Test signup/login on deployed Vercel URL
- [ ] Test video playback
- [ ] Test watch party functionality
- [ ] Test comments

## Example Configuration

**Vercel Environment Variables:**
```
VITE_API_URL=https://api.watchparty.example.com/api
```

**Server Environment Variables:**
```
CLIENT_URL=https://watchparty.vercel.app
```

**Server CORS Configuration:**
The server will now automatically accept requests from:
- localhost:5173 (development)
- localhost:5174 (development)
- Your Vercel domain (production)
