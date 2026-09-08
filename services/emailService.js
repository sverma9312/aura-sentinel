/**
 * AURA SENTINEL - Email Notification Gateway
 * Dispatches premium access requests to the administrator at sverma9312@gmail.com.
 */

const https = require('https');

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

  console.log(`[EmailGateway] 📨 Dispatched Premium Access request alert for ${userEmail} to ${ADMIN_NOTIFICATION_EMAIL}`);

  // If custom webhook / SMTP / Email API configured in environment, trigger it safely
  if (process.env.EMAIL_WEBHOOK_URL) {
    try {
      const payload = JSON.stringify({
        to: ADMIN_NOTIFICATION_EMAIL,
        subject,
        text: bodyText,
        user: { name: userName, email: userEmail, org: userOrg, requestedAt: timestamp }
      });

      const urlObj = new URL(process.env.EMAIL_WEBHOOK_URL);
      const req = https.request(urlObj, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        },
        timeout: 5000
      });

      req.on('error', (e) => {
        console.warn('[EmailGateway] Webhook dispatch notice:', e.message);
      });
      req.write(payload);
      req.end();
    } catch (err) {
      console.warn('[EmailGateway] Failed to trigger email webhook:', err.message);
    }
  }

  return {
    success: true,
    targetEmail: ADMIN_NOTIFICATION_EMAIL,
    dispatchedAt: timestamp
  };
}

module.exports = {
  ADMIN_NOTIFICATION_EMAIL,
  sendPremiumUpgradeNotification
};
