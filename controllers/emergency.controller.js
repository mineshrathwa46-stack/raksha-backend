const { z } = require('zod');
const EmergencyAlert = require('../models/EmergencyAlert');
const TransitSession = require('../models/TransitSession');
const { notifyEmergency } = require('../services/notification.service');

const alertSchema = z.object({ transitSessionId: z.string(), message: z.string().min(1), triggeredBy: z.string().default('user') });

async function createAlert(req, res, next) {
  try {
    const data = alertSchema.parse(req.body);
    const session = await TransitSession.findOne({ _id: data.transitSessionId, userId: req.user._id });
    if (!session) return res.status(404).json({ message: 'Transit session not found' });
    const alert = await EmergencyAlert.create(data);
    await notifyEmergency(alert);
    res.status(201).json(alert);
  } catch (error) { next(error); }
}

async function getAlerts(req, res, next) {
  try {
    const session = await TransitSession.findOne({ _id: req.params.transitSessionId, userId: req.user._id });
    if (!session) return res.status(404).json({ message: 'Transit session not found' });
    res.json(await EmergencyAlert.find({ transitSessionId: session._id }).sort({ createdAt: -1 }));
  } catch (error) { next(error); }
}

module.exports = { createAlert, getAlerts };
