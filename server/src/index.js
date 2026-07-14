import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

// Load config
dotenv.config();

// Router Imports
import authRouter from './routes/auth.js';
import videoRouter from './routes/videos.js';
import commentRouter from './routes/comments.js';
import paymentRouter from './routes/payments.js';

// Middleware Imports
import { errorHandler } from './middleware/errorHandler.js';
import { publicLimiter } from './middleware/rateLimiter.js';
import registerSocketHandlers from './socket.js';

const app = express();
const httpServer = createServer(app);

// Configure Socket.io with CORS parameters matching client DevServer
const io = new Server(httpServer, {
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173', 'http://localhost:5174', 'http://127.0.0.1:5174'],
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true
  }
});

// --- SECURITY & BASIC EXPRESS MIDDLEWARES ---

// Helmet configuration with CSP override to allow streaming video sources and avatars
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://checkout.razorpay.com"],
      frameSrc: ["'self'", "https://api.razorpay.com"],
      connectSrc: ["'self'", "ws:", "wss:", "http://localhost:5173", "http://localhost:5174", "https://api.razorpay.com", "https://ipapi.co"],
      imgSrc: ["'self'", "data:", "blob:", "https://images.unsplash.com", "https://upload.wikimedia.org"],
      mediaSrc: ["'self'", "blob:", "https://commondatastorage.googleapis.com", "http://commondatastorage.googleapis.com"],
      styleSrc: ["'self'", "'unsafe-inline'"]
    }
  },
  hsts: process.env.NODE_ENV === 'production' ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  } : false,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
}));

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    // List of allowed origins
    const allowedOrigins = [
      'http://localhost:5173',
      'http://127.0.0.1:5173',
      'http://localhost:5174',
      'http://127.0.0.1:5174',
      process.env.CLIENT_URL // Add your Vercel domain here
    ].filter(Boolean);
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply moderate rate limiter globally on all public endpoints
app.use(publicLimiter);

// --- REGISTER ROUTES ---
app.use('/api/auth', authRouter);
app.use('/api/videos', videoRouter);
app.use('/api/comments', commentRouter);
app.use('/api/payments', paymentRouter);

// Basic health check route
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', message: 'Platform server is healthy.' });
});

// --- WEBSOCKET HANDLERS ---
registerSocketHandlers(io);

// --- LEAK-PROOF GLOBAL ERROR HANDLER ---
app.use(errorHandler);

// --- SPIN UP SERVER ---
const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => {
  console.log(`=========================================`);
  console.log(` SERVER RUNNING ON PORT ${PORT} `);
  console.log(` Mode: ${process.env.NODE_ENV || 'development'} `);
  console.log(`=========================================`);
});
