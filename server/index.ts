console.log("SERVER ENTRYPOINT STARTED");

import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = express();

// --- CORS MIDDLEWARE: ENSURE HEADERS ALWAYS SET ---
const allowedOrigins = [
  "https://revenue-share-calculator-frontend.onrender.com",
  "http://localhost:8080",
  "http://127.0.0.1:8080",
  "http://localhost:5173"
];

function setCorsHeaders(req: Request, res: Response, next: NextFunction) {
  const origin = req.headers.origin;
  console.log('CORS middleware running for', req.method, req.originalUrl, 'Origin:', origin);
  
  // Allow all origins in development mode
  if (process.env.NODE_ENV === 'development') {
    res.header("Access-Control-Allow-Origin", origin || '*');
  } else if (!origin || allowedOrigins.includes(origin)) {
    res.header("Access-Control-Allow-Origin", origin || allowedOrigins[0]);
  }
  
  res.header("Access-Control-Allow-Credentials", "true");
  res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type,Authorization");
  
  if (req.method === "OPTIONS") {
    res.sendStatus(200);
  } else {
    next();
  }
}

// Place this as the FIRST middleware
app.use(setCorsHeaders);

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

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    // Do not throw after sending response
    // throw err;
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 8080 or the PORT environment variable
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = process.env.PORT || 8080;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
