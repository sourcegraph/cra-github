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
    name: 'leave_general_command_comment',
    description: 'Leave a general comment on a pull request when responding to a command',
    args: {
      comment: ['string', 'The comment text to post']
    }
  }));

// Execution
} else if (action === 'execute') {
  (async () => {
    try {
      // Get PR context from environment variables
      const owner = process.env.GITHUB_OWNER;
      const repo = process.env.GITHUB_REPO;
      const prNumber = parseInt(process.env.GITHUB_PR_NUMBER || '0');
      
      if (!owner || !repo || !prNumber) {
        throw new Error('Missing required environment variables: GITHUB_OWNER, GITHUB_REPO, GITHUB_PR_NUMBER');
      }

      // Get args from stdin
      const args = JSON.parse(fs.readFileSync(0, 'utf-8'));

      // Runtime deps from compiled output
      const { GitHubClient } = await distImport('github/client.js');
      const { getConfig } = await distImport('config.js');

      const configPath = path.join(import.meta.dirname, '..', 'config.yml');
      const config = getConfig(configPath);
      const gh = GitHubClient.create(config);

      const result = await gh.createIssueComment(owner, repo, prNumber, args.comment);

      console.log(JSON.stringify({
        comment_id: result.id,
        comment_url: result.html_url,
        success: true,
        message: 'Comment posted successfully'
      }));
    } catch (error) {
      console.error('leave_pr_comment failed:', error.message);
      console.log(JSON.stringify({ 
        success: false, 
        error: error.message 
      }));
      process.exitCode = 1;
    }
  })();
}
