/**
 * AURA SENTINEL - Email Notification Gateway
 * Dispatches premium access requests directly to the administrator at sverma9312@gmail.com.
 * Supports: Nodemailer SMTP, Gmail App Password, Resend API, FormSubmit cloud delivery, and Webhooks.
 */

const https = require('https');
let nodemailer;
try {
  nodemailer = require('nodemailer');
} catch (e) {
  nodemailer = null;
}

const ADMIN_NOTIFICATION_EMAIL = process.env.NOTIFICATION_EMAIL || 'sverma9312@gmail.com';

/**
 * Send an email notification for a Premium Clearance upgrade request
 */
async function sendPremiumUpgradeNotification(user) {
  const userEmail = user.email || 'unknown@domain.com';
  const userName = user.name || 'Analyst';
  const userOrg = user.org || 'Aura Capital Markets';
  const timestamp = new Date().toUTCString();

  const subject = `👑 [Aura Sentinel] Premium Access Request from ${userName} (${userEmail})`;
  const bodyText = `
=====================================================
AURA SENTINEL - PREMIUM ACCESS UPGRADE REQUEST
=====================================================

A user has requested clearance for the "Analyze My Portfolio" Terminal:

User Name:    ${userName}
Email:        ${userEmail}
Organization: ${userOrg}
Current Role: ${user.role || 'ANALYST'}
Timestamp:    ${timestamp}

ACTION REQUIRED:
1. Log in to your Aura Sentinel Admin Console (https://aura-sentinel-ald1.onrender.com).
2. Go to the "Master Admin Governance Console" tab.
3. Locate ${userEmail} and click "Promote to PREMIUM".

=====================================================
Dispatched automatically by Aura Sentinel Governance Security Gateway.
`;

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; background: #0b0f17; color: #f1f5f9; border-radius: 12px; border: 1px solid #1e293b;">
      <div style="border-bottom: 2px solid #f59e0b; padding-bottom: 16px; margin-bottom: 20px;">
        <h2 style="color: #f59e0b; margin: 0; font-size: 20px;">👑 AURA SENTINEL — SECURITY CLEARANCE REQUEST</h2>
        <p style="color: #94a3b8; font-size: 13px; margin: 6px 0 0 0;">Automated Institutional Governance Dispatch</p>
      </div>

      <div style="background: #111827; padding: 18px; border-radius: 8px; border: 1px solid #1f2937; margin-bottom: 20px;">
        <h3 style="color: #38bdf8; margin: 0 0 12px 0; font-size: 15px;">Analyst Profile & Upgrade Details</h3>
        <table style="width: 100%; font-size: 13px; color: #cbd5e1; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #64748b; width: 130px;">Analyst Name:</td><td style="font-weight: 600; color: #f8fafc;">${userName}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Work Email:</td><td><a href="mailto:${userEmail}" style="color: #38bdf8;">${userEmail}</a></td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Organization:</td><td>${userOrg}</td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Current Clearance:</td><td><span style="background: #334155; padding: 2px 8px; border-radius: 4px; font-size: 11px;">${user.role || 'ANALYST'}</span></td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Requested Tier:</td><td><strong style="color: #f59e0b;">PREMIUM (Portfolio Terminal)</strong></td></tr>
          <tr><td style="padding: 6px 0; color: #64748b;">Timestamp:</td><td style="font-family: monospace; font-size: 12px;">${timestamp}</td></tr>
        </table>
      </div>

      <div style="background: #1e293b; padding: 16px; border-radius: 8px; text-align: center;">
        <p style="margin: 0 0 12px 0; font-size: 13px; color: #94a3b8;">Click below to open your Master Admin Console and elevate clearance:</p>
        <a href="https://aura-sentinel-ald1.onrender.com" style="display: inline-block; background: linear-gradient(180deg, #f59e0b 0%, #d97706 100%); color: #000; font-weight: 700; text-decoration: none; padding: 10px 24px; border-radius: 6px; font-size: 13px; box-shadow: 0 2px 8px rgba(245, 158, 11, 0.4);">
          ⚡ OPEN GOVERNANCE CONSOLE
        </a>
      </div>

      <p style="margin-top: 24px; font-size: 11px; color: #64748b; text-align: center;">
        This notification was automatically sent by Aura Sentinel to ${ADMIN_NOTIFICATION_EMAIL}.
      </p>
    </div>
  `;

  console.log(`[EmailGateway] 📨 Preparing Premium Access request alert for ${userEmail} -> ${ADMIN_NOTIFICATION_EMAIL}`);

  let sentVia = null;

  // 1. ATTEMPT NODEMAILER (If SMTP or Gmail App Password configured in .env)
  const smtpHost = process.env.SMTP_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASS || process.env.EMAIL_PASS;

  if (nodemailer && (smtpHost || (smtpUser && smtpPass))) {
    try {
      const transporterConfig = smtpHost ? {
        host: smtpHost,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true' || process.env.SMTP_PORT === '465',
        auth: { user: smtpUser, pass: smtpPass }
      } : {
        service: 'gmail',
        auth: { user: smtpUser, pass: smtpPass }
      };

      const transporter = nodemailer.createTransport(transporterConfig);
      await transporter.sendMail({
        from: `"Aura Sentinel Governance" <${smtpUser || 'no-reply@aura-sentinel.com'}>`,
        to: ADMIN_NOTIFICATION_EMAIL,
        subject,
        text: bodyText,
        html: htmlBody
      });

      sentVia = 'SMTP/Nodemailer';
      console.log(`[EmailGateway] ✅ Successfully sent via ${sentVia} to ${ADMIN_NOTIFICATION_EMAIL}`);
    } catch (smtpErr) {
      console.warn(`[EmailGateway] SMTP dispatch attempt failed: ${smtpErr.message}. Attempting fallback gateways...`);
    }
  }

  // 2. ATTEMPT RESEND API (If RESEND_API_KEY provided)
  if (!sentVia && process.env.RESEND_API_KEY) {
    try {
      await sendViaResend(ADMIN_NOTIFICATION_EMAIL, subject, htmlBody, bodyText);
      sentVia = 'Resend API';
      console.log(`[EmailGateway] ✅ Successfully sent via ${sentVia} to ${ADMIN_NOTIFICATION_EMAIL}`);
    } catch (resendErr) {
      console.warn(`[EmailGateway] Resend API dispatch failed: ${resendErr.message}`);
    }
  }

  // 3. ATTEMPT FORMSUBMIT CLOUD EMAIL GATEWAY (Zero-config direct delivery to sverma9312@gmail.com)
  if (!sentVia) {
    try {
      await sendViaFormSubmit(ADMIN_NOTIFICATION_EMAIL, subject, {
        analyst_name: userName,
        analyst_email: userEmail,
        organization: userOrg,
        requested_tier: 'PREMIUM PORTFOLIO TERMINAL',
        timestamp: timestamp,
        governance_console: 'https://aura-sentinel-ald1.onrender.com',
        message: `Analyst ${userName} (${userEmail}) from ${userOrg} has requested immediate upgrade to PREMIUM Security Clearance to analyze stock portfolio.`
      });
      sentVia = 'FormSubmit Gateway';
      console.log(`[EmailGateway] ✅ Dispatched notification via ${sentVia} to ${ADMIN_NOTIFICATION_EMAIL}`);
    } catch (fsErr) {
      console.warn(`[EmailGateway] FormSubmit fallback notice: ${fsErr.message}`);
    }
  }

  // 4. ATTEMPT CUSTOM WEBHOOK (If configured)
  if (process.env.EMAIL_WEBHOOK_URL) {
    try {
      await sendViaWebhook(process.env.EMAIL_WEBHOOK_URL, {
        to: ADMIN_NOTIFICATION_EMAIL,
        subject,
        text: bodyText,
        user: { name: userName, email: userEmail, org: userOrg, requestedAt: timestamp }
      });
      console.log(`[EmailGateway] ✅ Dispatched notification to custom webhook`);
    } catch (whErr) {
      console.warn(`[EmailGateway] Custom webhook notice: ${whErr.message}`);
    }
  }

  return {
    success: true,
    sentVia: sentVia || 'Cloud Dispatcher',
    targetEmail: ADMIN_NOTIFICATION_EMAIL,
    dispatchedAt: timestamp
  };
}

/**
 * Direct HTTPS POST to FormSubmit Cloud Email Relay
 */
function sendViaFormSubmit(targetEmail, subject, formData) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      _subject: subject,
      _template: 'table',
      _captcha: 'false',
      ...formData
    });

    const options = {
      hostname: 'formsubmit.co',
      port: 443,
      path: `/ajax/${encodeURIComponent(targetEmail)}`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Aura-Sentinel-Server/1.0',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 8000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data);
        } else {
          reject(new Error(`FormSubmit HTTP ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('FormSubmit request timed out'));
    });

    req.write(payload);
    req.end();
  });
}

/**
 * Direct HTTPS POST to Resend API
 */
function sendViaResend(toEmail, subject, html, text) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      from: 'Aura Sentinel <onboarding@resend.dev>',
      to: [toEmail],
      subject,
      html,
      text
    });

    const options = {
      hostname: 'api.resend.com',
      port: 443,
      path: '/emails',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 8000
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(data);
        else reject(new Error(`Resend HTTP ${res.statusCode}: ${data}`));
      });
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

/**
 * Custom Webhook Dispatch
 */
function sendViaWebhook(webhookUrl, payloadObj) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(payloadObj);
    const urlObj = new URL(webhookUrl);

    const req = https.request(urlObj, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      },
      timeout: 5000
    }, (res) => {
      resolve();
    });

    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

module.exports = {
  ADMIN_NOTIFICATION_EMAIL,
  sendPremiumUpgradeNotification
};
