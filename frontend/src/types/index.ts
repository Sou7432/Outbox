export type EmailStatus = 'SCHEDULED' | 'PROCESSING' | 'SENT' | 'FAILED' | 'DELAYED' | 'CANCELLED';

export interface EmailRecord {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  senderEmail: string;
  scheduledAt: string;
  sentAt: string | null;
  status: EmailStatus;
  jobId: string | null;
  error: string | null;
  etherealPreviewUrl: string | null;
  attemptCount: number;
  campaignId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Sender {
  id: string;
  name: string;
  email: string;
  hourlyLimit: number;
  active: boolean;
}

export interface SlackStatus {
  connected: boolean;
  integration: {
    id: string;
    teamName: string;
    channel: string;
    connectedAt: string;
    hasWebhook: boolean;
  } | null;
}

export interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

export interface SystemMetrics {
  stats: {
    scheduled: number;
    sent: number;
    failed: number;
    delayed: number;
    total: number;
  };
  queue: {
    delayed: number;
    waiting: number;
    active: number;
    completed: number;
    failed: number;
  };
  elasticsearch: boolean;
}
