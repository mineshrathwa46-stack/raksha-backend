const { z } = require('zod');
const TransitSession = require('../models/TransitSession');
const LocationEvent = require('../models/LocationEvent');
const RiskEvent = require('../models/RiskEvent');
const { calculateRiskScore } = require('../utils/riskEngine');
const { classifyRouteDeviation } = require('../services/routeDeviation.service');

const pointSchema = z.object({ longitude: z.number(), latitude: z.number() });
const startSchema = z.object({
  destination: z.string().trim().optional(),
  vehicleType: z.string().optional(),
  vehicleNumber: z.string().optional(),
  driverName: z.string().trim().optional(),
  trustedContacts: z.array(z.string().trim()).optional(),
  origin: pointSchema.optional(),
  location: pointSchema.optional(),
  selectedRouteId: z.string().trim().optional(),
  routeGeometry: z.array(z.array(z.number())).optional(),
  routeDistance: z.number().optional(),
  routeDuration: z.number().optional(),
  routeSafetyScore: z.number().nullable().optional(),
  routeSafetyFactors: z.array(z.string()).optional(),
  routeWarnings: z.array(z.string()).optional()
});
const locationSchema = pointSchema;
const checkInSchema = z.object({ status: z.enum(['safe', 'help', 'timeout']) });

function point(location) { return { type: 'Point', coordinates: [location.longitude, location.latitude] }; }
function ownedQuery(id, userId) { return { _id: id, userId }; }

async function start(req, res, next) {
  try {
    const data = startSchema.parse(req.body);
    const session = await TransitSession.create({
      userId: req.user._id,
      destination: data.destination,
      vehicleType: data.vehicleType,
      vehicleNumber: data.vehicleNumber,
      driverName: data.driverName,
      trustedContacts: data.trustedContacts,
      selectedRouteId: data.selectedRouteId,
      routeGeometry: data.routeGeometry,
      routeDistance: data.routeDistance,
      routeDuration: data.routeDuration,
      routeSafetyScore: data.routeSafetyScore,
      routeSafetyFactors: data.routeSafetyFactors,
      origin: data.origin && point(data.origin),
      currentLocation: data.location && point(data.location),
      riskScore: 0,
      riskLevel: 'low'
    });
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

    const lastLocation = await LocationEvent.findOne({ transitSessionId: session._id }).sort({ timestamp: -1 });
    if (lastLocation) {
      const [lastLongitude, lastLatitude] = lastLocation.location.coordinates;
      const longitudeDelta = Math.abs(lastLongitude - data.longitude);
      const latitudeDelta = Math.abs(lastLatitude - data.latitude);
      if (longitudeDelta < 0.00005 && latitudeDelta < 0.00005) {
        session.currentLocation = location;
        await session.save();
        return res.status(200).json(session);
      }
    }

    const deviation = classifyRouteDeviation({
      location: data,
      routeGeometry: session.routeGeometry,
      consecutiveOffRouteUpdates: session.consecutiveOffRouteUpdates || 0
    });
    const previousDeviationState = session.routeDeviationState;
    await LocationEvent.create({ transitSessionId: session._id, location });
    session.currentLocation = location;
    session.routeDeviationState = deviation.state;
    session.consecutiveOffRouteUpdates = deviation.consecutiveOffRouteUpdates;
    await session.save();

    if (deviation.state === 'DEVIATED' && previousDeviationState !== 'DEVIATED') {
      await RiskEvent.create({
        transitSessionId: session._id,
        type: 'route_deviation',
        severity: 'medium',
        description: `User moved approximately ${deviation.distanceFromRoute}m from the selected route.`
      });
    }
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

async function checkIn(req, res, next) {
  try {
    const data = checkInSchema.parse(req.body);
    const session = await TransitSession.findOne(ownedQuery(req.params.id, req.user._id));
    if (!session) return res.status(404).json({ message: 'Transit session not found' });

    if (data.status !== 'safe') {
      const risk = calculateRiskScore({
        baseScore: session.riskScore,
        behaviorRisk: data.status === 'help' ? 35 : 15
      });
      session.riskScore = risk.riskScore;
      session.riskLevel = risk.riskLevel.toLowerCase();
      await session.save();
      await RiskEvent.create({
        transitSessionId: session._id,
        type: data.status === 'help' ? 'check_in_help' : 'missed_check_in',
        severity: data.status === 'help' ? 'high' : 'medium',
        description: data.status === 'help'
          ? 'User requested help during a periodic transit check-in.'
          : 'User did not respond to a periodic transit check-in.'
      });
    }

    res.status(201).json({ status: data.status, recordedAt: new Date().toISOString() });
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

module.exports = { start, getById, addLocation, end, checkIn, events, calculateRiskScore };
