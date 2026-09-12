const { URL } = require('node:url');

const DEFAULT_API_VERSION = process.env.WHATSAPP_API_VERSION || 'v20.0';

function getMetaUrl() {
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!phoneNumberId) {
    throw new Error('WHATSAPP_PHONE_NUMBER_ID is not configured');
  }

  return `https://graph.facebook.com/${DEFAULT_API_VERSION}/${phoneNumberId}/messages`;
}

async function sendTextMessage(to, message) {
  const mockMode = String(process.env.WHATSAPP_MOCK_MODE || 'false').toLowerCase() === 'true';
  if (mockMode) {
    return {
      ok: true,
      mode: 'mock',
      to,
      message,
      delivered: true,
      provider: 'mock'
    };
  }

  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN;
  if (!accessToken) {
    return {
      ok: false,
      mode: 'disabled',
      error: 'WHATSAPP_ACCESS_TOKEN is not configured'
    };
  }

  try {
    const response = await fetch(getMetaUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'text',
        text: { body: message }
      })
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return {
        ok: false,
        error: payload?.error?.message || 'Meta API request failed',
        status: response.status
      };
    }

    return {
      ok: true,
      mode: 'live',
      to,
      message,
      provider: 'meta',
      response: payload
    };
  } catch (error) {
    return {
      ok: false,
      error: error.message,
      mode: 'live'
    };
  }
}

module.exports = { sendTextMessage };
