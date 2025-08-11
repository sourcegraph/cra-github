import { Hono } from 'hono';
import { v4 as uuidv4 } from 'uuid';
import jwt from 'jsonwebtoken';
import { readFileSync } from 'fs';
import { GitHubOAuthService } from '../github/oauth.js';
import { InstallationStore } from '../github/installation-store.js';
import { WebhookManager } from '../github/webhook-manager.js';
import { GitHubInstallation } from '../types/installation.js';
import { GitHubPullRequestEvent } from '../github/types.js';
import { GitHubClient } from '../github/client.js';
import { QueueFullError } from '../review/review-queue.js';
import { Config, getConfig } from '../config.js';
import { processReview } from '../github/process-review.js';

const github = new Hono();
const oauthService = new GitHubOAuthService();
const installationStore = new InstallationStore();
const webhookManager = new WebhookManager();

// Initialize config and client for webhook route
const config: Config = getConfig();
const githubClient = new GitHubClient(config);

// We'll need to receive the reviewQueue from the main server
let reviewQueue: any = null;

// Function to set the review queue from the main server
export function setReviewQueue(queue: any) {
  reviewQueue = queue;
}

// GitHub App authentication helpers
async function generateAppToken(): Promise<string> {
  // Check for required environment variables
  if (!process.env.GITHUB_APP_ID) {
    throw new Error('GITHUB_APP_ID environment variable is required');
  }
  
  // Read private key from file or environment
  let privateKey: string;
  
  if (process.env.GITHUB_APP_PRIVATE_KEY) {
    // Use private key from environment variable
    const rawKey = process.env.GITHUB_APP_PRIVATE_KEY.replace(/\\n/g, '\n');
    
    // Check if the key is base64 encoded (common with GitHub Apps)
    if (!rawKey.includes('-----BEGIN') && /^[A-Za-z0-9+/]+=*$/.test(rawKey.replace(/\s/g, ''))) {
      try {
        privateKey = Buffer.from(rawKey, 'base64').toString('utf8');
      } catch (error) {
        throw new Error(`Failed to decode base64 private key: ${error}`);
      }
    } else {
      privateKey = rawKey;
    }
  } else {
    // Read from file
    const keyPath = process.env.GITHUB_APP_PRIVATE_KEY_PATH || 'private-key.pem';
    try {
      privateKey = readFileSync(keyPath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read private key file at ${keyPath}: ${error}`);
    }
  }

  // Auto-format private key if it's missing PEM headers
  if (!privateKey.includes('-----BEGIN')) {
    // Clean the private key content - remove any whitespace, newlines, etc.
    const base64Content = privateKey
      .replace(/\s/g, '') // Remove all whitespace
      .replace(/\n/g, '') // Remove newlines
      .replace(/\r/g, '') // Remove carriage returns
      .trim(); // Remove leading/trailing whitespace
    
    // Validate it looks like base64
    if (!/^[A-Za-z0-9+/]+=*$/.test(base64Content)) {
      throw new Error('Private key content does not appear to be valid base64');
    }
    
    // Split long base64 string into 64-character lines (standard PEM format)
    const formattedContent = base64Content.match(/.{1,64}/g)?.join('\n') || base64Content;
    privateKey = `-----BEGIN PRIVATE KEY-----\n${formattedContent}\n-----END PRIVATE KEY-----`;
  }
  
  // Validate private key format (accept both RSA and PKCS#8 formats)
  const isValidFormat = privateKey.includes('-----BEGIN RSA PRIVATE KEY-----') || 
                       privateKey.includes('-----BEGIN PRIVATE KEY-----');
  
  if (!isValidFormat) {
    throw new Error('Invalid private key format. Expected either RSA or PKCS#8 PEM format');
  }

  const payload = {
    iat: Math.floor(Date.now() / 1000) - 60, // Issued 1 minute ago
    exp: Math.floor(Date.now() / 1000) + (10 * 60), // Expires in 10 minutes
    iss: process.env.GITHUB_APP_ID, // App ID
  };
  
  try {
    return jwt.sign(payload, privateKey, { algorithm: 'RS256' });
  } catch (error) {
    throw new Error(`Failed to sign JWT: ${error}`);
  }
}

async function getInstallationAccessToken(installationId: string, appToken: string): Promise<string> {
  const response = await fetch(`https://api.github.com/app/installations/${installationId}/access_tokens`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${appToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-Code-Review-Agent/1.0',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get installation access token: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return data.token;
}

async function getInstallationDetails(installationId: string, appToken: string) {
  const response = await fetch(`https://api.github.com/app/installations/${installationId}`, {
    headers: {
      'Authorization': `Bearer ${appToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-Code-Review-Agent/1.0',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get installation details: ${response.status} - ${errorText}`);
  }
  
  return response.json();
}

async function getInstallationRepositories(installationId: string, installationToken: string) {
  const response = await fetch(`https://api.github.com/installation/repositories`, {
    headers: {
      'Authorization': `Bearer ${installationToken}`,
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-Code-Review-Agent/1.0',
    },
  });
  
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Failed to get installation repositories: ${response.status} - ${errorText}`);
  }
  
  const data = await response.json();
  return data.repositories;
}

/**
 * Handle installation events (installation, installation_repositories)
 */
async function handleInstallationEvent(payload: any) {
  const action = payload.action;
  const installation = payload.installation;
  
  console.log(`Processing installation event: ${action} for installation ${installation.id}`);
  
  try {
    if (action === 'created') {
      // App was installed
      const appToken = await generateAppToken();
      const installationAccessToken = await getInstallationAccessToken(installation.id.toString(), appToken);
      const repositories = await getInstallationRepositories(installation.id.toString(), installationAccessToken);
      
      // Create installation record
      const installationRecord: GitHubInstallation = {
        id: uuidv4(),
        githubInstallationId: installation.id,
        githubUserId: installation.account.id,
        githubUsername: installation.account.login,
        accessToken: installationAccessToken,
        refreshToken: '',
        scopes: ['contents', 'metadata', 'pull_requests'],
        installedAt: new Date(),
        repositories: repositories.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
        })),
      };
      
      await installationStore.storeInstallation(installationRecord);
      console.log(`Installation ${installation.id} saved successfully`);
      
    } else if (action === 'deleted') {
      // App was uninstalled - find installation by GitHub installation ID
      const installations = await installationStore.listInstallations();
      const installationToDelete = installations.find(inst => inst.githubInstallationId === installation.id);
      if (installationToDelete) {
        await installationStore.removeInstallation(installationToDelete.id);
        console.log(`Installation ${installation.id} deleted`);
      }
      
    } else if (action === 'added' || action === 'removed') {
      // Repositories were added/removed from installation
      const appToken = await generateAppToken();
      const installationAccessToken = await getInstallationAccessToken(installation.id.toString(), appToken);
      const repositories = await getInstallationRepositories(installation.id.toString(), installationAccessToken);
      
      // Update installation repositories - find by GitHub installation ID
      const installations = await installationStore.listInstallations();
      const existingInstallation = installations.find(inst => inst.githubInstallationId === installation.id);
      if (existingInstallation) {
        const updates: Partial<GitHubInstallation> = {
          repositories: repositories.map((repo: any) => ({
            id: repo.id,
            name: repo.name,
            full_name: repo.full_name,
          })),
          accessToken: installationAccessToken,
          lastUsed: new Date(),
        };
        
        await installationStore.updateInstallation(existingInstallation.id, updates);
        console.log(`Installation ${installation.id} repositories updated`);
      }
    }
    
    return { message: 'Installation event processed successfully' };
    
  } catch (error) {
    console.error(`Failed to process installation event: ${error}`);
    throw error;
  }
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

  // Look up installation for this repository
  const repositoryId = payload.repository.id;
  console.log('Looking up installation for repository ID:', repositoryId);
  const installation = await installationStore.getInstallationByRepositoryId(repositoryId);
  console.log('Installation found:', !!installation, installation ? installation.id : 'none');
  
  let client = githubClient;
  
  if (installation) {
    // Generate fresh installation access token
    console.log('Generating app token for installation:', installation.githubInstallationId);
    const appToken = await generateAppToken();
    console.log('App token generated, length:', appToken.length);
    
    const installationAccessToken = await getInstallationAccessToken(installation.githubInstallationId.toString(), appToken);
    console.log('Installation access token generated, length:', installationAccessToken.length);
    
    // Use installation-specific client with fresh token
    const installationConfig = { ...config };
    installationConfig.github.token = installationAccessToken;
    client = new GitHubClient(installationConfig, installation, oauthService, installationStore);
  }

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
  const clientId = process.env.GITHUB_APP_CLIENT_ID || process.env.GITHUB_CLIENT_ID;
  
  if (!clientId) {
    return c.text('GitHub App not configured', 500);
  }
  
  // Redirect to GitHub App installation page
  const installUrl = `https://github.com/apps/${process.env.GITHUB_APP_NAME || 'your-app-name'}/installations/new?state=${state}`;
  
  // Store state for validation (in production, use Redis or similar)
  // c.set('install_state', state); // TODO: Implement state validation
  
  return c.redirect(installUrl);
});

/**
 * Handle GitHub App installation callback
 */
github.get('/callback', async (c) => {
  try {
    const installationId = c.req.query('installation_id');
    const setupAction = c.req.query('setup_action');
    const state = c.req.query('state'); // TODO: Validate state parameter
    const error = c.req.query('error');

    if (error) {
      return c.text(`Installation failed: ${error}`, 400);
    }

    if (!installationId) {
      return c.text('Installation ID not provided', 400);
    }

    if (setupAction === 'install') {
      // Get installation details from GitHub
      const appToken = await generateAppToken();
      const installationDetails = await getInstallationDetails(installationId, appToken);
      
      // Get installation access token (required for accessing installation resources)
      const installationAccessToken = await getInstallationAccessToken(installationId, appToken);
      
      // Get repositories this installation has access to (using installation token)
      const repositories = await getInstallationRepositories(installationId, installationAccessToken);

      // Create installation record
      const installation: GitHubInstallation = {
        id: uuidv4(),
        githubInstallationId: parseInt(installationId),
        githubUserId: installationDetails.account.id,
        githubUsername: installationDetails.account.login,
        accessToken: '', // Will be generated as needed for each API call
        refreshToken: '',
        scopes: ['contents', 'metadata', 'pull_requests'],
        installedAt: new Date(),
        repositories: repositories.map((repo: any) => ({
          id: repo.id,
          name: repo.name,
          full_name: repo.full_name,
        })),
      };

      await installationStore.storeInstallation(installation);

      // Return success page
      return c.html(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>GitHub Code Review Agent - Installation Complete</title>
            <style>
              body { font-family: Arial, sans-serif; max-width: 600px; margin: 50px auto; padding: 20px; }
              .success { color: #22c55e; }
              .info { background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0; }
              .code { background: #1f2937; color: #f9fafb; padding: 10px; border-radius: 5px; font-family: monospace; }
            </style>
          </head>
          <body>
            <h1 class="success">✅ Installation Complete!</h1>
            <p>Hello <strong>${installationDetails.account.login}</strong>, your GitHub Code Review Agent is now installed!</p>
            
            <div class="info">
              <h3>📦 Installed Repositories:</h3>
              <ul>
                ${repositories.map((repo: any) => `<li><strong>${repo.full_name}</strong></li>`).join('')}
              </ul>
            </div>

            <div class="info">
              <h3>✨ What happens next:</h3>
              <ul>
                <li><strong>Automatic setup:</strong> Webhooks will be configured automatically</li>
                <li><strong>Create pull requests:</strong> The agent will review all new pull requests</li>
                <li><strong>Get insights:</strong> Review comments will appear directly in your PRs</li>
              </ul>
            </div>
            
            <div class="info">
              <strong>Installation ID:</strong> ${installation.id}<br>
              <strong>GitHub Installation ID:</strong> ${installationId}<br>
              <strong>Account:</strong> ${installationDetails.account.login}
            </div>
          </body>
        </html>
      `);
    } else {
      return c.text('Installation setup cancelled', 400);
    }

  } catch (error) {
    console.error('Installation callback error:', error);
    return c.text('Installation failed. Please try again.', 500);
  }
});

/**
 * Dashboard page - show installation status and repositories
 */
github.get('/dashboard/:installationId', async (c) => {
  const installationId = c.req.param('installationId');
  const installation = await installationStore.getInstallation(installationId);
  
  if (!installation) {
    return c.text('Installation not found', 404);
  }

  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Dashboard - GitHub Code Review Agent</title>
        <style>
          body { font-family: Arial, sans-serif; max-width: 800px; margin: 50px auto; padding: 20px; }
          .success { color: #22c55e; }
          .info { background: #f3f4f6; padding: 15px; border-radius: 5px; margin: 20px 0; }
          .repo-list { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
          .repo-item { padding: 12px; border-bottom: 1px solid #e5e7eb; }
          .repo-item:last-child { border-bottom: none; }
          .status-active { color: #22c55e; }
          .status-inactive { color: #ef4444; }
        </style>
      </head>
      <body>
        <h1>📊 GitHub Code Review Agent Dashboard</h1>
        <p>Installation for <strong>${installation.githubUsername}</strong></p>
        
        <div class="info">
          <strong>Installation Details:</strong><br>
          Installation ID: ${installation.id}<br>
          GitHub Installation ID: ${installation.githubInstallationId}<br>
          Account: ${installation.githubUsername}<br>
          Installed: ${installation.installedAt.toLocaleDateString()}
        </div>

        <div class="repo-list">
          <h3>📦 Monitored Repositories</h3>
          ${installation.repositories?.map((repo: any) => `
            <div class="repo-item">
              <strong>${repo.full_name}</strong>
              <span class="status-active">✅ Active</span>
            </div>
          `).join('') || '<p>No repositories found</p>'}
        </div>

        <div class="info">
          <h3>✨ How it works:</h3>
          <ul>
            <li><strong>Automatic monitoring:</strong> All pull requests in your repositories are automatically reviewed</li>
            <li><strong>Intelligent feedback:</strong> The agent provides code quality suggestions and identifies potential issues</li>
            <li><strong>Seamless integration:</strong> Comments appear directly in your pull request discussions</li>
          </ul>
        </div>
      </body>
    </html>
  `);
});

export { github };
