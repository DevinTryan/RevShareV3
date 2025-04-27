#!/usr/bin/env node

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

try {
  console.log('Starting production build process...');
  
  // Create a temporary vite.config.js for production build
  console.log('Creating production Vite config...');
  const viteConfig = `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './client/src'),
    },
  },
});
`;
  
  fs.writeFileSync('vite.config.prod.js', viteConfig);
  
  // Install required build dependencies
  console.log('Installing build dependencies...');
  execSync('npm install -g vite', { stdio: 'inherit' });
  
  // Build the client using Vite
  console.log('Building client with Vite...');
  execSync('npx vite build --config vite.config.prod.js', { stdio: 'inherit' });
  
  // Build the server-side code
  console.log('Building server-side code...');
  execSync('npx esbuild server/index-prod.ts --platform=node --packages=external --bundle --format=esm --outdir=dist', { stdio: 'inherit' });
  
  // Rename index-prod.js to index.js
  console.log('Finalizing build...');
  fs.renameSync('dist/index-prod.js', 'dist/index.js');
  
  // Clean up
  fs.unlinkSync('vite.config.prod.js');
  
  console.log('Build completed successfully!');
} catch (error) {
  console.error('Build failed:', error);
  process.exit(1);
}
