const { z } = require('zod');
const User = require('../models/User');
const TransitSession = require('../models/TransitSession');
const ConversationMessage = require('../models/ConversationMessage');
const RiskEvent = require('../models/RiskEvent');
const EmergencyAlert = require('../models/EmergencyAlert');
const { analyzeConversation } = require('../services/conversationAnalysis.service');
const { calculateRiskFromSignals } = require('../services/riskAnalysis.service');
const { sendTextMessage } = require('../services/whatsapp.service');

const webhookVerificationSchema = z.object({
  'hub.mode': z.string(),
  'hub.verify_token': z.string(),
  'hub.challenge': z.string().optional()
});

function verifyWebhook(req, res) {
  const { 'hub.mode': mode, 'hub.verify_token': token, 'hub.challenge': challenge } = req.query || {};
  const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN;

  if (mode !== 'subscribe' || token !== expectedToken) {
    return res.status(403).send('Verification failed');
  }

  if (!challenge) {
    return res.status(400).send('Missing challenge');
  }

  return res.status(200).send(challenge);
}

function extractIncomingMessage(changeValue) {
  const messages = changeValue?.messages || [];
  const message = messages[0];
  if (!message) return null;

  return {
    id: message.id || null,
    from: message.from || null,
    type: message.type || null,
    text: message.text?.body || null,
    timestamp: message.timestamp || null,
    phoneNumberId: changeValue?.metadata?.phone_number_id || null
  };
}

function normalizePhone(phone) {
  if (!phone) return null;
  return String(phone).replace(/\D/g, '');
}

async function handleWebhook(req, res, next = () => {}) {
  try {
    const body = req.body || {};
    const entry = body.entry || [];
    const change = entry.flatMap((item) => item.changes || [])[0];
    const value = change?.value || {};
    const messageInfo = extractIncomingMessage(value);

    if (!messageInfo || !messageInfo.id) {
      return res.status(200).json({ status: 'ignored', reason: 'No supported message payload' });
    }

    const existingMessage = await ConversationMessage.findOne({ whatsappMessageId: messageInfo.id });
    if (existingMessage) {
      return res.status(200).json({ status: 'duplicate', messageId: messageInfo.id, ignored: true });
    }

    if (messageInfo.type !== 'text' || !messageInfo.text) {
      return res.status(200).json({ status: 'ignored', type: messageInfo.type || 'unsupported' });
    }

    const normalizedPhone = normalizePhone(messageInfo.from);
    const user = await User.findOne({ phone: { $in: [normalizedPhone, `+${normalizedPhone}`] } });
    if (!user) {
      const response = 'Raksha AI Companion is not yet linked to your Raksha account. Please link your WhatsApp number to continue.';
      await sendTextMessage(messageInfo.from, response);
      return res.status(200).json({ status: 'ok', reply: response, reason: 'Unknown WhatsApp user' });
    }

    const transitQuery = TransitSession.findOne({ userId: user._id, status: 'active' });
    const activeTransit = transitQuery && typeof transitQuery.sort === 'function'
      ? await transitQuery.sort({ startedAt: -1 })
      : await transitQuery;

    if (!activeTransit) {
      const response = 'Raksha AI Companion is available when you start a safe transit.';
      await sendTextMessage(messageInfo.from, response);
      return res.status(200).json({ status: 'ok', reply: response, reason: 'No active transit' });
    }

    await ConversationMessage.create({
      transitSessionId: activeTransit._id,
      role: 'user',
      text: messageInfo.text,
      whatsappMessageId: messageInfo.id,
      timestamp: new Date(Number(messageInfo.timestamp || Date.now()))
    });

    const analysis = await analyzeConversation(messageInfo.text);
    const risk = calculateRiskFromSignals({
      ...analysis,
      repeatedConcerningMessages: 0,
      explicitHelpRequest: analysis.explicitHelpRequest || false
    });

    const followUpMessage = buildFollowUpReply(analysis, activeTransit);
    await sendTextMessage(messageInfo.from, followUpMessage);

    if (risk.riskLevel === 'HIGH' || risk.riskLevel === 'CRITICAL') {
      const alert = await EmergencyAlert.create({
        transitSessionId: activeTransit._id,
        triggeredBy: 'whatsapp_ai',
        status: 'pending',
        message: `AI safety review indicated ${risk.riskLevel.toLowerCase()} risk while the user is in transit.`
      });
      await RiskEvent.create({
        transitSessionId: activeTransit._id,
        type: 'ai_safety_alert',
        severity: risk.riskLevel.toLowerCase(),
        description: `AI risk score ${risk.riskScore} / 100`,
        whatsappMessageId: messageInfo.id
      });

      if (risk.riskLevel === 'CRITICAL' || risk.explicitHelpRequest) {
        await sendTextMessage(messageInfo.from, 'I am escalating this as a priority safety concern. If you are in immediate danger, contact local emergency services immediately.');
      }

      return res.status(200).json({ status: 'ok', reply: followUpMessage, risk, alertId: alert._id, escalated: true });
    }

    if (risk.riskScore >= 20 || risk.riskLevel === 'MEDIUM') {
      await RiskEvent.create({
        transitSessionId: activeTransit._id,
        type: 'ai_safety_signal',
        severity: 'medium',
        description: `AI analyzed transit safety pattern with risk score ${risk.riskScore}`,
        whatsappMessageId: messageInfo.id
      });
    }

    return res.status(200).json({ status: 'ok', reply: followUpMessage, risk });
  } catch (error) {
    if (typeof next === 'function') {
      next(error);
      return;
    }
    throw error;
  }
}

function buildFollowUpReply(analysis, activeTransit) {
  if (analysis.explicitHelpRequest) {
    return 'I am checking your safety. Please share your current location and if you are in immediate danger, contact emergency services right away.';
  }

  if (analysis.location === null && !analysis.driverBehaviour && !analysis.vehicleType && !analysis.vehicleNumber) {
    const options = [
      'Kahan pahunchi?',
      'Driver kaisa hai?',
      'Auto number kya hai?',
      'Sab theek hai?'
    ];
    return options[Math.floor(Math.random() * options.length)];
  }

  if (!analysis.driverBehaviour) {
    return 'Driver kaisa hai?';
  }

  if (!analysis.vehicleNumber && activeTransit && activeTransit.vehicleType) {
    return 'Auto number kya hai?';
  }

  if (analysis.safetyConcern) {
    return 'Okay, main tumhare transit ko monitor kar raha hoon. Abhi safe feel kar rahi ho?';
  }

  return 'Sab theek hai?';
}

module.exports = { verifyWebhook, handleWebhook, extractIncomingMessage };
