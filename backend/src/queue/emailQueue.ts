import { Queue } from 'bullmq';
import { redis } from '../lib/redis.js';
import { config } from '../config/index.js';

export const EMAIL_QUEUE_NAME = 'email-queue';

export interface EmailJobData {
  emailId: string;
  recipient: string;
  subject: string;
  body: string;
  senderEmail: string;
  scheduledAt: string;
  campaignId?: string;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: redis,
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5000,
    },
    removeOnComplete: {
      count: 1000, // Keep last 1000 completed jobs visible in Bull-Board
    },
    removeOnFail: {
      count: 1000, // Keep last 1000 failed jobs visible in Bull-Board
    },
  },
});

emailQueue.on('error', (err) => {
  console.error('BullMQ Email Queue Error:', err.message);
});

/**
 * Schedules a delayed email job into BullMQ.
 * Uses the email's unique DB ID as the BullMQ jobId to enforce IDEMPOTENCY.
 */
export async function enqueueEmailJob(data: EmailJobData, delayMs: number) {
  const safeDelay = Math.max(0, Math.floor(delayMs));
  
  const job = await emailQueue.add('send-email', data, {
    jobId: data.emailId, // Idempotency: same email cannot be queued twice
    delay: safeDelay,
  });

  return job;
}
