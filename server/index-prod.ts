console.log("SERVER ENTRYPOINT STARTED - PRODUCTION MODE");

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic, log } from "./vite-prod";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const app = express();

// BULLETPROOF CORS MIDDLEWARE - DEBUG MODE
const allowedOrigins = [
  "https://revenue-share-calculator-frontend.onrender.com",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://www.revenue-share-calculator-frontend.onrender.com"
];

function bulletproofCors(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  const method = req.method;
  const url = req.originalUrl;
  // Always set CORS headers for debugging
  let allowOrigin = "";
  if (origin && allowedOrigins.includes(origin)) {
    allowOrigin = origin;
  } else if (origin) {
    allowOrigin = allowedOrigins[0]; // fallback for debugging
  }
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", req.headers["access-control-request-headers"] || "Content-Type,Authorization");
  console.log(`[CORS DEBUG] Method: ${method}, URL: ${url}, Origin: ${origin}, Allow-Origin: ${allowOrigin}`);
  if (method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
}

app.use(bulletproofCors);

app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// Register API routes
registerRoutes(app);

// Serve static files
serveStatic(app);

// Error handler
app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  res.status(500).json({
    error: "Internal Server Error",
    message: process.env.NODE_ENV === "production" ? null : err.message,
  });
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  log(`Server running at http://localhost:${port}`);
});

export default app;
