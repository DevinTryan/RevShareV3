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
  
  // Build the client-side code
  console.log('Building client-side code...');
  execSync('npx esbuild client/src/main.tsx --bundle --minify --outfile=dist/client.js', { stdio: 'inherit' });
  
  // Create index.html in dist
  console.log('Creating index.html...');
  const indexHtml = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Revenue Share Calculator</title>
    <link rel="stylesheet" href="/client.css" />
  </head>
  <body>
    <div id="root"></div>
    <script src="/client.js"></script>
  </body>
</html>`;
  
  // Ensure dist directory exists
  if (!fs.existsSync('dist')) {
    fs.mkdirSync('dist');
  }
  
  // Write index.html to dist
  fs.writeFileSync('dist/index.html', indexHtml);
  
  // Copy any static assets
  console.log('Copying static assets...');
  try {
    execSync('mkdir -p dist/public && cp -r public/* dist/public/ || true', { stdio: 'inherit' });
  } catch (e) {
    console.log('No public directory found, skipping...');
  }
  
  // Build the server-side code using the production version
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
