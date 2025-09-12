// Load environment variables first
import 'dotenv/config';

import { Hono } from 'hono';
import { serve } from '@hono/node-server';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { Config, getConfig } from './config.js';
import { ReviewJobQueue } from './review/review-queue.js';
import { github, setReviewQueue } from './routes/github.js';


const app = new Hono();

// Middleware
app.use('*', cors());
app.use('*', logger());
app.use('*', prettyJSON());

// Initialize components
const config: Config = getConfig();
const queueConfig = config.queue;
const reviewQueue = new ReviewJobQueue(queueConfig.max_queue_size, queueConfig.max_workers);

// Set the review queue for the github routes
setReviewQueue(reviewQueue);

// Mount GitHub routes (including webhook)
app.route('/github', github);

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
      queue_status: '/queue/status'
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

serve({
  fetch: app.fetch,
  port
}, (info) => {
  console.log(`Server running at http://localhost:${info.port}`);
});

export default app;
