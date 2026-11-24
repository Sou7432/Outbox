import { prisma } from '../lib/prisma.js';
import { enqueueEmailJob } from '../queue/emailQueue.js';
import { indexEmailInElastic } from '../lib/elasticsearch.js';

async function main() {
  console.log('🌱 Seeding ReachInbox scheduler database...');

  // 1. Senders
  const senders = [
    {
      name: 'Alex Rivera (Growth)',
      email: 'alex@reachinbox.test',
      hourlyLimit: 50,
    },
    {
      name: 'Sarah Chen (Outreach)',
      email: 'sarah@outbox.ai',
      hourlyLimit: 30,
    },
    {
      name: 'ReachInbox AI Dispatcher',
      email: 'ai-outreach@reachinbox.ai',
      hourlyLimit: 100,
    },
  ];

  for (const s of senders) {
    await prisma.sender.upsert({
      where: { email: s.email },
      update: { name: s.name, hourlyLimit: s.hourlyLimit },
      create: s,
    });
  }
  console.log('✅ Seeded 3 default email senders.');

  // 2. User
  await prisma.user.upsert({
    where: { email: 'alex@reachinbox.test' },
    update: {},
    create: {
      email: 'alex@reachinbox.test',
      name: 'Alex Rivera',
      picture: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    },
  });
  console.log('✅ Seeded demo user.');

  // 3. Sample Sent Emails
  const sentEmails = [
    {
      recipient: 'john.smith@techcorp.io',
      subject: 'Transform your cold outreach pipeline with ReachInbox AI',
      body: '<p>Hi John,<br><br>Saw your recent growth at TechCorp! ReachInbox can double your reply rates automatically.<br><br>Best,<br>Alex</p>',
      senderEmail: 'alex@reachinbox.test',
      scheduledAt: new Date(Date.now() - 3600000 * 2),
      sentAt: new Date(Date.now() - 3600000 * 2 + 3000),
      status: 'SENT' as const,
      etherealPreviewUrl: 'https://ethereal.email/message/Xw99Z12_demo_sample',
    },
    {
      recipient: 'elena.rostova@venturecap.com',
      subject: 'Quick question regarding Outbox Labs portfolio tools',
      body: '<p>Hey Elena,<br><br>Following up on our discussion regarding automated lead enrichment.<br><br>Cheers,<br>Sarah</p>',
      senderEmail: 'sarah@outbox.ai',
      scheduledAt: new Date(Date.now() - 3600000),
      sentAt: new Date(Date.now() - 3600000 + 4000),
      status: 'SENT' as const,
      etherealPreviewUrl: 'https://ethereal.email/message/Yk88M44_demo_sample',
    },
  ];

  for (const email of sentEmails) {
    const created = await prisma.email.create({ data: email });
    await indexEmailInElastic(created);
  }
  console.log('✅ Seeded sample sent emails.');

  // 4. Sample Scheduled Future Emails
  const futureEmails = [
    {
      recipient: 'david.kim@hypergrowth.co',
      subject: 'Automating high-intent lead engagement',
      body: '<p>Hello David,<br><br>Would love to share how teams are seeing 3x reply rates using ReachInbox sequences.<br><br>Regards,<br>Alex</p>',
      senderEmail: 'alex@reachinbox.test',
      scheduledAt: new Date(Date.now() + 10 * 60 * 1000), // 10 mins in future
      status: 'SCHEDULED' as const,
    },
    {
      recipient: 'marcus.vance@saasinnovators.net',
      subject: 'AI-driven Cold Email Sequences for Outbox Labs',
      body: '<p>Hi Marcus,<br><br>Here is the personalized sequence deck we talked about.<br><br>Best,<br>Sarah</p>',
      senderEmail: 'sarah@outbox.ai',
      scheduledAt: new Date(Date.now() + 25 * 60 * 1000), // 25 mins in future
      status: 'SCHEDULED' as const,
    },
  ];

  for (const email of futureEmails) {
    const created = await prisma.email.create({ data: email });
    await prisma.email.update({ where: { id: created.id }, data: { jobId: created.id } });
    await enqueueEmailJob(
      {
        emailId: created.id,
        recipient: email.recipient,
        subject: email.subject,
        body: email.body,
        senderEmail: email.senderEmail,
        scheduledAt: email.scheduledAt.toISOString(),
      },
      email.scheduledAt.getTime() - Date.now()
    );
    await indexEmailInElastic(created);
  }
  console.log('✅ Seeded sample scheduled future emails into BullMQ queue.');

  console.log('🎉 Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
