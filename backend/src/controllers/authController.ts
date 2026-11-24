import { Request, Response } from 'express';
import { prisma } from '../lib/prisma.js';

export const googleAuthHandler = async (req: Request, res: Response) => {
  try {
    const { email, name, picture } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, error: 'Email is required' });
    }

    const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: name || email.split('@')[0],
        picture: picture || null,
      },
      create: {
        email,
        name: name || email.split('@')[0],
        picture: picture || null,
      },
    });

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        picture: user.picture,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getMeHandler = async (_req: Request, res: Response) => {
  try {
    const user = await prisma.user.findFirst({
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      success: true,
      user: user || {
        id: 'default-user',
        email: 'alex@reachinbox.test',
        name: 'Alex Rivera',
        picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
