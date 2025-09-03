#!/usr/bin/env node

import { readFileSync } from 'fs';
import { processReview } from '../github/process-review.js';
import { GitHubPullRequestEvent } from '../github/types.js';

async function main() {
  try {
    // GitHub Actions provides the event payload via GITHUB_EVENT_PATH
    const eventPath = process.env.GITHUB_EVENT_PATH;
    if (!eventPath) {
      throw new Error('GITHUB_EVENT_PATH environment variable not set');
    }

    // Read and parse the GitHub event payload
    const eventData = JSON.parse(readFileSync(eventPath, 'utf8'));
    
    // Validate this is a pull request event
    if (!eventData.pull_request) {
      console.log('Not a pull request event, skipping review');
      return;
    }

    const payload = eventData as GitHubPullRequestEvent;
    
    // Generate a job ID for this review run
    const jobId = `action-${Date.now()}-${payload.pull_request.number}`;
    
    console.log(`Starting review for PR #${payload.pull_request.number}`);
    console.log(`Repository: ${payload.repository.full_name}`);
    console.log(`Action: ${payload.action}`);
    
    // Call the existing review logic
    // Note: installationId is not used when using GITHUB_TOKEN auth
    await processReview(jobId, 0, payload);
    
    console.log('Review completed successfully');
    
  } catch (error) {
    console.error('Review failed:', error);
    process.exit(1);
  }
}

main();
