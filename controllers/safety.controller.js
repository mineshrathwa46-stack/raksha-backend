const { z } = require('zod');
const SafetyReport = require('../models/SafetyReport');

const reportSchema = z.object({
  latitude: z.number().finite().min(-90).max(90),
  longitude: z.number().finite().min(-180).max(180),
  category: z.enum(['unsafe_area', 'harassment', 'poor_lighting', 'suspicious_activity', 'isolated_area', 'road_issue', 'safe_area', 'other']),
  severity: z.enum(['low', 'medium', 'high']).default('medium'),
  description: z.string().trim().min(1).max(500)
});

const nearbySchema = z.object({
  lat: z.coerce.number().finite().min(-90).max(90),
  lng: z.coerce.number().finite().min(-180).max(180),
  radius: z.coerce.number().finite().positive().max(10000).default(1000)
});

async function createReport(req, res, next) {
  try {
    const data = reportSchema.parse(req.body);
    const report = await SafetyReport.create({
      userId: req.user._id,
      location: { type: 'Point', coordinates: [data.longitude, data.latitude] },
      category: data.category,
      severity: data.severity,
      description: data.description,
      source: 'user'
    });
    res.status(201).json({ id: report._id, status: report.status, createdAt: report.createdAt });
  } catch (error) { next(error); }
}

async function nearbyReports(req, res, next) {
  try {
    const data = nearbySchema.parse(req.query);
    const reports = await SafetyReport.find({
      status: 'active',
      location: {
        $near: {
          $geometry: { type: 'Point', coordinates: [data.lng, data.lat] },
          $maxDistance: data.radius
        }
      }
    }).limit(100).select('location category severity description createdAt status -userId');
    res.json(reports);
  } catch (error) { next(error); }
}

module.exports = { createReport, nearbyReports };
