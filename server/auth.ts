import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, UserRole } from "../shared/schema";
import { z } from 'zod';
import { comparePassword, handleFailedLogin, resetLoginAttempts } from './security';

declare global {
  namespace Express {
    interface User {
      id: number;
      username: string;
      email: string;
      role: UserRole;
      agentId?: number | null;
      createdAt: Date;
      lastLogin: Date | null;
      failedLoginAttempts: number;
      isLocked: boolean;
      lockExpiresAt: Date | null;
      resetToken: string | null;
      resetTokenExpiry: Date | null;
    }
  }
}

const scryptAsync = promisify(scrypt);

/**
 * Hash a password with a salt for secure storage
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

/**
 * Compare a supplied password with a stored hashed password
 */
export async function comparePasswords(supplied: string, stored: string): Promise<boolean> {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// Login validation schema
export const loginSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().min(1, "Password is required")
});

/**
 * Setup authentication middleware and routes
 */
export function setupAuth(app: Express) {
  // Configure session
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET || "talk-realty-session-secret",
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 1 day
      secure: false, // Don't require HTTPS for local development
      sameSite: 'lax', // Use lax for better compatibility
      httpOnly: true // Prevent JavaScript access (security best practice)
    }
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure Local Strategy
  passport.use(
    new LocalStrategy(async (username: string, password: string, done: any) => {
      try {
        console.log(`Attempting login for user: ${username}`);
        
        // Get user from database
        const user = await storage.getUserByUsername(username);
        
        // Log the result of the user lookup
        if (!user) {
          console.log(`Login failed: User not found - ${username}`);
          return done(null, false, { message: 'Invalid username or password' });
        } else {
          console.log(`User found: ${username}, checking password...`);
        }

        // Check if user is locked
        if (user.isLocked && user.lockExpiresAt && new Date(user.lockExpiresAt) > new Date()) {
          console.log(`Login failed: Account locked - ${username}`);
          return done(null, false, { message: 'Account is locked due to too many failed attempts' });
        }

        // Try to compare password using both methods
        let isMatch = false;
        
        // First try bcrypt (from security.ts)
        try {
          console.log(`Trying bcrypt comparison for ${username}...`);
          isMatch = await comparePassword(password, user.password);
          console.log(`Bcrypt comparison result for ${username}: ${isMatch}`);
        } catch (err: any) {
          console.log(`Bcrypt comparison failed, will try scrypt next: ${err.message}`);
        }
        
        // If bcrypt fails, try scrypt (from auth.ts)
        if (!isMatch && user.password.includes('.')) {
          try {
            console.log(`Trying scrypt comparison for ${username}...`);
            isMatch = await comparePasswords(password, user.password);
            console.log(`Scrypt comparison result for ${username}: ${isMatch}`);
          } catch (err: any) {
            console.log(`Scrypt comparison failed: ${err.message}`);
          }
        }
        
        if (!isMatch) {
          console.log(`Login failed: Invalid password for ${username}`);
          // Update failed login attempts
          await storage.updateUser(user.id, handleFailedLogin(user));
          return done(null, false, { message: 'Invalid username or password' });
        }

        // Reset login attempts and update last login time
        console.log(`Login successful for ${username}, updating login stats...`);
        await storage.updateUser(user.id, {
          ...resetLoginAttempts(),
          lastLogin: new Date()
        });

        // Return the user object for authentication
        console.log(`Authentication successful for ${username}`);
        return done(null, user);
      } catch (error: any) {
        console.error("Authentication error:", error);
        return done(error);
      }
    })
  );

  // Serialization
  passport.serializeUser((user: Express.User, done) => {
    // Ensure we're using the numeric ID for serialization
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const user = await storage.getUser(id);
      if (!user) {
        return done(new Error('User not found'));
      }
      // Convert to Express.User and ensure all required properties exist
      const userForAuth = {
        ...user,
        createdAt: user.createdAt || new Date(),
        failedLoginAttempts: user.failedLoginAttempts ?? 0,
        isLocked: user.isLocked ?? false
      };
      done(null, userForAuth as Express.User);
    } catch (error: any) {
      done(error);
    }
  });

  // Registration endpoint
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      // Check if user exists
      const existingUser = await storage.getUserByUsername(req.body.username);
      if (existingUser) {
        return res.status(400).json({ message: "Username already exists" });
      }

      // Check if email exists
      const existingEmail = await storage.getUserByEmail(req.body.email);
      if (existingEmail) {
        return res.status(400).json({ message: "Email already exists" });
      }

      // If agentId is provided, ensure it's valid and not already linked
      if (req.body.agentId) {
        const agent = await storage.getAgent(req.body.agentId);
        if (!agent) {
          return res.status(400).json({ message: "Invalid agent ID" });
        }

        // Check if any user already has this agent ID linked
        const existingAgentUser = await storage.getAgentUser(req.body.agentId);
        if (existingAgentUser) {
          return res.status(400).json({ message: "This agent is already linked to a user account" });
        }
      }

      // Hash the password
      const hashedPassword = await hashPassword(req.body.password);

      // Create the user
      const user = await storage.createUser({
        ...req.body,
        password: hashedPassword,
        createdAt: new Date(),
        lastLogin: null,
        resetToken: null,
        resetTokenExpiry: null
      });

      // Log the user in
      req.login({
        ...user,
        createdAt: user.createdAt || new Date(),
        failedLoginAttempts: user.failedLoginAttempts ?? 0,
        isLocked: user.isLocked ?? false
      }, (err: any) => {
        if (err) {
          return res.status(500).json({ message: "Error during login after registration" });
        }
        return res.status(201).json(user);
      });
    } catch (error: any) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Error creating user" });
    }
  });

  // Login endpoint
  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    console.log("Login request received:", req.body.username);
    
    // Validate login data
    const result = loginSchema.safeParse(req.body);
    if (!result.success) {
      console.log("Login validation failed:", result.error.errors);
      return res.status(400).json({ message: "Invalid login data", errors: result.error.errors });
    }

    passport.authenticate("local", (err: any, user: any, info: any) => {
      if (err) {
        console.error("Login error:", err);
        return res.status(500).json({ message: "Internal server error" });
      }
      
      if (!user) {
        console.log("Authentication failed:", info?.message);
        return res.status(401).json({ message: info?.message || "Invalid credentials" });
      }
      
      console.log("User authenticated, establishing session for:", user.username);
      
      req.login(user, (err: any) => {
        if (err) {
          console.error("Login session error:", err);
          return res.status(500).json({ message: "Error during login" });
        }
        
        console.log("Login successful, session established for:", user.username);
        return res.status(200).json(user);
      });
    })(req, res, next);
  });

  // Logout endpoint
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err: any) => {
      if (err) {
        return res.status(500).json({ message: "Error during logout" });
      }
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  // Current user endpoint
  app.get("/api/auth/user", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    res.status(200).json(req.user);
  });

  // Authentication middleware for protected routes
  const requireAuth = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    next();
  };

  // Admin middleware for admin-only routes
  const requireAdmin = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    if (req.user?.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Admin access required" });
    }
    next();
  };

  // Agent-specific middleware
  const requireAgentAccess = (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    const agentId = parseInt(req.params.id);
    
    // Admin has access to all agents
    if (req.user?.role === UserRole.ADMIN) {
      return next();
    }
    
    // Agents can only access their own linked agent
    if (req.user?.role === UserRole.AGENT && req.user?.agentId === agentId) {
      return next();
    }
    
    return res.status(403).json({ message: "You don't have access to this agent's data" });
  };

  // Apply middleware to routes
  app.use("/api/protected", requireAuth);
  app.use("/api/admin", requireAdmin);
  
  // Return middleware for use in route definitions
  return {
    requireAuth,
    requireAdmin,
    requireAgentAccess
  };
}