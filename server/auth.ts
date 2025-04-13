import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express, Request, Response, NextFunction } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import MemoryStore from "memorystore";
import { db } from "./db";
import { storage } from "./storage";
import { User, UserRole } from "@shared/schema";
import { eq } from "drizzle-orm";
import { users } from "@shared/schema";

// Create memory store for session storage
const MemStore = MemoryStore(session);

// Promisify the scrypt function
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

/**
 * Setup authentication middleware and routes
 */
export function setupAuth(app: Express) {
  // Session configuration
  const sessionStore = new MemStore({
    checkPeriod: 86400000 // prune expired entries every 24h
  });

  app.use(
    session({
      secret: process.env.SESSION_SECRET || "talk-realty-session-secret",
      resave: false,
      saveUninitialized: false,
      store: sessionStore,
      cookie: {
        secure: process.env.NODE_ENV === "production",
        maxAge: 1000 * 60 * 60 * 24 // 24 hours
      }
    })
  );

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Configure local strategy for username/password auth
  passport.use(
    new LocalStrategy(async (username, password, done) => {
      try {
        // Find user by username
        const [user] = await db.select().from(users).where(eq(users.username, username));
        
        if (!user) {
          return done(null, false, { message: "Incorrect username" });
        }
        
        // Check password
        const isPasswordValid = await comparePasswords(password, user.password);
        
        if (!isPasswordValid) {
          return done(null, false, { message: "Incorrect password" });
        }
        
        // If auth successful, update last login time
        await db
          .update(users)
          .set({ lastLogin: new Date() })
          .where(eq(users.id, user.id));
        
        // Return user
        return done(null, user);
      } catch (error) {
        return done(error);
      }
    })
  );

  // User serialization and deserialization for session
  passport.serializeUser((user: User, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id: number, done) => {
    try {
      const [user] = await db.select().from(users).where(eq(users.id, id));
      
      if (!user) {
        return done(null, false);
      }
      
      // If user is an agent, include agent data
      if (user.role === UserRole.AGENT && user.agentId) {
        const agent = await storage.getAgentWithDownline(user.agentId);
        user.agent = agent;
      }
      
      done(null, user);
    } catch (error) {
      done(error);
    }
  });

  // Auth routes
  
  // Register a new user
  app.post("/api/auth/register", async (req: Request, res: Response) => {
    try {
      const { username, password, email, role, agentId } = req.body;
      
      // Check if username is already taken
      const [existingUser] = await db
        .select()
        .from(users)
        .where(eq(users.username, username));
      
      if (existingUser) {
        return res.status(400).json({ message: "Username is already taken" });
      }
      
      // Check if agent exists if agentId is provided
      if (agentId) {
        const agent = await storage.getAgent(agentId);
        if (!agent) {
          return res.status(400).json({ message: "Agent not found" });
        }
      }
      
      // Hash password
      const hashedPassword = await hashPassword(password);
      
      // Create new user
      const [user] = await db
        .insert(users)
        .values({
          username,
          password: hashedPassword,
          email,
          role,
          agentId: agentId || null,
          createdAt: new Date()
        })
        .returning();
      
      // Remove password from response
      const { password: _, ...userWithoutPassword } = user;
      
      res.status(201).json(userWithoutPassword);
    } catch (error) {
      console.error("Registration error:", error);
      res.status(500).json({ message: "Registration failed" });
    }
  });

  // Login
  app.post("/api/auth/login", (req: Request, res: Response, next: NextFunction) => {
    passport.authenticate("local", (err, user, info) => {
      if (err) {
        return next(err);
      }
      
      if (!user) {
        return res.status(401).json({ message: info?.message || "Authentication failed" });
      }
      
      req.login(user, async (loginErr) => {
        if (loginErr) {
          return next(loginErr);
        }
        
        // If user is an agent, include agent data
        if (user.role === UserRole.AGENT && user.agentId) {
          const agent = await storage.getAgentWithDownline(user.agentId);
          user.agent = agent;
        }
        
        // Remove password from response
        const { password, ...userWithoutPassword } = user;
        
        return res.json(userWithoutPassword);
      });
    })(req, res, next);
  });

  // Logout
  app.post("/api/auth/logout", (req: Request, res: Response) => {
    req.logout((err) => {
      if (err) {
        return res.status(500).json({ message: "Logout failed" });
      }
      
      res.status(200).json({ message: "Logged out successfully" });
    });
  });

  // Get current user
  app.get("/api/auth/user", (req: Request, res: Response) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    // Remove password from response
    const { password, ...userWithoutPassword } = req.user as User;
    
    res.json(userWithoutPassword);
  });

  // Password reset request
  app.post("/api/auth/reset-password-request", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      // Find user by email
      const [user] = await db.select().from(users).where(eq(users.email, email));
      
      if (!user) {
        // Don't reveal that email doesn't exist for security reasons
        return res.status(200).json({ message: "If your email is registered, you will receive a reset link" });
      }
      
      // Generate reset token
      const resetToken = randomBytes(32).toString("hex");
      const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour from now
      
      // Store token in database
      await db
        .update(users)
        .set({ resetToken, resetTokenExpiry })
        .where(eq(users.id, user.id));
      
      // In a real application, you would send an email with the reset link
      // For this demo, we'll just return the token
      res.status(200).json({
        message: "If your email is registered, you will receive a reset link",
        // Only include token in development mode
        ...(process.env.NODE_ENV !== "production" && { resetToken })
      });
    } catch (error) {
      console.error("Password reset request error:", error);
      res.status(500).json({ message: "Password reset request failed" });
    }
  });

  // Reset password with token
  app.post("/api/auth/reset-password", async (req: Request, res: Response) => {
    try {
      const { token, newPassword } = req.body;
      
      if (!token || !newPassword) {
        return res.status(400).json({ message: "Token and new password are required" });
      }
      
      // Find user by token
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.resetToken, token));
      
      if (!user || !user.resetTokenExpiry) {
        return res.status(400).json({ message: "Invalid or expired token" });
      }
      
      // Check if token is expired
      if (new Date() > new Date(user.resetTokenExpiry)) {
        return res.status(400).json({ message: "Token has expired" });
      }
      
      // Hash new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update user with new password and clear token
      await db
        .update(users)
        .set({
          password: hashedPassword,
          resetToken: null,
          resetTokenExpiry: null
        })
        .where(eq(users.id, user.id));
      
      res.status(200).json({ message: "Password has been reset successfully" });
    } catch (error) {
      console.error("Password reset error:", error);
      res.status(500).json({ message: "Password reset failed" });
    }
  });
  
  // Middleware for checking if user is authenticated
  app.use("/api/protected", (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    next();
  });
  
  // Middleware for checking if user is admin
  app.use("/api/admin", (req: Request, res: Response, next: NextFunction) => {
    if (!req.isAuthenticated()) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    
    const user = req.user as User;
    
    if (user.role !== UserRole.ADMIN) {
      return res.status(403).json({ message: "Not authorized" });
    }
    
    next();
  });
  
  return {
    sessionStore
  };
}