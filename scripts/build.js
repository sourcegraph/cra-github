#!/usr/bin/env node

import { execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

try {
  // Run TypeScript compilation
  console.log('Running TypeScript compilation...');
  execSync('tsc', { stdio: 'inherit' });
  
  // Copy toolbox folder as-is to preserve formatting
  const srcToolbox = join(process.cwd(), 'toolbox');
  const distToolbox = join(process.cwd(), 'dist/toolbox');
  
  if (existsSync(srcToolbox)) {
    console.log('Copying toolbox folder...');
    cpSync(srcToolbox, distToolbox, { recursive: true, force: true });
    console.log('Toolbox copied successfully');
  }
  
  // Copy config.yml file
  const srcConfig = join(process.cwd(), 'config.yml');
  const distConfig = join(process.cwd(), 'dist/config.yml');
  
  if (existsSync(srcConfig)) {
    console.log('Copying config.yml...');
    cpSync(srcConfig, distConfig, { force: true });
    console.log('Config copied successfully');
  }
  
  console.log('Build completed successfully');
} catch (error) {
  console.error('Build failed:', error.message);
  process.exit(1);
}
