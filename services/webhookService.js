const crypto = require('crypto');
const Webhook = require('../models/Webhook');
const WebhookLog = require('../models/WebhookLog');

function signPayload(payload, secret) {
  const body = JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

async function dispatch(organizationId, event, data) {
  const webhooks = await Webhook.find({
    organization: organizationId,
    active: true,
    events: event
  });

  if (!webhooks.length) return;

  const payload = {
    event,
    timestamp: new Date().toISOString(),
    data
  };

  const deliveries = webhooks.map(async (wh) => {
    const signature = signPayload(payload, wh.secret);
    const body = JSON.stringify(payload);
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);

      const res = await fetch(wh.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-ZeeRemind-Signature': signature,
          'X-ZeeRemind-Event': event
        },
        body,
        signal: controller.signal
      });

      clearTimeout(timeout);
      const duration = Date.now() - start;
      const responseBody = await res.text().catch(() => '');

      const success = res.ok;

      await WebhookLog.create({
        webhook: wh._id,
        event,
        payload,
        statusCode: res.status,
        responseBody: responseBody.slice(0, 1000),
        success,
        duration
      });

      if (success) {
        wh.lastDeliveredAt = new Date();
        wh.failureCount = 0;
        wh.lastError = undefined;
      } else {
        wh.failureCount += 1;
        wh.lastFailedAt = new Date();
        wh.lastError = `HTTP ${res.status}`;
        if (wh.failureCount >= 10) wh.active = false;
      }
      await wh.save();
    } catch (err) {
      const duration = Date.now() - start;

      await WebhookLog.create({
        webhook: wh._id,
        event,
        payload,
        success: false,
        error: err.message,
        duration
      });

      wh.failureCount += 1;
      wh.lastFailedAt = new Date();
      wh.lastError = err.message;
      if (wh.failureCount >= 10) wh.active = false;
      await wh.save();
    }
  });

  await Promise.allSettled(deliveries);
}

module.exports = { dispatch, signPayload };
