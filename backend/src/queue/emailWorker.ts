import { Worker, Job } from 'bullmq';
import { redis } from '../lib/redis.js';
import { prisma } from '../lib/prisma.js';
import { sendEmail } from '../lib/mailer.js';
import { sendRateLimitSlackAlert } from '../lib/slack.js';
import { indexEmailInElastic } from '../lib/elasticsearch.js';
import { config } from '../config/index.js';
import { EMAIL_QUEUE_NAME, EmailJobData } from './emailQueue.js';

const HOUR_IN_MS = 3600000;

export function getCurrentHourWindow(): number {
  return Math.floor(Date.now() / HOUR_IN_MS);
}

export function getNextHourWindowStart(): Date {
  const nextWindow = (getCurrentHourWindow() + 1) * HOUR_IN_MS;
  return new Date(nextWindow);
}

/**
 * Checks the Redis rate limit counter for a sender in the current hour window.
 * Returns true if limit is exceeded, false otherwise.
 */
export async function checkRateLimit(
  senderEmail: string,
  hourlyLimit: number
): Promise<{ exceeded: boolean; currentCount: number }> {
  const currentHour = getCurrentHourWindow();
  const redisKey = `ratelimit:sender:${senderEmail}:${currentHour}`;

  const currentCountStr = await redis.get(redisKey);
  const currentCount = currentCountStr ? parseInt(currentCountStr, 10) : 0;

  if (currentCount >= hourlyLimit) {
    return { exceeded: true, currentCount };
  }

  return { exceeded: false, currentCount };
}

/**
 * Atomically increments the Redis hourly counter for a sender.
 */
export async function incrementRateLimit(senderEmail: string): Promise<number> {
  const currentHour = getCurrentHourWindow();
  const redisKey = `ratelimit:sender:${senderEmail}:${currentHour}`;

  const newCount = await redis.incr(redisKey);
  if (newCount === 1) {
    // Set 2 hours TTL so memory stays clean
    await redis.expire(redisKey, 7200);
  }

  return newCount;
}

/**
 * Sleep helper to enforce minimum delay between sends
 */
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export const emailWorker = new Worker<EmailJobData>(
  EMAIL_QUEUE_NAME,
  async (job: Job<EmailJobData>) => {
    const { emailId, recipient, subject, body, senderEmail } = job.data;
    console.log(`\n⏳ [Worker Job ${job.id}] Processing email for ${recipient} from ${senderEmail}...`);

    // 1. Fetch Email record from DB to ensure state and idempotency
    const emailRecord = await prisma.email.findUnique({
      where: { id: emailId },
    });

    if (!emailRecord) {
      console.warn(`[Worker Job ${job.id}] Email record ${emailId} not found in DB. Skipping.`);
      return;
    }

    if (emailRecord.status === 'SENT') {
      console.log(`[Worker Job ${job.id}] Email ${emailId} already marked SENT. Skipping (Idempotent).`);
      return;
    }

    if (emailRecord.status === 'CANCELLED') {
      console.log(`[Worker Job ${job.id}] Email ${emailId} is CANCELLED. Skipping.`);
      return;
    }

    // 2. Fetch sender configuration and hourly limit
    const sender = await prisma.sender.findUnique({
      where: { email: senderEmail },
    });
    const hourlyLimit = sender?.hourlyLimit || config.maxEmailsPerHourPerSender;

    // 3. Hourly Rate Limit Check
    const { exceeded, currentCount } = await checkRateLimit(senderEmail, hourlyLimit);

    if (exceeded) {
      const nextWindowStart = getNextHourWindowStart();
      // Delay until start of next hour + a small buffer
      const delayUntilMs = nextWindowStart.getTime() - Date.now() + 2000;

      console.warn(
        `🚨 [Rate Limit Reached] Sender "${senderEmail}" reached hourly limit (${currentCount}/${hourlyLimit}). Rescheduling email ${emailId} to ${nextWindowStart.toISOString()}`
      );

      // Update DB status to DELAYED
      await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'DELAYED',
          scheduledAt: nextWindowStart,
          metadata: JSON.stringify({
            reason: 'Rate limit exceeded',
            originalLimit: hourlyLimit,
            delayedAt: new Date().toISOString(),
          }),
        },
      });

      // Check if we should notify Slack (throttled to once per sender per hour window)
      const alertKey = `ratelimit:slack_alert:${senderEmail}:${getCurrentHourWindow()}`;
      const alreadyAlerted = await redis.get(alertKey);

      if (!alreadyAlerted) {
        await redis.set(alertKey, 'true', 'EX', 3600); // 1 hour TTL
        await sendRateLimitSlackAlert({
          senderEmail,
          hourlyLimit,
          currentCount,
          delayedUntil: nextWindowStart,
          affectedRecipient: recipient,
          subject,
        });
      }

      // Reschedule the job in BullMQ to the next hour window
      await job.moveToDelayed(Date.now() + delayUntilMs, job.token);
      return;
    }

    // 4. Update status to PROCESSING
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'PROCESSING',
        attemptCount: { increment: 1 },
      },
    });

    try {
      // 5. Send Email via Ethereal SMTP
      const sendResult = await sendEmail({
        from: senderEmail,
        senderName: sender?.name || config.defaultSenderName,
        to: recipient,
        subject,
        html: body,
      });

      // 6. Atomically increment the rate limit counter
      await incrementRateLimit(senderEmail);

      // 7. Update DB Record with SENT status and Ethereal preview link
      const previewUrl = typeof sendResult.previewUrl === 'string' ? sendResult.previewUrl : null;
      const updatedEmail = await prisma.email.update({
        where: { id: emailId },
        data: {
          status: 'SENT',
          sentAt: new Date(),
          etherealPreviewUrl: previewUrl,
          error: null,
        },
      });

      // 8. Index in Elasticsearch
      await indexEmailInElastic(updatedEmail);

      console.log(`✅ [Worker Job ${job.id}] Successfully sent email to ${recipient}!`);
      if (previewUrl) {
        console.log(`🔗 Ethereal Preview URL: ${previewUrl}`);
      }

      // 9. Enforce minimum delay between sends to mimic provider throttling
      if (config.emailDelayMs > 0) {
        await sleep(config.emailDelayMs);
      }

      return {
        success: true,
        previewUrl,
        sentAt: updatedEmail.sentAt,
      };
    } catch (sendError: any) {
      console.error(`❌ [Worker Job ${job.id}] Failed to send email to ${recipient}:`, sendError.message);

      const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts || 3);

      const failedEmail = await prisma.email.update({
        where: { id: emailId },
        data: {
          status: isFinalAttempt ? 'FAILED' : 'SCHEDULED',
          error: sendError.message,
        },
      });

      await indexEmailInElastic(failedEmail);
      throw sendError;
    }
  },
  {
    connection: redis,
    concurrency: config.workerConcurrency, // Configurable worker concurrency
  }
);

emailWorker.on('completed', (job: Job) => {
  console.log(`[Worker] Job ${job.id} completed.`);
});

emailWorker.on('failed', (job: Job | undefined, err: Error) => {
  console.error(`[Worker] Job ${job?.id} failed with error:`, err.message);
});
