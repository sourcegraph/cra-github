#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

// Resolve compiled code relative to script location (not cwd)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const candidateDistDirs = [
  path.resolve(__dirname, '..'),          // when script is in dist/toolbox
  path.resolve(__dirname, '..', 'dist'),  // when script is in toolbox/
  path.resolve(process.cwd(), 'dist'),    // fallback
];

const distDir = candidateDistDirs.find(d => fs.existsSync(path.join(d, 'config.js')));
if (!distDir) {
  throw new Error(`Cannot locate dist/ (searched: ${candidateDistDirs.join(', ')})`);
}

const distImport = async (rel) => import(pathToFileURL(path.join(distDir, rel)).href);

const action = process.env.TOOLBOX_ACTION;

// Tool metadata
if (action === 'describe') {
  console.log(JSON.stringify({
    name: 'get_pr_comments',
    description: 'Get all comments on a pull request',
    args: {}
  }));
  process.exit(0);
}

// Execution
if (action === 'execute') {
  (async () => {
    try {
      // Get PR context from environment variables
      const owner = process.env.GITHUB_OWNER;
      const repo = process.env.GITHUB_REPO;
      const prNumber = parseInt(process.env.GITHUB_PR_NUMBER || '0');
      
      if (!owner || !repo || !prNumber) {
        throw new Error('Missing required environment variables: GITHUB_OWNER, GITHUB_REPO, GITHUB_PR_NUMBER');
      }

      // Runtime deps from compiled output
      const { GitHubClient } = await distImport('github/client.js');
      const { getConfig } = await distImport('config.js');

      const config = getConfig();
      const gh = GitHubClient.create(config);

      const comments = await gh.getPRComments(owner, repo, prNumber);

      console.log(JSON.stringify({
        success: true,
        comments,
        total_comments: comments.length
      }));
    } catch (error) {
      console.error('get_pr_comments failed:', error.message);
      console.log(JSON.stringify({ 
        success: false, 
        error: error.message 
      }));
      process.exitCode = 1;
    }
  })();
}
