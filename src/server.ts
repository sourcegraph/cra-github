// Load environment variables first
import 'dotenv/config';

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { Config, getConfig } from './config.js';
import { ReviewJobQueue } from './review/review-queue.js';
import { reviewDiff } from './review/reviewer.js';
import { github, setReviewQueue } from './routes/github.js';
import { createMCPRoutes } from './mcp/http-server.js';

const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());
app.use('*', prettyJSON());

// Initialize components
const config: Config = getConfig();
const queueConfig = config.queue;
const reviewQueue = new ReviewJobQueue(queueConfig.max_queue_size);

// Set the review queue for the github routes
setReviewQueue(reviewQueue);

// Mount GitHub routes (including OAuth and webhook)
app.route('/github', github);

// Mount MCP routes
app.route('/mcp', createMCPRoutes());

// Routes
app.get('/', (c) => {
  return c.json({
    service: 'GitHub Code Review Agent',
    version: '2.0.0',
    mode: 'GitHub App',
    endpoints: {
      install: '/github/install',
      webhook: '/github/webhook',
      health: '/health',
      queue_status: '/queue/status',
      mcp: '/mcp'
    }
  });
});

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'github-code-review-agent',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});


// Queue status endpoint
app.get('/queue/status', (c) => {
  const stats = reviewQueue.getQueueStats();
  return c.json(stats);
});

// Job status endpoint
app.get('/jobs/:jobId', (c) => {
  const jobId = c.req.param('jobId');
  const jobInfo = reviewQueue.getJobStatus(jobId);
  
  if (!jobInfo) {
    return c.json({ error: 'Job not found' }, 404);
  }
  
  return c.json(jobInfo);
});

// Test endpoint for reviewDiff function
app.post('/test/review', async (c) => {
  try {
    const body = await c.req.json();
    const { diffContent, prDetails } = body;
    
    if (!diffContent || !prDetails) {
      return c.json({ error: 'Missing diffContent or prDetails' }, 400);
    }

    const prDetailsContent = `Repository: ${prDetails.repository_full_name}, PR Number: ${prDetails.pr_number}, Commit SHA: ${prDetails.commit_sha}, PR URL: ${prDetails.pr_url}`;
    
    const result = await reviewDiff(diffContent, prDetailsContent);
    
    return c.json({
      success: true,
      result
    });
  } catch (error) {
    console.error('Test review error:', error);
    return c.json({ 
      error: error instanceof Error ? error.message : String(error) 
    }, 500);
  }
});

// Error handling
app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({
    error: 'Internal server error',
    message: err.message
  }, 500);
});

// 404 handler
app.notFound((c) => {
  return c.json({
    error: 'Not found',
    message: 'The requested endpoint was not found'
  }, 404);
});

// Start server
const serverConfig = config.server;
const port = Number(serverConfig.port) || 5053;

console.log(`Starting GitHub Code Review Agent on port ${port}`);
console.log(`Debug mode: ${serverConfig.debug}`);

serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log(`🚀 Server running at http://localhost:${info.port}`);
});

export default app;
