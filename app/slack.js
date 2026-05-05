/* ========================================
   Slack Webhook Notifications
   ======================================== */

import { state } from './state.js';

// Column IDs that count as "review" across all boards
const REVIEW_COLUMN_IDS = ['review', 'stakeholder', 'analysis', 'qa'];

export function isReviewColumn(columnId) {
  return REVIEW_COLUMN_IDS.includes(columnId);
}

/**
 * Send a plain-text message to the configured Slack webhook.
 * Fire-and-forget — errors are silently swallowed so a Slack outage
 * never interrupts the user's workflow.
 */
export function notifySlack(text) {
  const url = state.slackWebhookUrl;
  if (!url) return;
  fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  }).catch(() => {});
}
