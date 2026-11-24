import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';

export const listSendersHandler = async (_req: Request, res: Response) => {
  try {
    let senders = await prisma.sender.findMany({
      where: { active: true },
      orderBy: { createdAt: 'asc' },
    });

    // If no senders in DB, ensure default sender exists
    if (senders.length === 0) {
      const defaultSender = await prisma.sender.create({
        data: {
          email: config.defaultSenderEmail,
          name: config.defaultSenderName,
          hourlyLimit: config.maxEmailsPerHourPerSender,
        },
      });
      senders = [defaultSender];
    }

    res.json({ success: true, senders });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const createSenderHandler = async (req: Request, res: Response) => {
  try {
    const { email, name, hourlyLimit } = req.body;
    if (!email || !name) {
      return res.status(400).json({ success: false, error: 'Name and valid email are required' });
    }

    const sender = await prisma.sender.upsert({
      where: { email },
      update: {
        name,
        hourlyLimit: hourlyLimit || config.maxEmailsPerHourPerSender,
        active: true,
      },
      create: {
        email,
        name,
        hourlyLimit: hourlyLimit || config.maxEmailsPerHourPerSender,
      },
    });

    res.status(201).json({ success: true, sender });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const updateSenderHandler = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, hourlyLimit, active } = req.body;

    const sender = await prisma.sender.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(hourlyLimit && { hourlyLimit }),
        ...(typeof active === 'boolean' && { active }),
      },
    });

    res.json({ success: true, sender });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
