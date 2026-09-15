const { queryRouteContext } = require('../osm/overpassService');
const { collectUserReports } = require('./safetyDataService');
const { scoreSafety } = require('./safetyScore.service');
const { getHistoricalCrimeContext } = require('../crime/crimeDataService');
const { getTrafficCrowdContext } = require('../crowd/trafficCrowd.service');

async function calculateRouteSafety(route) {
  console.info('[SAFETY] data collection', { routeId: route.routeId });
  const [overpass, reports, crime, crowd] = await Promise.all([
    queryRouteContext(route.geometry),
    collectUserReports(route.geometry),
    getHistoricalCrimeContext(),
    getTrafficCrowdContext(route.geometry)
  ]);
  const safety = scoreSafety({ overpass, reports, crime, crowd });
  console.info('[SAFETY] scoring', {
    routeId: route.routeId,
    score: safety.score,
    coverage: safety.dataCoverage
  });
  return safety;
}

module.exports = { calculateRouteSafety };
