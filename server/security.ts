import bcrypt from 'bcrypt';
import { randomBytes } from 'crypto';
import { User } from '../shared/schema';

const SALT_ROUNDS = 10;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION = 15 * 60 * 1000; // 15 minutes in milliseconds

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare a password with a hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Check if a user is locked out
 */
export function isUserLocked(user: User): boolean {
  if (!user.isLocked) return false;
  if (!user.lockExpiresAt) return true;
  return new Date(user.lockExpiresAt) > new Date();
}

/**
 * Handle failed login attempt
 */
export function handleFailedLogin(user: User): Partial<User> {
  const failedAttempts = (user.failedLoginAttempts || 0) + 1;
  const updates: Partial<User> = {
    failedLoginAttempts: failedAttempts,
    lastFailedLogin: new Date()
  };

  if (failedAttempts >= MAX_LOGIN_ATTEMPTS) {
    updates.isLocked = true;
    updates.lockExpiresAt = new Date(Date.now() + LOCK_DURATION);
  }

  return updates;
}

/**
 * Reset login attempts after successful login
 */
export function resetLoginAttempts(): Partial<User> {
  return {
    failedLoginAttempts: 0,
    lastFailedLogin: null,
    isLocked: false,
    lockExpiresAt: null
  };
}

/**
 * Generate a secure random token
 */
export function generateSecureToken(length: number = 32): string {
  return randomBytes(length).toString('hex');
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): { isValid: boolean; message?: string } {
  if (password.length < 8) {
    return { isValid: false, message: 'Password must be at least 8 characters long' };
  }

  if (!/[A-Z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one uppercase letter' };
  }

  if (!/[a-z]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one lowercase letter' };
  }

  if (!/[0-9]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one number' };
  }

  if (!/[!@#$%^&*]/.test(password)) {
    return { isValid: false, message: 'Password must contain at least one special character (!@#$%^&*)' };
  }

  return { isValid: true };
} 