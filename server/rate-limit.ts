import { Request, Response, NextFunction } from 'express';
import { db } from './db';
import { users } from '../shared/schema';
import { eq } from 'drizzle-orm';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  message: string;
}

const defaultConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 100,
  message: 'Too many requests from this IP, please try again later.'
};

const ipRequests = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate limiting middleware
 */
export function rateLimit(config: Partial<RateLimitConfig> = {}) {
  const { windowMs, maxRequests, message } = { ...defaultConfig, ...config };

  return async (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || 'unknown';
    const now = Date.now();

    // Clean up expired entries
    for (const [key, value] of Array.from(ipRequests.entries())) {
      if (value.resetTime < now) {
        ipRequests.delete(key);
      }
    }

    // Get or create rate limit entry for this IP
    let rateLimit = ipRequests.get(ip);
    if (!rateLimit) {
      rateLimit = { count: 0, resetTime: now + windowMs };
      ipRequests.set(ip, rateLimit);
    }

    // Check if rate limit is exceeded
    if (rateLimit.count >= maxRequests) {
      return res.status(429).json({ error: message });
    }

    // Increment request count
    rateLimit.count++;

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, maxRequests - rateLimit.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimit.resetTime / 1000));

    next();
  };
}

/**
 * Login attempt rate limiting middleware
 */
export function loginRateLimit(config: Partial<RateLimitConfig> = {}) {
  const { windowMs, maxRequests, message } = { ...defaultConfig, ...config };

  return async (req: Request, res: Response, next: NextFunction) => {
    const { username } = req.body;
    if (!username) {
      return next();
    }

    try {
      // Get user's failed login attempts
      const user = await db
        .select()
        .from(users)
        .where(eq(users.username, username))
        .limit(1);

      if (user.length === 0) {
        return next();
      }

      const failedAttempts = user[0].failedLoginAttempts || 0;
      const lastFailedLogin = user[0].lastFailedLogin;

      // Check if user is locked out
      if (user[0].isLocked && user[0].lockExpiresAt) {
        const lockExpiresAt = new Date(user[0].lockExpiresAt);
        if (lockExpiresAt > new Date()) {
          return res.status(429).json({
            error: `Account is locked. Please try again after ${lockExpiresAt.toISOString()}`
          });
        }
      }

      // Check if rate limit is exceeded
      if (failedAttempts >= maxRequests) {
        const timeSinceLastAttempt = lastFailedLogin
          ? Date.now() - new Date(lastFailedLogin).getTime()
          : 0;

        if (timeSinceLastAttempt < windowMs) {
          return res.status(429).json({ error: message });
        }
      }

      next();
    } catch (error) {
      console.error('Error in login rate limit:', error);
      next();
    }
  };
} 