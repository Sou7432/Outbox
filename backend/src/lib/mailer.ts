import nodemailer from 'nodemailer';
import { config } from '../config/index.js';

let cachedTransporter: nodemailer.Transporter | null = null;
let etherealAccount: { user: string; pass: string; web?: string } | null = null;

export async function getTransporter(): Promise<nodemailer.Transporter> {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  // If user provided custom SMTP credentials
  if (config.smtpHost && config.smtpUser && config.smtpPass) {
    cachedTransporter = nodemailer.createTransport({
      host: config.smtpHost,
      port: config.smtpPort,
      secure: config.smtpPort === 465,
      auth: {
        user: config.smtpUser,
        pass: config.smtpPass,
      },
    });
    console.log(`📧 Configured custom SMTP transporter for ${config.smtpHost}:${config.smtpPort}`);
    return cachedTransporter;
  }

  // Otherwise, automatically create an Ethereal test account
  try {
    const testAccount = await nodemailer.createTestAccount();
    etherealAccount = {
      user: testAccount.user,
      pass: testAccount.pass,
      web: testAccount.web,
    };

    cachedTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });

    console.log('✨ Created new Ethereal Email test account:');
    console.log(`   User: ${testAccount.user}`);
    console.log(`   Web Interface: ${testAccount.web}`);
    return cachedTransporter;
  } catch (error: any) {
    console.error('Failed to create Ethereal test account:', error.message);
    throw error;
  }
}

export interface SendEmailPayload {
  from?: string;
  senderName?: string;
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

export interface SendEmailResult {
  messageId: string;
  previewUrl: string | false;
}

export async function sendEmail(payload: SendEmailPayload): Promise<SendEmailResult> {
  const transporter = await getTransporter();

  const senderAddress = payload.from || config.defaultSenderEmail;
  const senderDisplayName = payload.senderName || config.defaultSenderName;

  const mailOptions = {
    from: `"${senderDisplayName}" <${senderAddress}>`,
    to: payload.to,
    subject: payload.subject,
    text: payload.text || payload.html?.replace(/<[^>]*>?/gm, '') || '',
    html: payload.html || `<p>${payload.text}</p>`,
  };

  const info = await transporter.sendMail(mailOptions);
  const previewUrl = nodemailer.getTestMessageUrl(info);

  if (previewUrl) {
    console.log(`📬 Email sent to ${payload.to}! Preview URL: ${previewUrl}`);
  } else {
    console.log(`📬 Email sent to ${payload.to}! Message ID: ${info.messageId}`);
  }

  return {
    messageId: info.messageId,
    previewUrl,
  };
}

export function getEtherealAccountInfo() {
  return etherealAccount;
}
