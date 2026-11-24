import express from 'express';
import cors from 'cors';
import { config } from './config/index.js';
import { setupBullBoard } from './queue/board.js';
import { apiRouter } from './routes/api.js';
import { checkElasticConnection } from './lib/elasticsearch.js';
import { getTransporter } from './lib/mailer.js';
import { emailService } from './services/emailService.js';
import './queue/emailWorker.js'; // Start background worker

const app = express();

// Middlewares
app.use(
  cors({
    origin: '*',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// BullMQ Live Dashboard UI
const bullBoardRouter = setupBullBoard();
app.use('/admin/queues', bullBoardRouter);

// API Routes
app.use('/api', apiRouter);

// Health check
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'reachinbox-scheduler-service',
  });
});

// Start Server & Initialize Services
async function bootstrap() {
  try {
    // 1. Initialize Ethereal Mailer transporter
    await getTransporter();

    // 2. Check Elasticsearch connection
    await checkElasticConnection();

    // 3. Persistent Queue Recovery (Double persistence check)
    await emailService.recoverPendingJobsOnRestart();

    // 4. Start HTTP Server
    app.listen(config.port, () => {
      console.log(`\n==================================================`);
      console.log(`🚀 ReachInbox Email Scheduler API is running!`);
      console.log(`📡 URL: http://localhost:${config.port}`);
      console.log(`📊 BullMQ Live Queue Dashboard: http://localhost:${config.port}/admin/queues`);
      console.log(`⚡ Concurrency: ${config.workerConcurrency} workers`);
      console.log(`⏱️ Minimum Delay: ${config.emailDelayMs}ms between sends`);
      console.log(`🛡️ Rate Limit: ${config.maxEmailsPerHourPerSender} emails/hr per sender`);
      console.log(`==================================================\n`);
    });
  } catch (err: any) {
    console.error('Fatal bootstrap error:', err);
    process.exit(1);
  }
}

bootstrap();

export default app;
