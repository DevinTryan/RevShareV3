import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

// Production version doesn't need Vite
export async function setupVite(app: Express) {
  // In production, we don't need Vite middleware
  log("Running in production mode - Vite not needed");
}

export function serveStatic(app: Express) {
  // In production, serve from the dist directory
  const distPath = path.resolve(__dirname, "../dist");
  
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  // Serve static files from the dist directory
  app.use(express.static(distPath, {
    index: false, // Don't automatically serve index.html for the root path
    maxAge: '1d' // Cache static assets for 1 day
  }));

  // For any non-API route, serve the index.html file
  app.get(/^(?!\/api\/).*/, (req, res) => {
    res.sendFile(path.resolve(distPath, "index.html"));
  });
}
