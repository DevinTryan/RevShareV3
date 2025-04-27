#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  console.log('Starting simplified build process...');
  
  // Install esbuild globally to ensure it's available
  console.log('Installing esbuild globally...');
  execSync('npm install -g esbuild', { stdio: 'inherit' });
  
  // Create a simple HTML file
  console.log('Creating index.html...');
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Revenue Share Calculator</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        margin: 0;
        padding: 0;
        display: flex;
        justify-content: center;
        align-items: center;
        min-height: 100vh;
        background-color: #f5f5f5;
      }
      .container {
        max-width: 800px;
        margin: 0 auto;
        padding: 2rem;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }
      h1 {
        color: #333;
        margin-bottom: 1rem;
      }
      p {
        color: #666;
        line-height: 1.6;
      }
      .api-link {
        display: inline-block;
        margin-top: 1rem;
        padding: 0.5rem 1rem;
        background-color: #4a90e2;
        color: white;
        text-decoration: none;
        border-radius: 4px;
      }
      .api-link:hover {
        background-color: #3a80d2;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Revenue Share Calculator API</h1>
      <p>The Revenue Share Calculator API is running successfully!</p>
      <p>This is the API server for the Revenue Share Calculator application. The frontend application should connect to this API to retrieve and manage data.</p>
      <p>You can check the API health status by visiting the health endpoint:</p>
      <a href="/api/health" class="api-link">Check API Health</a>
    </div>
  </body>
</html>`;
  
  // Ensure dist directory exists
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
  }
  
  // Write index.html to dist
  fs.writeFileSync('dist/index.html', indexHtml);
  
  // Build the server-side code
  console.log('Building server-side code...');
  execSync('npx esbuild server/index-prod.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { stdio: 'inherit' });
  
  // Rename index-prod.js to index.js
  console.log('Finalizing build...');
  fs.renameSync('dist/index-prod.js', 'dist/index.js');
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
