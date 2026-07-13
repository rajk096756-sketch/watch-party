import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * JWT Authentication Middleware
 * Verifies Authorization header bearer token and attaches the validated User to req.user.
 */
export const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false, 
        message: 'Access denied. Authorization token is missing.' 
      });
    }

    const token = authHeader.split(' ')[1];
    const secret = process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ 
        success: false, 
        message: 'Server configuration error: JWT_SECRET not set.' 
      });
    }
    const decoded = jwt.verify(token, secret);

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId }
    });

    if (!user) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid session. Account does not exist.' 
      });
    }

    // Attach user metadata to request context
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ 
      success: false, 
      message: 'Your session has expired or is invalid. Please log in again.' 
    });
  }
};
