import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import { GitHubPullRequestEvent } from '../github/types.js';
import { GitHubClient } from '../github/client.js';
import { QueueFullError, ReviewJobQueue } from '../review/review-queue.js';
import { Config, getConfig } from '../config.js';
import { processReview } from '../github/process-review.js';
import { z } from 'zod';

const github = new Hono();

// Initialize config for webhook route
const config: Config = getConfig();

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
    }),
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
  // Check if this is an action we care about (opened, reopened, synchronize)
  const action = payload.action;
  if (!['opened', 'reopened', 'synchronize'].includes(action)) {
    return { message: 'Action ignored' };
  }

  console.log(`Processing PR ${payload.pull_request.number} action: ${action}`);

  // Extract installation ID directly from webhook payload
  const installationId = (payload as any).installation?.id;
  console.log('Installation ID from webhook:', installationId);

  // Use installation-specific client
  const client = installationId
    ? GitHubClient.forInstallation(config, installationId)
    : new GitHubClient(config);

  if (!reviewQueue) {
    throw new Error('Review queue not initialized');
  }

  // Enqueue review job
  const processReviewCallback = async (jobId: string) => {
    await processReview(jobId, client, payload);
  };

  const jobId = reviewQueue.enqueueReview(payload.pull_request.number, processReviewCallback);

  // Return immediate response
  return {
    jobId,
    status: 'queued',
    message: 'Review job enqueued successfully'
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
