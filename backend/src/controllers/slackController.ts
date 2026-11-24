import { Request, Response } from 'express';
import axios from 'axios';
import { prisma } from '../lib/prisma.js';
import { config } from '../config/index.js';
import { sendSlackNotification } from '../lib/slack.js';

export const getSlackStatusHandler = async (_req: Request, res: Response) => {
  try {
    const integration = await prisma.slackIntegration.findFirst({
      where: { active: true },
      orderBy: { updatedAt: 'desc' },
    });

    res.json({
      success: true,
      connected: !!integration,
      integration: integration
        ? {
            id: integration.id,
            teamName: integration.teamName || 'Workspace',
            channel: integration.channel || 'Default Channel',
            connectedAt: integration.connectedAt,
            hasWebhook: !!integration.webhookUrl,
          }
        : null,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const saveSlackWebhookHandler = async (req: Request, res: Response) => {
  try {
    const { webhookUrl, channel } = req.body;
    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return res.status(400).json({ success: false, error: 'Valid webhookUrl is required' });
    }

    // Deactivate previous integrations
    await prisma.slackIntegration.updateMany({
      data: { active: false },
    });

    const integration = await prisma.slackIntegration.create({
      data: {
        webhookUrl,
        channel: channel || '#reachinbox-alerts',
        teamName: 'Custom Webhook',
        active: true,
      },
    });

    // Send a welcome test message
    await sendSlackNotification({
      text: '🎉 *ReachInbox Scheduler connected successfully!* Rate limit alerts will be posted here.',
    });

    res.json({
      success: true,
      message: 'Slack Webhook connected and verified!',
      integration,
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const startSlackOAuthHandler = (_req: Request, res: Response) => {
  if (!config.slackClientId) {
    return res.status(400).json({
      success: false,
      error: 'SLACK_CLIENT_ID not configured in environment variables. You can connect via Webhook directly.',
    });
  }

  const scopes = 'chat:write,incoming-webhook';
  const slackAuthUrl = `https://slack.com/oauth/v2/authorize?client_id=${config.slackClientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(
    config.slackRedirectUri
  )}`;

  res.redirect(slackAuthUrl);
};

export const slackOAuthCallbackHandler = async (req: Request, res: Response) => {
  try {
    const { code, error } = req.query;

    if (error) {
      return res.redirect(`${config.frontendUrl}/?slack=denied&error=${error}`);
    }

    if (!code) {
      return res.redirect(`${config.frontendUrl}/?slack=missing_code`);
    }

    // Exchange code for access token
    const tokenResponse = await axios.post(
      'https://slack.com/api/oauth.v2.access',
      new URLSearchParams({
        client_id: config.slackClientId,
        client_secret: config.slackClientSecret,
        code: code as string,
        redirect_uri: config.slackRedirectUri,
      }).toString(),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
    );

    const data = tokenResponse.data;
    if (!data.ok) {
      return res.redirect(`${config.frontendUrl}/?slack=failed&reason=${encodeURIComponent(data.error)}`);
    }

    // Deactivate existing
    await prisma.slackIntegration.updateMany({
      data: { active: false },
    });

    await prisma.slackIntegration.create({
      data: {
        accessToken: data.access_token,
        channel: data.incoming_webhook?.channel || '#reachinbox-alerts',
        webhookUrl: data.incoming_webhook?.url || null,
        teamId: data.team?.id,
        teamName: data.team?.name,
        active: true,
      },
    });

    res.redirect(`${config.frontendUrl}/?slack=connected`);
  } catch (err: any) {
    console.error('Slack OAuth error:', err.message);
    res.redirect(`${config.frontendUrl}/?slack=error`);
  }
};

export const disconnectSlackHandler = async (_req: Request, res: Response) => {
  try {
    await prisma.slackIntegration.updateMany({
      data: { active: false },
    });
    res.json({ success: true, message: 'Slack disconnected successfully' });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const testSlackAlertHandler = async (_req: Request, res: Response) => {
  try {
    const success = await sendSlackNotification({
      text: '🧪 *ReachInbox Test Notification*: Slack connection is live and working properly!',
    });

    if (success) {
      res.json({ success: true, message: 'Test alert sent successfully to Slack!' });
    } else {
      res.status(400).json({
        success: false,
        error: 'Slack is not connected. Please connect via OAuth or add a Webhook URL first.',
      });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
};
