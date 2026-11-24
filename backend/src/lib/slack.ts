import axios from 'axios';
import { prisma } from './prisma.js';

export interface SlackMessagePayload {
  text: string;
  blocks?: any[];
}

export async function getActiveSlackIntegration() {
  try {
    const integration = await prisma.slackIntegration.findFirst({
      where: { active: true },
      orderBy: { updatedAt: 'desc' },
    });
    return integration;
  } catch (error: any) {
    console.warn('Could not query SlackIntegration:', error.message);
    return null;
  }
}

export async function sendSlackNotification(payload: SlackMessagePayload): Promise<boolean> {
  try {
    const integration = await getActiveSlackIntegration();
    if (!integration) {
      console.log('ℹ️ Slack is not connected. Skipping notification.');
      return false;
    }

    // If incoming webhook is available
    if (integration.webhookUrl) {
      await axios.post(integration.webhookUrl, payload, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });
      console.log('🔔 Live Slack notification sent via Webhook!');
      return true;
    }

    // If OAuth access token is available
    if (integration.accessToken && integration.channel) {
      await axios.post(
        'https://slack.com/api/chat.postMessage',
        {
          channel: integration.channel,
          text: payload.text,
          blocks: payload.blocks,
        },
        {
          headers: {
            'Content-Type': 'application/json; charset=utf-8',
            Authorization: `Bearer ${integration.accessToken}`,
          },
          timeout: 5000,
        }
      );
      console.log('🔔 Live Slack notification sent via Bot API!');
      return true;
    }

    console.log('ℹ️ Slack credentials incomplete. Notification skipped.');
    return false;
  } catch (error: any) {
    console.error('❌ Failed to dispatch Slack notification:', error.response?.data || error.message);
    return false;
  }
}

/**
 * Dispatches an immediate Slack notification when a sender's rate limit is reached.
 */
export async function sendRateLimitSlackAlert(params: {
  senderEmail: string;
  hourlyLimit: number;
  currentCount: number;
  delayedUntil: Date;
  affectedRecipient: string;
  subject: string;
}): Promise<boolean> {
  const { senderEmail, hourlyLimit, currentCount, delayedUntil, affectedRecipient, subject } = params;

  const formattedTime = delayedUntil.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });

  const payload: SlackMessagePayload = {
    text: `⚠️ *ReachInbox Rate Limit Alert*: Sender \`${senderEmail}\` hit hourly threshold (${currentCount}/${hourlyLimit} emails/hr).`,
    blocks: [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: '🚨 Email Rate Limit Reached',
          emoji: true,
        },
      },
      {
        type: 'section',
        fields: [
          {
            type: 'mrkdwn',
            text: `*Sender Account:*\n\`${senderEmail}\``,
          },
          {
            type: 'mrkdwn',
            text: `*Hourly Threshold:*\n*${hourlyLimit} emails/hour*`,
          },
          {
            type: 'mrkdwn',
            text: `*Status:*\n*Delayed / Postponed* (no loss)`,
          },
          {
            type: 'mrkdwn',
            text: `*Next Sending Window:*\n*${formattedTime}*`,
          },
        ],
      },
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Queued Email:* "${subject}" to \`${affectedRecipient}\` has been rescheduled to preserve queue order without dropping.`,
        },
      },
      {
        type: 'context',
        elements: [
          {
            type: 'mrkdwn',
            text: `ReachInbox Scheduler • Automated Worker Protection • System Time: ${new Date().toISOString()}`,
          },
        ],
      },
    ],
  };

  return sendSlackNotification(payload);
}
