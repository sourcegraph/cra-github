import { v4 as uuidv4 } from 'uuid';
import { JobInfo, JOB_STATUS } from './types.js';

export class QueueFullError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QueueFullError';
  }
}

export class ReviewJobQueue {
  private jobs = new Map<string, JobInfo>();
  private maxQueueSize: number;
  private processing = new Set<string>();

  constructor(maxQueueSize: number) {
    this.maxQueueSize = maxQueueSize;
    console.log(`ReviewJobQueue initialized with max queue size ${maxQueueSize}`);
  }

  enqueueReview(id: number, processReviewCb: (jobId: string) => Promise<void>): string {
    // Check if queue is at capacity
    if (this.jobs.size >= this.maxQueueSize) {
      throw new QueueFullError(`Review queue is full (max: ${this.maxQueueSize})`);
    }

    const jobId = uuidv4();
    this.jobs.set(jobId, {
      status: JOB_STATUS.QUEUED,
      created: Date.now(),
      id,
    });

    // Process job asynchronously without awaiting
    this.processReview(jobId, id, processReviewCb);

    return jobId;
  }

  private async processReview(
    jobId: string, id: number, processReviewCb: (jobId: string) => Promise<void>,
  ): Promise<void> {
    const job = this.jobs.get(jobId);
    if (!job) {
      console.error(`Job ${jobId} not found`);
      return;
    }

    console.log(`Starting review job ${jobId} processing`);
    this.processing.add(jobId);

    try {
      job.status = JOB_STATUS.RUNNING;
      job.started = Date.now();
      console.log(`Job ${jobId} status set to running`);

      await processReviewCb(jobId);

      job.status = JOB_STATUS.COMPLETED;
      console.log(`Job ${jobId} completed successfully`);

      job.completed = Date.now();
      job.result = { success: true };
    } catch (error) {
      job.status = JOB_STATUS.FAILED;
      job.error = error instanceof Error ? error.message : String(error);
      console.error(`Review job ${jobId} failed with exception:`, error);
    } finally {
      // Clean up job after a delay to allow status checking
      setTimeout(() => {
        this.jobs.delete(jobId);
        this.processing.delete(jobId);
        console.log(`Cleaned up completed job ${jobId}`);
      }, 60000); // Keep job info for 1 minute
    }
  }

  getJobStatus(jobId: string): JobInfo | null {
    return this.jobs.get(jobId) || null;
  }

  getQueueStats() {
    const queued = Array.from(this.jobs.values()).filter(job => job.status === JOB_STATUS.QUEUED).length;
    const running = Array.from(this.jobs.values()).filter(job => job.status === JOB_STATUS.RUNNING).length;
    const completed = Array.from(this.jobs.values()).filter(job => job.status === JOB_STATUS.COMPLETED).length;
    const failed = Array.from(this.jobs.values()).filter(job => job.status === JOB_STATUS.FAILED).length;

    return {
      total: this.jobs.size,
      queued,
      running,
      completed,
      failed,
      maxSize: this.maxQueueSize,
    };
  }
}
