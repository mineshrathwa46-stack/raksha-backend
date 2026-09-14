const SafetyReport = require('../../models/SafetyReport');
const { distanceFromRoute } = require('../routeDeviation.service');
const { routeBounds } = require('../osm/overpassService');

const cache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCache(key) {
  const entry = cache.get(key);
  if (!entry || entry.expiresAt < Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function setCache(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
  return value;
}

async function collectUserReports(routeGeometry) {
  const bounds = routeBounds(routeGeometry);
  if (!bounds) return { available: false, count: 0, weightedSeverity: 0, confidence: 0, timestamp: null };
  const key = `reports:${bounds.south.toFixed(4)}:${bounds.west.toFixed(4)}:${bounds.north.toFixed(4)}:${bounds.east.toFixed(4)}`;
  const cached = getCache(key);
  if (cached) return cached;

  try {
    const reports = await SafetyReport.find({
      status: 'active',
      location: {
        $geoWithin: {
          $box: [[bounds.west, bounds.south], [bounds.east, bounds.north]]
        }
      }
    });
    const severityWeight = { low: 10, medium: 25, high: 45 };
    const corridorReports = reports.filter((report) => {
      const [longitude, latitude] = report.location.coordinates;
      return distanceFromRoute({ latitude, longitude }, routeGeometry) <= 500;
    });
    const result = {
      available: true,
      count: corridorReports.length,
      weightedSeverity: corridorReports.reduce((sum, report) => sum + (severityWeight[report.severity] || 25), 0),
      confidence: corridorReports.length > 0 ? 0.75 : 0.6,
      timestamp: new Date().toISOString()
    };
    return setCache(key, result);
  } catch (_) {
    return { available: false, count: 0, weightedSeverity: 0, confidence: 0, timestamp: null };
  }
}

module.exports = { collectUserReports, CACHE_TTL_MS };
