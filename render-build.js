#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

// Log the current directory and files to help debug
console.log('Current directory:', process.cwd());
console.log('Files in node_modules/.bin:', fs.readdirSync(path.join(process.cwd(), 'node_modules', '.bin')).join(', '));

try {
  // Try to find vite in node_modules/.bin
  const vitePath = path.join(process.cwd(), 'node_modules', '.bin', 'vite');
  const esbuildPath = path.join(process.cwd(), 'node_modules', '.bin', 'esbuild');
  
  console.log('Checking if vite exists at:', vitePath);
  console.log('Vite exists:', fs.existsSync(vitePath));
  
  // Run vite build with full path
  console.log('Running vite build...');
  execSync(`${vitePath} build`, { stdio: 'inherit' });
  
  // Run esbuild with full path
  console.log('Running esbuild...');
  execSync(`${esbuildPath} server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist`, { stdio: 'inherit' });
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
