const { z } = require('zod');
const { calculateRouteOptions } = require('../services/route.service');

const routeRequestSchema = z.object({
  origin: z.object({
    latitude: z.number(),
    longitude: z.number()
  }),
  destination: z.object({
    latitude: z.number(),
    longitude: z.number()
  }),
  transportType: z.enum(['cab', 'auto', 'bus', 'other']).default('auto')
});

async function calculateRoutes(req, res, next) {
  try {
    const payload = routeRequestSchema.parse(req.body);
    const routes = await calculateRouteOptions(payload);
    res.json({ routes });
  } catch (error) {
    next(error);
  }
}

module.exports = { calculateRoutes };
