#!/usr/bin/env node

import { execSync } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get current directory in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const currentDir = process.cwd();

// Log the current directory and files to help debug
console.log('Current directory:', currentDir);
console.log('Files in node_modules/.bin:', fs.readdirSync(path.join(currentDir, 'node_modules', '.bin')).join(', '));

try {
  // Try to find vite in node_modules/.bin
  const vitePath = path.join(currentDir, 'node_modules', '.bin', 'vite');
  const esbuildPath = path.join(currentDir, 'node_modules', '.bin', 'esbuild');
  
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
