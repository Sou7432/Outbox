import { v4 as uuidv4 } from 'uuid';
import { prisma } from '../lib/prisma.js';
import { enqueueEmailJob, emailQueue } from '../queue/emailQueue.js';
import { indexEmailInElastic, searchEmailsInElastic, isElasticsearchConnected } from '../lib/elasticsearch.js';
import { config } from '../config/index.js';

export interface ScheduleCampaignInput {
  recipients: string[];
  subject: string;
  body: string;
  senderEmail?: string;
  startTime?: string | Date; // When campaign starts
  delayBetweenEmailsSeconds?: number; // Delay between consecutive recipients
  hourlyLimit?: number;
}

export class EmailService {
  /**
   * Schedules a batch of emails.
   * Staggers recipient emails according to delayBetweenEmailsSeconds.
   * Stores all in PostgreSQL and enqueues delayed jobs into BullMQ.
   */
  async scheduleCampaign(input: ScheduleCampaignInput) {
    const {
      recipients,
      subject,
      body,
      senderEmail = config.defaultSenderEmail,
      startTime = new Date(),
      delayBetweenEmailsSeconds = 2,
      hourlyLimit,
    } = input;

    if (!recipients || recipients.length === 0) {
      throw new Error('At least one recipient email is required');
    }

    // Ensure sender exists in DB
    let sender = await prisma.sender.findUnique({
      where: { email: senderEmail },
    });

    if (!sender) {
      sender = await prisma.sender.create({
        data: {
          email: senderEmail,
          name: senderEmail.split('@')[0],
          hourlyLimit: hourlyLimit || config.maxEmailsPerHourPerSender,
        },
      });
    } else if (hourlyLimit && sender.hourlyLimit !== hourlyLimit) {
      sender = await prisma.sender.update({
        where: { email: senderEmail },
        data: { hourlyLimit },
      });
    }

    const campaignId = uuidv4();
    const baseStartTime = new Date(startTime).getTime();
    const now = Date.now();
    const delayStepMs = Math.max(0, delayBetweenEmailsSeconds * 1000);

    const createdEmails = [];

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i].trim();
      if (!recipient) continue;

      // Stagger sending time: baseStartTime + (i * delayStepMs)
      const scheduledTargetTime = new Date(Math.max(now, baseStartTime) + i * delayStepMs);
      const delayMs = Math.max(0, scheduledTargetTime.getTime() - now);

      const emailRecord = await prisma.email.create({
        data: {
          recipient,
          subject,
          body,
          senderEmail,
          scheduledAt: scheduledTargetTime,
          status: 'SCHEDULED',
          campaignId,
        },
      });

      // Update BullMQ jobId to enforce 1-to-1 mapping and idempotency
      await prisma.email.update({
        where: { id: emailRecord.id },
        data: { jobId: emailRecord.id },
      });

      // Enqueue delayed job in BullMQ
      await enqueueEmailJob(
        {
          emailId: emailRecord.id,
          recipient,
          subject,
          body,
          senderEmail,
          scheduledAt: scheduledTargetTime.toISOString(),
          campaignId,
        },
        delayMs
      );

      // Index in Elasticsearch
      await indexEmailInElastic(emailRecord);

      createdEmails.push(emailRecord);
    }

    return {
      campaignId,
      totalScheduled: createdEmails.length,
      emails: createdEmails,
    };
  }

  /**
   * Retrieves scheduled emails with pagination and status filtering.
   */
  async getScheduledEmails(options: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const skip = (page - 1) * limit;

    let whereClause: any = {
      status: { in: ['SCHEDULED', 'DELAYED', 'PROCESSING'] },
    };

    if (options.search && options.search.trim()) {
      const search = options.search.trim();

      // Check Elasticsearch first
      if (isElasticsearchConnected()) {
        const matchingIds = await searchEmailsInElastic(search);
        if (matchingIds && matchingIds.length > 0) {
          whereClause = {
            id: { in: matchingIds },
            status: { in: ['SCHEDULED', 'DELAYED', 'PROCESSING'] },
          };
        } else if (matchingIds !== null) {
          // Empty elastic match
          return { emails: [], total: 0, page, totalPages: 0 };
        }
      }

      // Fallback to PostgreSQL search
      if (!isElasticsearchConnected()) {
        whereClause = {
          ...whereClause,
          OR: [
            { recipient: { contains: search } },
            { subject: { contains: search } },
            { senderEmail: { contains: search } },
          ],
        };
      }
    }

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where: whereClause,
        orderBy: { scheduledAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.email.count({ where: whereClause }),
    ]);

    return {
      emails,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Retrieves sent emails with pagination and status filtering.
   */
  async getSentEmails(options: { page?: number; limit?: number; search?: string }) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.max(1, Math.min(100, options.limit || 20));
    const skip = (page - 1) * limit;

    let whereClause: any = {
      status: { in: ['SENT', 'FAILED'] },
    };

    if (options.search && options.search.trim()) {
      const search = options.search.trim();

      if (isElasticsearchConnected()) {
        const matchingIds = await searchEmailsInElastic(search);
        if (matchingIds && matchingIds.length > 0) {
          whereClause = {
            id: { in: matchingIds },
            status: { in: ['SENT', 'FAILED'] },
          };
        } else if (matchingIds !== null) {
          return { emails: [], total: 0, page, totalPages: 0 };
        }
      }

      if (!isElasticsearchConnected()) {
        whereClause = {
          ...whereClause,
          OR: [
            { recipient: { contains: search } },
            { subject: { contains: search } },
            { senderEmail: { contains: search } },
          ],
        };
      }
    }

    const [emails, total] = await Promise.all([
      prisma.email.findMany({
        where: whereClause,
        orderBy: { sentAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.email.count({ where: whereClause }),
    ]);

    return {
      emails,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Search emails across all statuses using Elasticsearch with PostgreSQL fallback.
   */
  async searchEmails(query: string, status?: string) {
    if (isElasticsearchConnected()) {
      const matchingIds = await searchEmailsInElastic(query, status);
      if (matchingIds) {
        const emails = await prisma.email.findMany({
          where: { id: { in: matchingIds } },
        });
        return { source: 'elasticsearch', emails };
      }
    }

    // PostgreSQL fallback
    const where: any = {
      OR: [
        { recipient: { contains: query } },
        { subject: { contains: query } },
        { senderEmail: { contains: query } },
      ],
    };
    if (status) {
      where.status = status.toUpperCase();
    }

    const emails = await prisma.email.findMany({
      where,
      orderBy: { scheduledAt: 'desc' },
      take: 50,
    });

    return { source: 'database', emails };
  }

  /**
   * Cancels a scheduled email and removes it from the BullMQ queue.
   */
  async cancelEmail(emailId: string) {
    const email = await prisma.email.findUnique({ where: { id: emailId } });
    if (!email) throw new Error('Email not found');
    if (email.status === 'SENT') throw new Error('Cannot cancel already sent email');

    const job = await emailQueue.getJob(emailId);
    if (job) {
      await job.remove();
    }

    const updated = await prisma.email.update({
      where: { id: emailId },
      data: { status: 'CANCELLED' },
    });

    await indexEmailInElastic(updated);
    return updated;
  }

  /**
   * Get live scheduler metrics & queue counts
   */
  async getMetrics() {
    const [scheduledCount, sentCount, failedCount, delayedCount] = await Promise.all([
      prisma.email.count({ where: { status: 'SCHEDULED' } }),
      prisma.email.count({ where: { status: 'SENT' } }),
      prisma.email.count({ where: { status: 'FAILED' } }),
      prisma.email.count({ where: { status: 'DELAYED' } }),
    ]);

    const queueCounts = await emailQueue.getJobCounts('delayed', 'waiting', 'active', 'completed', 'failed');

    return {
      stats: {
        scheduled: scheduledCount,
        sent: sentCount,
        failed: failedCount,
        delayed: delayedCount,
        total: scheduledCount + sentCount + failedCount + delayedCount,
      },
      queue: queueCounts,
      elasticsearch: isElasticsearchConnected(),
    };
  }

  /**
   * Persistence recovery on server restart:
   * Ensures any scheduled emails in PostgreSQL exist in BullMQ.
   */
  async recoverPendingJobsOnRestart() {
    console.log('🔄 Checking database for scheduled jobs to synchronize with BullMQ...');
    try {
      const pendingEmails = await prisma.email.findMany({
        where: {
          status: { in: ['SCHEDULED', 'DELAYED'] },
        },
      });

      let reloadedCount = 0;
      const now = Date.now();

      for (const email of pendingEmails) {
        const existingJob = await emailQueue.getJob(email.id);
        if (!existingJob) {
          const delayMs = Math.max(0, email.scheduledAt.getTime() - now);
          await enqueueEmailJob(
            {
              emailId: email.id,
              recipient: email.recipient,
              subject: email.subject,
              body: email.body,
              senderEmail: email.senderEmail,
              scheduledAt: email.scheduledAt.toISOString(),
              campaignId: email.campaignId || undefined,
            },
            delayMs
          );
          reloadedCount++;
        }
      }

      console.log(`✅ Queue recovery complete: Verified ${pendingEmails.length} pending emails, re-enqueued ${reloadedCount} missing jobs.`);
    } catch (err: any) {
      console.error('Failed to run queue recovery:', err.message);
    }
  }
}

export const emailService = new EmailService();
