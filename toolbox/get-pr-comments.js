#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

// Resolve compiled code from project root → dist/
const rootDir = path.resolve(process.cwd());
const distImport = async (rel) => import(pathToFileURL(path.join(rootDir, 'dist', rel)).href);

const action = process.env.TOOLBOX_ACTION;

// Tool metadata
if (action === 'describe') {
  console.log(JSON.stringify({
    name: 'get_pr_comments',
    description: 'Get all comments on a pull request',
    args: {
      owner: ['string', 'Repository owner'],
      repo: ['string', 'Repository name'],
      pr_number: ['number', 'Pull request number']
    }
  }));
  process.exit(0);
}

// Execution
if (action === 'execute') {
  (async () => {
    try {
      const args = JSON.parse(fs.readFileSync(0, 'utf8'));
      
      // Validate required args
      if (!args.owner || !args.repo || typeof args.pr_number !== 'number') {
        throw new Error('Missing required arguments: owner, repo, pr_number');
      }

      // Runtime deps from compiled output
      const { GitHubClient } = await distImport('github/client.js');
      const { getConfig } = await distImport('config.js');

      const config = getConfig();
      const gh = GitHubClient.fromEnv(config);

      const comments = await gh.getPRComments(args.owner, args.repo, args.pr_number);

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
