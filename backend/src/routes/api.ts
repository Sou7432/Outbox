import { Router } from 'express';
import multer from 'multer';
import {
  scheduleEmailsHandler,
  uploadLeadsHandler,
  getScheduledEmailsHandler,
  getSentEmailsHandler,
  searchEmailsHandler,
  cancelEmailHandler,
  getMetricsHandler,
} from '../controllers/emailController.js';
import {
  getSlackStatusHandler,
  saveSlackWebhookHandler,
  startSlackOAuthHandler,
  slackOAuthCallbackHandler,
  disconnectSlackHandler,
  testSlackAlertHandler,
} from '../controllers/slackController.js';
import {
  listSendersHandler,
  createSenderHandler,
  updateSenderHandler,
} from '../controllers/senderController.js';
import {
  googleAuthHandler,
  getMeHandler,
} from '../controllers/authController.js';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
});

export const apiRouter = Router();

// Emails
apiRouter.post('/emails/schedule', scheduleEmailsHandler);
apiRouter.post('/emails/upload-leads', upload.single('file'), uploadLeadsHandler);
apiRouter.get('/emails/scheduled', getScheduledEmailsHandler);
apiRouter.get('/emails/sent', getSentEmailsHandler);
apiRouter.get('/emails/search', searchEmailsHandler);
apiRouter.delete('/emails/:id', cancelEmailHandler);
apiRouter.get('/emails/metrics', getMetricsHandler);

// Senders
apiRouter.get('/senders', listSendersHandler);
apiRouter.post('/senders', createSenderHandler);
apiRouter.patch('/senders/:id', updateSenderHandler);

// Slack
apiRouter.get('/slack/status', getSlackStatusHandler);
apiRouter.post('/slack/webhook', saveSlackWebhookHandler);
apiRouter.get('/slack/oauth/start', startSlackOAuthHandler);
apiRouter.get('/slack/oauth/callback', slackOAuthCallbackHandler);
apiRouter.post('/slack/disconnect', disconnectSlackHandler);
apiRouter.post('/slack/test', testSlackAlertHandler);

// Auth
apiRouter.post('/auth/google', googleAuthHandler);
apiRouter.get('/auth/me', getMeHandler);

export default apiRouter;
