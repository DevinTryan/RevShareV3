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
    <title>Revenue Share Calculator API</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f5f5f5;
        color: #333;
      }
      .container {
        max-width: 800px;
        margin: 50px auto;
        padding: 2rem;
        background-color: white;
        border-radius: 8px;
        box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
      }
      h1 {
        color: #2c3e50;
        margin-bottom: 1rem;
        text-align: center;
      }
      p {
        color: #555;
        line-height: 1.6;
        margin-bottom: 1rem;
      }
      .api-link {
        display: inline-block;
        margin-top: 1rem;
        padding: 0.75rem 1.5rem;
        background-color: #3498db;
        color: white;
        text-decoration: none;
        border-radius: 4px;
        font-weight: bold;
        transition: background-color 0.2s;
      }
      .api-link:hover {
        background-color: #2980b9;
      }
      .status {
        margin-top: 2rem;
        padding: 1rem;
        background-color: #e8f5e9;
        border-left: 4px solid #4caf50;
        border-radius: 4px;
      }
      .status h2 {
        margin-top: 0;
        color: #2e7d32;
      }
    </style>
  </head>
  <body>
    <div class="container">
      <h1>Revenue Share Calculator API</h1>
      
      <div class="status">
        <h2>Status: Online</h2>
        <p>The API server is running successfully!</p>
      </div>
      
      <p>This is the API server for the Revenue Share Calculator application. The frontend application should connect to this API to retrieve and manage data.</p>
      
      <p>You can check the API health status by visiting the health endpoint:</p>
      
      <a href="/api/health" class="api-link">Check API Health</a>
      
      <p style="margin-top: 2rem; font-size: 0.9rem; color: #7f8c8d;">
        Deployed on Render • Last updated: ${new Date().toLocaleDateString()}
      </p>
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
