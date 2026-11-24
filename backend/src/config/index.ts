import dotenv from 'dotenv';
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  databaseUrl: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/reachinbox_scheduler?schema=public',
  elasticsearchUrl: process.env.ELASTICSEARCH_URL || 'http://localhost:9200',
  
  // Rate limiting & Worker concurrency
  workerConcurrency: parseInt(process.env.WORKER_CONCURRENCY || '5', 10),
  emailDelayMs: parseInt(process.env.EMAIL_DELAY_MS || '2000', 10), // 2 seconds delay between sends
  maxEmailsPerHourPerSender: parseInt(process.env.MAX_EMAILS_PER_HOUR_PER_SENDER || '50', 10),
  globalMaxEmailsPerHour: parseInt(process.env.MAX_EMAILS_PER_HOUR || '200', 10),
  
  // Default Sender
  defaultSenderEmail: process.env.DEFAULT_SENDER_EMAIL || 'outreach@reachinbox.test',
  defaultSenderName: process.env.DEFAULT_SENDER_NAME || 'ReachInbox Growth',
  
  // Ethereal / SMTP
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: parseInt(process.env.SMTP_PORT || '587', 10),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  
  // Slack OAuth & Alerts
  slackClientId: process.env.SLACK_CLIENT_ID || '',
  slackClientSecret: process.env.SLACK_CLIENT_SECRET || '',
  slackRedirectUri: process.env.SLACK_REDIRECT_URI || 'http://localhost:5000/api/slack/oauth/callback',
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5173',
};
