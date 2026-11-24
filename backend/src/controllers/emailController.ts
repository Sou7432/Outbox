import { Request, Response } from 'express';
import { z } from 'zod';
import { emailService } from '../services/emailService.js';
import csvParser from 'csv-parser';
import { Readable } from 'stream';

const scheduleSchema = z.object({
  recipients: z.array(z.string().email('Invalid email address')).min(1, 'At least one recipient is required'),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  senderEmail: z.string().email().optional(),
  startTime: z.string().or(z.date()).optional(),
  delayBetweenEmailsSeconds: z.number().min(0).max(3600).optional(),
  hourlyLimit: z.number().min(1).max(10000).optional(),
});

export const scheduleEmailsHandler = async (req: Request, res: Response) => {
  try {
    const validated = scheduleSchema.parse(req.body);
    const result = await emailService.scheduleCampaign(validated);
    res.status(201).json({
      success: true,
      message: `Successfully scheduled ${result.totalScheduled} email(s)`,
      data: result,
    });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({ success: false, errors: err.errors });
    }
    res.status(500).json({ success: false, error: err.message });
  }
};

export const uploadLeadsHandler = async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const fileContent = req.file.buffer.toString('utf-8');
    const emails = new Set<string>();
    const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;

    // Check if it's CSV
    if (req.file.originalname.endsWith('.csv')) {
      const stream = Readable.from(req.file.buffer);
      await new Promise<void>((resolve, reject) => {
        stream
          .pipe(csvParser())
          .on('data', (row) => {
            for (const key of Object.keys(row)) {
              const val = row[key];
              if (typeof val === 'string') {
                const matches = val.match(emailRegex);
                if (matches) {
                  matches.forEach((e) => emails.add(e.toLowerCase().trim()));
                }
              }
            }
          })
          .on('end', () => resolve())
          .on('error', (err) => reject(err));
      });
    } else {
      // Plain text parsing
      const matches = fileContent.match(emailRegex);
      if (matches) {
        matches.forEach((e) => emails.add(e.toLowerCase().trim()));
      }
    }

    const emailList = Array.from(emails);
    res.json({
      success: true,
      count: emailList.length,
      emails: emailList,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getScheduledEmailsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = req.query.search as string;

    const data = await emailService.getScheduledEmails({ page, limit, search });
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getSentEmailsHandler = async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string, 10) || 1;
    const limit = parseInt(req.query.limit as string, 10) || 20;
    const search = req.query.search as string;

    const data = await emailService.getSentEmails({ page, limit, search });
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const searchEmailsHandler = async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const status = req.query.status as string;

    const data = await emailService.searchEmails(query, status);
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const cancelEmailHandler = async (req: Request, res: Response) => {
  try {
    const emailId = req.params.id;
    const data = await emailService.cancelEmail(emailId);
    res.json({ success: true, message: 'Email cancelled successfully', data });
  } catch (err: any) {
    res.status(400).json({ success: false, error: err.message });
  }
};

export const getMetricsHandler = async (_req: Request, res: Response) => {
  try {
    const data = await emailService.getMetrics();
    res.json({ success: true, ...data });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
