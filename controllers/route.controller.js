const { z } = require('zod');
const { calculateRouteOptions } = require('../services/route.service');

const coordinateSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180)
});
const coordinateAliasSchema = z.object({
  lat: z.number().finite().min(-90).max(90),
  lng: z.number().finite().min(-180).max(180)
});
const routeRequestSchema = z.object({
  origin: z.union([coordinateSchema, coordinateAliasSchema]),
  destination: z.union([coordinateSchema, coordinateAliasSchema]),
  mode: z.enum(['driving', 'walking', 'walk']).optional(),
  transportType: z.enum(['cab', 'auto', 'bus', 'other']).optional()
}).transform((payload) => ({
  origin: normalizeCoordinate(payload.origin),
  destination: normalizeCoordinate(payload.destination),
  mode: payload.mode || payload.transportType || 'driving'
}));

function normalizeCoordinate(coordinate) {
  return 'lat' in coordinate
    ? { latitude: coordinate.lat, longitude: coordinate.lng }
    : coordinate;
}

async function calculateRoutes(req, res, next) {
  try {
    const payload = routeRequestSchema.parse(req.body);
    const routes = await calculateRouteOptions(payload);
    res.json({ routes });
  } catch (error) {
    if (error.code === 'ROUTE_PROVIDER_ERROR') {
      console.warn('[ROUTE] provider failure', { statusCode: error.statusCode });
    }
    next(error);
  }
}

module.exports = { calculateRoutes };
