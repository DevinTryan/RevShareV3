#!/usr/bin/env node

import { execSync } from 'child_process';

try {
  console.log('Starting simplified build process...');
  
  // Install esbuild globally to ensure it's available
  console.log('Installing esbuild globally...');
  execSync('npm install -g esbuild', { stdio: 'inherit' });
  
  // Build the client-side code
  console.log('Building client-side code...');
  execSync('npx esbuild client/src/main.tsx --bundle --minify --outfile=dist/client.js', { stdio: 'inherit' });
  
  // Copy any static assets
  console.log('Copying static assets...');
  execSync('mkdir -p dist/public && cp -r public/* dist/public/ || true', { stdio: 'inherit' });
  
  // Build the server-side code
  console.log('Building server-side code...');
  execSync('npx esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { stdio: 'inherit' });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
