const { calculateRoutes: calculateProviderRoutes } = require('./routing/openRouteServiceProvider');
const { calculateRouteSafety } = require('./safety/routeSafety.service');

const routeCache = new Map();
const ROUTE_CACHE_TTL_MS = 60 * 1000;

function cacheKey({ origin, destination, mode }) {
  return `${mode}:${origin.latitude.toFixed(5)},${origin.longitude.toFixed(5)}:${destination.latitude.toFixed(5)},${destination.longitude.toFixed(5)}`;
}

function rankRoutes(routes) {
  const fastest = [...routes].sort((a, b) => a.durationSeconds - b.durationSeconds)[0];
  const scored = routes.filter((route) => route.safety.score !== null);
  const safest = scored.length > 0
    ? [...scored].sort((a, b) => b.safety.score - a.safety.score || a.durationSeconds - b.durationSeconds)[0]
    : null;
  const fastestDuration = fastest.durationSeconds;
  const balanced = [...routes].sort((a, b) => {
    const aTime = a.durationSeconds / fastestDuration;
    const bTime = b.durationSeconds / fastestDuration;
    const aSafety = a.safety.score === null ? 0.5 : a.safety.score / 100;
    const bSafety = b.safety.score === null ? 0.5 : b.safety.score / 100;
    return (0.55 * aTime - 0.45 * aSafety) - (0.55 * bTime - 0.45 * bSafety);
  })[0];

  return routes.map((route) => ({
    fastest: route.routeId === fastest.routeId,
    safest: safest ? route.routeId === safest.routeId : false,
    balanced: route.routeId === balanced.routeId,
    reason: route.routeId === fastest.routeId
      ? 'Shortest estimated travel time from the routing provider.'
      : route.routeId === safest?.routeId
        ? 'Highest calculated safety score from available corridor data.'
        : route.routeId === balanced.routeId
          ? 'Balances estimated travel time and available safety data.'
          : 'Alternative returned by the routing provider.'
  }));
}

async function calculateRouteOptions({ origin, destination, mode = 'driving', transportType }) {
  const selectedMode = mode || transportType || 'driving';
  const key = cacheKey({ origin, destination, mode: selectedMode });
  const cached = routeCache.get(key);
  let providerRoutes;
  if (cached && cached.expiresAt > Date.now()) {
    providerRoutes = cached.routes;
  } else {
    console.info('[ROUTE] request', { mode: selectedMode });
    providerRoutes = await calculateProviderRoutes({ origin, destination, mode: selectedMode });
    routeCache.set(key, { routes: providerRoutes, expiresAt: Date.now() + ROUTE_CACHE_TTL_MS });
    console.info('[ROUTE] provider success', { count: providerRoutes.length });
  }

  const routes = await Promise.all(providerRoutes.map(async (route) => {
    const safety = await calculateRouteSafety(route);
    return {
      id: route.routeId,
      routeId: route.routeId,
      label: route.label,
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      distance: route.distanceMeters,
      estimatedDuration: route.durationSeconds,
      geometry: route.geometry,
      safetyScore: safety.score,
      availableSafetyFactors: safety.positiveFactors,
      warnings: safety.concerns,
      safety,
      ranking: null
    };
  }));

  const rankings = rankRoutes(routes);
  return routes.map((route, index) => {
    const ranking = rankings[index];
    const label = ranking.safest
      ? 'Safest'
      : ranking.fastest
        ? 'Fastest'
        : ranking.balanced
          ? 'Balanced'
          : route.label;
    return { ...route, label, ranking };
  });
}

module.exports = { calculateRouteOptions, rankRoutes, ROUTE_CACHE_TTL_MS };
