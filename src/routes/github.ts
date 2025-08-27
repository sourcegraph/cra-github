import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { GitHubPullRequestEvent } from '../github/types.js';
import { QueueFullError, ReviewJobQueue } from '../review/review-queue.js';
import { Config, getConfig } from '../config.js';
import { processReview } from '../github/process-review.js';
import { z } from 'zod';

const github = new Hono();

// Initialize config for webhook route
const config: Config = getConfig();

// PR actions that trigger code reviews
const REVIEW_TRIGGER_ACTIONS = ['opened', 'reopened', 'ready_for_review', 'review_requested'];

// We'll need to receive the reviewQueue from the main server
let reviewQueue: ReviewJobQueue | null = null;

// Function to set the review queue from the main server
export function setReviewQueue(queue: ReviewJobQueue) {
  reviewQueue = queue;
}

// Minimal webhook payload schemas - only the fields we actually use
const InstallationEventSchema = z.object({
  action: z.string(),
  installation: z.object({
    id: z.number(),
    account: z.object({
      id: z.number(),
      login: z.string(),
    }).optional(),
  }),
  repositories: z.array(z.object({
    id: z.number(),
    name: z.string(),
    full_name: z.string(),
  })).optional(),
});

/**
 * Handle installation events (installation, installation_repositories) 
 */
async function handleInstallationEvent(payload: unknown) {
  const { action, installation } = InstallationEventSchema.parse(payload);
  console.log(`Installation event: ${action} for installation ${installation.id}`);
  return { message: 'Installation event logged' };
}

/**
 * Handle pull request events
 */
async function handlePullRequestEvent(payload: GitHubPullRequestEvent) {
  // Check if this is an action we care about
  const action = payload.action;
  if (!REVIEW_TRIGGER_ACTIONS.includes(action)) {
    return { message: 'Action ignored' };
  }

  // For review_requested actions, only respond if our bot was requested
  if (action === 'review_requested') {
    const requestedReviewer = (payload as any).requested_reviewer;
    if (!requestedReviewer || requestedReviewer.type !== 'Bot') {
      return { message: 'Review not requested for this bot' };
    }
    // You could add additional bot name checking here if needed
    console.log('Re-review requested for bot:', requestedReviewer.login);
  }

  console.log(`Processing PR ${payload.pull_request.number} action: ${action}`);

  // Extract installation ID directly from webhook payload
  const installationId = (payload as any).installation?.id;
  console.log('Installation ID from webhook:', installationId);

  if (!reviewQueue) {
    throw new Error('Review queue not initialized');
  }

  if (!installationId) {
    throw new Error('Installation ID is required for review processing');
  }

  // Enqueue review job
  const processReviewCallback = async (jobId: string) => {
    await processReview(jobId, installationId, payload);
  };
  
  const jobId = reviewQueue.enqueueReview(payload.pull_request.number, installationId, processReviewCallback);

  // Return immediate response
  return {
    jobId,
    status: 'queued',
    message: 'Review job enqueued successfully'
  };
}

/**
 * Handle check run action events (e.g., re-run review button)
 */
async function handleCheckRunActionEvent(payload: any) {
  console.log(`Processing check run action: ${payload.requested_action?.identifier}`);
  
  // Only handle our re-run review action
  if (payload.requested_action?.identifier !== 're-run-review') {
    return { message: 'Action not handled' };
  }

  // Extract installation and PR information
  const installationId = payload.installation?.id;
  const checkRun = payload.check_run;
  const repository = payload.repository;

  if (!installationId || !checkRun || !repository) {
    throw new Error('Missing required check run action data');
  }

  console.log(`Re-run review requested for check run ${checkRun.id} in repo ${repository.full_name}`);

  // We need to find the associated PR. The check run should have the PR info in pull_requests array
  const pullRequests = checkRun.pull_requests || [];
  
  if (pullRequests.length === 0) {
    throw new Error('No associated pull request found for check run');
  }

  // Use the first PR (there should typically be only one)
  const prNumber = pullRequests[0].number;
  
  console.log(`Queueing re-review for PR ${prNumber}`);

  if (!reviewQueue) {
    throw new Error('Review queue not initialized');
  }

  // Create a mock payload for the re-run (we'll need to fetch PR details)
  const processReviewCallback = async (jobId: string) => {
    // We need to fetch the full PR data since we don't have it in the check run payload
    const config = getConfig();
    const { GitHubClient } = await import('../github/client.js');
    const githubClient = GitHubClient.forInstallation(config, installationId);
    
    console.log(`Fetching PR ${prNumber} details for re-review job ${jobId}`);
    const prData = await githubClient.getPRInfo(repository.owner.login, repository.name, prNumber);
    
    // Construct a mock GitHubPullRequestEvent payload
    const mockPayload = {
      action: 're-review',
      number: prNumber,
      pull_request: prData,
      repository: repository,
      installation: { id: installationId },
      sender: { id: 0, login: 'system' } // Mock sender for re-review
    } as unknown as GitHubPullRequestEvent;

    await processReview(jobId, installationId, mockPayload);
  };

  const jobId = reviewQueue.enqueueReview(prNumber, installationId, processReviewCallback);

  return {
    jobId,
    status: 'queued',
    message: `Re-review job enqueued successfully for PR ${prNumber}`
  };
}

/**
 * GitHub webhook endpoint
 */
github.post('/webhook', async (c) => {
  try {
    const body = await c.req.text();
    const signature = c.req.header('X-Hub-Signature-256');

    // Verify webhook signature if secret is configured
    if (config.github.webhook_secret) {
      if (!signature) {
        return c.json({ error: 'Missing signature' }, 401);
      }

      const crypto = await import('crypto');
      const expectedSignature = 'sha256=' + crypto
        .createHmac('sha256', config.github.webhook_secret)
        .update(body)
        .digest('hex');

      if (signature !== expectedSignature) {
        return c.json({ error: 'Invalid signature' }, 401);
      }
    }

    const payload = JSON.parse(body) as any;

    if (!payload) {
      return c.json({ error: 'No JSON payload' }, 400);
    }

    // Handle pull request events first (GitHub App webhooks include both installation and pull_request)
    if (payload.pull_request) {
      const result = await handlePullRequestEvent(payload as GitHubPullRequestEvent);
      return c.json(result, 202);
    }

    // Handle check run action requests  
    if (payload.action === 'requested_action' && payload.check_run) {
      const result = await handleCheckRunActionEvent(payload);
      return c.json(result, 202);
    }

    // Handle installation events
    if (payload.installation) {
      const result = await handleInstallationEvent(payload);
      return c.json(result, 200);
    }

    return c.json({ message: 'Event ignored' }, 200);

  } catch (error) {
    if (error instanceof QueueFullError) {
      const queueConfig = config.queue;
      console.warn(`Queue full: ${error.message}`);
      return c.json({
        error: 'Review queue is full',
        message: 'The system is currently overloaded. Please try again later.',
        retry_after: queueConfig.retry_after_seconds
      }, 503); // 503 Service Unavailable
    }

    console.error('Webhook error:', error);
    return c.json({
      error: error instanceof Error ? error.message : String(error)
    }, 500);
  }
});

/**
 * Start GitHub App installation flow
 */
github.get('/install', async (c) => {
  const state = uuidv4();

  // Redirect to GitHub App installation page
  const installUrl = `https://github.com/apps/${process.env.GITHUB_APP_NAME || 'your-app-name'}/installations/new?state=${state}`;

  return c.redirect(installUrl);
});

/**
 * Handle GitHub App installation callback
 */
github.get('/callback', async (c) => {
  const installationId = c.req.query('installation_id');
  const setupAction = c.req.query('setup_action');
  const error = c.req.query('error');

  if (error) {
    return c.text(`Installation failed: ${error}`, 400);
  }

  if (!installationId || setupAction !== 'install') {
    return c.text('Installation not completed', 400);
  }

  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>GitHub Code Review Agent - Installation Complete</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
          .success { color: #22c55e; }
          .info { background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0; }
        </style>
      </head>
      <body>
        <h1 class="success">✅ Installation Complete!</h1>
        <p>Your GitHub Code Review Agent is now installed!</p>
        
        <div class="info">
          <h3>✨ What happens next:</h3>
          <ul>
            <li><strong>Automatic setup:</strong> Webhooks are configured automatically</li>
            <li><strong>Create pull requests:</strong> The agent will review all new pull requests</li>
            <li><strong>Get insights:</strong> Review comments will appear directly in your PRs</li>
          </ul>
        </div>
        
        <div class="info">
          <strong>Installation ID:</strong> ${installationId}
        </div>
      </body>
    </html>
  `);
});

export { github };
