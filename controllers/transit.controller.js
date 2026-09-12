const { z } = require('zod');
const TransitSession = require('../models/TransitSession');
const LocationEvent = require('../models/LocationEvent');
const RiskEvent = require('../models/RiskEvent');
const { calculateRiskScore } = require('../utils/riskEngine');

const pointSchema = z.object({ longitude: z.number(), latitude: z.number() });
const startSchema = z.object({ vehicleType: z.string().optional(), vehicleNumber: z.string().optional(), location: pointSchema.optional() });
const locationSchema = pointSchema;

function point(location) { return { type: 'Point', coordinates: [location.longitude, location.latitude] }; }
function ownedQuery(id, userId) { return { _id: id, userId }; }

async function start(req, res, next) {
  try {
    const data = startSchema.parse(req.body);
    const session = await TransitSession.create({ userId: req.user._id, vehicleType: data.vehicleType, vehicleNumber: data.vehicleNumber, currentLocation: data.location && point(data.location) });
    res.status(201).json(session);
  } catch (error) { next(error); }
}

async function getById(req, res, next) {
  try {
    const session = await TransitSession.findOne(ownedQuery(req.params.id, req.user._id));
    if (!session) return res.status(404).json({ message: 'Transit session not found' });
    res.json(session);
  } catch (error) { next(error); }
}

async function addLocation(req, res, next) {
  try {
    const data = locationSchema.parse(req.body);
    const session = await TransitSession.findOne(ownedQuery(req.params.id, req.user._id));
    if (!session) return res.status(404).json({ message: 'Transit session not found' });
    const location = point(data);
    await LocationEvent.create({ transitSessionId: session._id, location });
    session.currentLocation = location;
    await session.save();
    res.status(201).json(session);
  } catch (error) { next(error); }
}

async function end(req, res, next) {
  try {
    const session = await TransitSession.findOneAndUpdate(ownedQuery(req.params.id, req.user._id), { status: 'completed', endedAt: new Date() }, { new: true });
    if (!session) return res.status(404).json({ message: 'Transit session not found' });
    res.json(session);
  } catch (error) { next(error); }
}

async function events(req, res, next) {
  try {
    const session = await TransitSession.findOne(ownedQuery(req.params.id, req.user._id));
    if (!session) return res.status(404).json({ message: 'Transit session not found' });
    const [locations, risks] = await Promise.all([
      LocationEvent.find({ transitSessionId: session._id }).sort({ timestamp: 1 }),
      RiskEvent.find({ transitSessionId: session._id }).sort({ createdAt: 1 })
    ]);
    res.json({ locations, risks });
  } catch (error) { next(error); }
}

module.exports = { start, getById, addLocation, end, events, calculateRiskScore };
