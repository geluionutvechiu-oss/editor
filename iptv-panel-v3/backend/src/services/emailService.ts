import nodemailer from 'nodemailer';
import prisma from '../lib/prisma';
import logger from '../lib/logger';

async function getSmtpConfig() {
  const settings = await prisma.setting.findMany({
    where: { key: { in: ['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'smtp_from', 'smtp_secure'] } },
  });
  const cfg: Record<string, string> = {};
  settings.forEach((s) => { cfg[s.key] = String((s.value as { value: string }).value ?? s.value); });
  return cfg;
}

async function createTransport() {
  const cfg = await getSmtpConfig();
  return nodemailer.createTransport({
    host: cfg.smtp_host || process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(cfg.smtp_port || process.env.SMTP_PORT || '587'),
    secure: (cfg.smtp_secure || process.env.SMTP_SECURE || 'false') === 'true',
    auth: {
      user: cfg.smtp_user || process.env.SMTP_USER || '',
      pass: cfg.smtp_pass || process.env.SMTP_PASS || '',
    },
  });
}

export async function sendTestEmail(to: string): Promise<void> {
  const transport = await createTransport();
  await transport.sendMail({
    from: process.env.SMTP_FROM || 'noreply@iptv-panel.com',
    to,
    subject: 'IPTV Panel — Test Email',
    html: '<h1>Test email works!</h1><p>Your SMTP configuration is correct.</p>',
  });
}

export async function sendWelcomeEmail(client: { username: string; password: string; m3uUrl?: string | null }, to: string): Promise<void> {
  try {
    const transport = await createTransport();
    await transport.sendMail({
      from: process.env.SMTP_FROM || 'noreply@iptv-panel.com',
      to,
      subject: 'Welcome to IPTV Panel',
      html: `
        <h2>Welcome, ${client.username}!</h2>
        <p>Your IPTV subscription is ready.</p>
        <p><strong>Username:</strong> ${client.username}</p>
        <p><strong>Password:</strong> ${client.password}</p>
        ${client.m3uUrl ? `<p><strong>M3U URL:</strong> ${client.m3uUrl}</p>` : ''}
      `,
    });
  } catch (err) {
    logger.warn('Failed to send welcome email', { err });
  }
}

export async function sendExpiryWarning(client: { username: string }, to: string, daysLeft: number): Promise<void> {
  try {
    const transport = await createTransport();
    await transport.sendMail({
      from: process.env.SMTP_FROM || 'noreply@iptv-panel.com',
      to,
      subject: `IPTV Subscription expiring in ${daysLeft} days`,
      html: `
        <h2>Subscription Expiry Warning</h2>
        <p>Hi ${client.username}, your subscription expires in <strong>${daysLeft} days</strong>.</p>
        <p>Please contact your provider to renew.</p>
      `,
    });
  } catch (err) {
    logger.warn('Failed to send expiry warning', { err });
  }
}
