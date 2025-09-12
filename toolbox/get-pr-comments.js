#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

// Resolve compiled code from project root → dist/
const rootDir = path.resolve(process.cwd());
const distImport = async (rel) => import(pathToFileURL(path.join(import.meta.dirname, '..', rel)).href);

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

      const configPath = path.join(import.meta.dirname, '..', 'config.yml');
      const config = getConfig(configPath);
      const gh = GitHubClient.create(config);

      const comments = await gh.getPRComments(owner, repo, prNumber);

      // Only pass the relevant fields for review
      for (let i = 0; i < comments.length; i++) {
        comments[i] = {
          id: comments[i].id,
          body: comments[i].body,
          user: comments[i].user?.login,
          created_at: comments[i].created_at,
          updated_at: comments[i].updated_at,
          path: comments[i].path,
          position: comments[i].position,
          line: comments[i].line,
          start_line: comments[i].start_line,
          side: comments[i].side,
          diff_hunk: comments[i].diff_hunk,
          commit_id: comments[i].commit_id
        };
      }

      console.log(JSON.stringify({
        comments,
        success: true,
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
