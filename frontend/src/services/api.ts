import axios from 'axios';
import { EmailRecord, Sender, SlackStatus, User, SystemMetrics } from '../types';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Emails
  getScheduledEmails: async (page = 1, limit = 20, search = '') => {
    const res = await apiClient.get<{
      success: boolean;
      emails: EmailRecord[];
      total: number;
      page: number;
      totalPages: number;
    }>('/emails/scheduled', { params: { page, limit, search } });
    return res.data;
  },

  getSentEmails: async (page = 1, limit = 20, search = '') => {
    const res = await apiClient.get<{
      success: boolean;
      emails: EmailRecord[];
      total: number;
      page: number;
      totalPages: number;
    }>('/emails/sent', { params: { page, limit, search } });
    return res.data;
  },

  scheduleEmails: async (data: {
    recipients: string[];
    subject: string;
    body: string;
    senderEmail?: string;
    startTime?: string;
    delayBetweenEmailsSeconds?: number;
    hourlyLimit?: number;
  }) => {
    const res = await apiClient.post('/emails/schedule', data);
    return res.data;
  },

  uploadLeadsFile: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await apiClient.post<{
      success: boolean;
      count: number;
      emails: string[];
    }>('/emails/upload-leads', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },

  cancelEmail: async (emailId: string) => {
    const res = await apiClient.delete(`/emails/${emailId}`);
    return res.data;
  },

  getMetrics: async () => {
    const res = await apiClient.get<{ success: boolean } & SystemMetrics>('/emails/metrics');
    return res.data;
  },

  searchEmails: async (query: string, status?: string) => {
    const res = await apiClient.get<{ success: boolean; source: string; emails: EmailRecord[] }>(
      '/emails/search',
      { params: { q: query, status } }
    );
    return res.data;
  },

  // Senders
  getSenders: async () => {
    const res = await apiClient.get<{ success: boolean; senders: Sender[] }>('/senders');
    return res.data;
  },

  createSender: async (sender: { name: string; email: string; hourlyLimit?: number }) => {
    const res = await apiClient.post('/senders', sender);
    return res.data;
  },

  // Slack
  getSlackStatus: async () => {
    const res = await apiClient.get<SlackStatus & { success: boolean }>('/slack/status');
    return res.data;
  },

  saveSlackWebhook: async (webhookUrl: string, channel?: string) => {
    const res = await apiClient.post('/slack/webhook', { webhookUrl, channel });
    return res.data;
  },

  disconnectSlack: async () => {
    const res = await apiClient.post('/slack/disconnect');
    return res.data;
  },

  testSlackAlert: async () => {
    const res = await apiClient.post('/slack/test');
    return res.data;
  },

  // Auth
  googleAuth: async (user: { email: string; name: string; picture?: string }) => {
    const res = await apiClient.post<{ success: boolean; user: User }>('/auth/google', user);
    return res.data;
  },

  getMe: async () => {
    const res = await apiClient.get<{ success: boolean; user: User }>('/auth/me');
    return res.data;
  },
};
