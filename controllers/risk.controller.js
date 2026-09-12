const { z } = require('zod');
const TransitSession = require('../models/TransitSession');
const RiskEvent = require('../models/RiskEvent');
const EmergencyContact = require('../models/EmergencyContact');
const { calculateRiskScore } = require('../utils/riskEngine');
const { notifyTrustedContacts } = require('../services/notification.service');
const { createEmergencyAlertRecord } = require('./emergency.controller');

const reportSchema = z.object({
  transitSessionId: z.string().min(1),
  reason: z.enum([
    'driver_behaviour',
    'route_concern',
    'feeling_unsafe',
    'suspicious_activity',
    'other'
  ])
});

const reasonSignals = {
  driver_behaviour: { behaviorRisk: 35, description: 'User reported concerning driver behaviour.' },
  route_concern: { locationRisk: 25, description: 'User reported a concern about the current route.' },
  feeling_unsafe: { behaviorRisk: 45, description: 'User reported feeling unsafe during transit.' },
  suspicious_activity: { behaviorRisk: 70, description: 'User reported suspicious activity during transit.' },
  other: { behaviorRisk: 20, description: 'User reported a transit safety concern.' }
};

function suggestionsFor(level) {
  if (level === 'LOW') return ['You are being monitored.', 'Continue your journey when you feel comfortable.'];
  if (level === 'MEDIUM') return ['Consider changing your route.', 'Contact someone you trust.', 'Move toward a busy or public location.'];
  if (level === 'HIGH') return ['Move toward a busy or public location.', 'Keep your phone accessible.', 'Use SOS if you feel in immediate danger.'];
  return ['Use SOS if you are in immediate danger.', 'Move toward a busy or public location if it is safe to do so.'];
}

async function report(req, res, next) {
  try {
    const data = reportSchema.parse(req.body);
    const session = await TransitSession.findOne({ _id: data.transitSessionId, userId: req.user._id });
    if (!session) return res.status(404).json({ message: 'Active transit session not found' });
    if (session.status !== 'active') return res.status(409).json({ message: 'Transit session is not active' });

    const recentDuplicate = await RiskEvent.findOne({
      transitSessionId: session._id,
      type: `user_risk_${data.reason}`,
      createdAt: { $gte: new Date(Date.now() - 60 * 1000) }
    }).sort({ createdAt: -1 });
    if (recentDuplicate) {
      return res.status(200).json(await buildResponse({
        session,
        event: recentDuplicate,
        reason: data.reason,
        duplicate: true,
        req
      }));
    }

    const signal = reasonSignals[data.reason];
    const risk = calculateRiskScore({
      baseScore: session.riskScore,
      behaviorRisk: signal.behaviorRisk,
      locationRisk: signal.locationRisk
    });
    const eventRiskLevel = risk.riskLevel;
    const event = await RiskEvent.create({
      transitSessionId: session._id,
      type: `user_risk_${data.reason}`,
      severity: eventRiskLevel.toLowerCase(),
      description: signal.description
    });

    session.riskScore = risk.riskScore;
    session.riskLevel = eventRiskLevel.toLowerCase();
    await session.save();

    res.status(201).json(await buildResponse({
      session,
      event,
      reason: data.reason,
      duplicate: false,
      req
    }));
  } catch (error) { next(error); }
}

async function buildResponse({ session, event, reason, duplicate, req }) {
  const riskLevel = session.riskLevel.toUpperCase();
  let recommendedAction = riskLevel === 'CRITICAL'
    ? 'ESCALATE_EMERGENCY'
    : riskLevel === 'HIGH'
      ? 'CONTACT_TRUSTED_CONTACTS'
      : riskLevel === 'MEDIUM'
        ? 'SEEK_SAFE_PLACE'
        : 'CONTINUE_MONITORING';
  let notificationStatus = 'not_required';
  let trustedContactsNotified = false;
  let emergency = null;

  if (!duplicate && riskLevel === 'HIGH') {
    const contacts = await EmergencyContact.find({ userId: req.user._id });
    const notification = await notifyTrustedContacts({
      user: { name: req.user.name },
      contacts,
      session,
      riskLevel,
      reason,
      location: session.currentLocation || null
    });
    trustedContactsNotified = notification.delivered === true;
    notificationStatus = notification.status;
  }

  if (!duplicate && riskLevel === 'CRITICAL') {
    emergency = await createEmergencyAlertRecord({
      userId: req.user._id,
      transitSessionId: session._id,
      message: `Critical risk reported during transit: ${reason}.`,
      triggeredBy: 'risk_report'
    });
    notificationStatus = emergency.notification.status;
  }

  return {
    riskScore: session.riskScore,
    riskLevel,
    eventId: event._id,
    recommendedAction,
    trustedContactsNotified,
    notificationStatus,
    emergency: emergency ? {
      alertId: emergency.alert._id,
      status: emergency.alert.status,
      notificationStatus: emergency.notification.status
    } : null,
    aiStatus: 'UNAVAILABLE',
    suggestions: suggestionsFor(riskLevel),
    locationStatus: session.currentLocation ? 'AVAILABLE' : 'Location unavailable'
  };
}

module.exports = { report };
