# Vercel Deployment Fix Instructions

## CRITICAL: You Need a Backend Server

Your Vercel deployment is failing because **you only deployed the frontend**. The Watch Party app requires a backend server to handle:
- Authentication (login/signup)
- Database operations
- WebSocket connections for watch party sync
- API endpoints

## Step 1: Deploy Your Backend Server

You must deploy your backend server to a hosting service. Options:

### Option A: Railway (Recommended - Free tier available)
1. Go to https://railway.app
2. Connect your GitHub repository
3. Select the `server` folder as root directory
4. Add environment variables (see below)
5. Deploy

### Option B: Render (Free tier available)
1. Go to https://render.com
2. Create a new Web Service
3. Connect your GitHub repository
4. Set root directory to `server`
5. Add environment variables
6. Deploy

### Option C: DigitalOcean / AWS / Other
Deploy using the DEPLOYMENT.md guide

## Step 2: Add Environment Variables to Your Backend Server

After deploying your backend, add these environment variables to your hosting platform:

```bash
PORT=5000
DATABASE_URL="your_postgresql_database_url"
JWT_SECRET="your_generated_secret"
NODE_ENV=production

# SMTP (required for OTP emails)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password

# Optional: Twilio for SMS OTP
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890

# Optional: Razorpay for payments
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret

# IMPORTANT: Your Vercel domain
CLIENT_URL=https://watch-party-nu-one.vercel.app
```

## Step 3: Add Environment Variables to Vercel

Go to your Vercel project dashboard:

1. Navigate to: **Settings → Environment Variables**
2. Add this **ONE** environment variable:

```
Variable Name: VITE_API_URL
Value: https://YOUR-BACKEND-DOMAIN.com/api
```

**Replace `YOUR-BACKEND-DOMAIN.com` with your actual backend server URL from Step 1.**

### Example:
If your backend is deployed to Railway at `watch-party-api.railway.app`, then:
```
VITE_API_URL=https://watch-party-api.railway.app/api
```

## Step 4: Redeploy Vercel

After adding the environment variable:
1. Go to **Deployments** in Vercel
2. Click **Redeploy** on your latest deployment
3. Wait for redeployment to complete

## Step 5: Restart Your Backend Server

After updating the `CLIENT_URL` in your backend environment variables:
1. Go to your backend hosting platform (Railway/Render/etc.)
2. Restart/redeploy the backend server
3. This ensures the CORS configuration picks up your Vercel domain

## Verification Checklist

- [ ] Backend server deployed and running
- [ ] Backend has `CLIENT_URL=https://watch-party-nu-one.vercel.app`
- [ ] Vercel has `VITE_API_URL=https://your-backend-domain.com/api`
- [ ] Vercel redeployed after adding environment variable
- [ ] Backend restarted after adding CLIENT_URL
- [ ] Test signup/login on Vercel URL
- [ ] Test watch party functionality

## Common Issues

### Issue: "Connection error. Please try again."

**Cause:** VITE_API_URL not set or incorrect in Vercel.

**Solution:** 
1. Check Vercel environment variables
2. Ensure VITE_API_URL points to your backend server (not localhost)
3. Redeploy Vercel

### Issue: "CORS Error" or "Not allowed by CORS"

**Cause:** Backend doesn't recognize your Vercel domain.

**Solution:**
1. Check backend environment variables
2. Ensure CLIENT_URL matches your Vercel domain exactly
3. Restart backend server

### Issue: "Network Error"

**Cause:** Backend server is not running or URL is wrong.

**Solution:**
1. Verify backend server is deployed and running
2. Test backend URL directly in browser
3. Check backend logs for errors

## Quick Test

After completing all steps, test your backend:
```bash
curl https://YOUR-BACKEND-DOMAIN.com/api/auth/me
```

Should return JSON response (even if unauthorized).

## Need Help?

If you still have issues:
1. Check Vercel deployment logs
2. Check backend server logs
3. Verify all environment variables are set correctly
4. Ensure both frontend and backend are HTTPS
