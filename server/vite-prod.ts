import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Resolve directory paths for ESM
let __filename: string = '';
let __dirname: string = '';

function __filenameGlobal() {
  // @ts-ignore
  return typeof __filename !== 'undefined' ? __filename : '';
}

function __dirnameGlobal() {
  // @ts-ignore
  return typeof __dirname !== 'undefined' ? __dirname : '';
}

try {
  __filename = fileURLToPath(import.meta.url);
  __dirname = path.dirname(__filename);
} catch (e) {
  __filename = __filenameGlobal();
  __dirname = __dirnameGlobal();
}

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

export function serveStatic(app: Express) {
  // In production, serve from the dist directory
  const distPath = path.resolve(__dirname, "../dist");
  
  if (!fs.existsSync(distPath)) {
    log(`WARNING: Build directory not found at ${distPath}. Static files will not be served.`);
    return;
  }

  // Serve static files from the dist directory
  app.use(express.static(distPath, {
    index: false, // Don't automatically serve index.html for the root path
    maxAge: '1d' // Cache static assets for 1 day
  }));

  // For any non-API route, serve the index.html file
  app.get(/^(?!\/api\/).*/, (req, res) => {
    const indexPath = path.resolve(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      log(`WARNING: index.html not found at ${indexPath}`);
      res.status(404).send('Application not found. Please make sure the client has been built.');
    }
  });
  
  log('Static file serving configured for production');
}
