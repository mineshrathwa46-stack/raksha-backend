const { calculateRouteSafety } = require('./routeSafety.service');

async function calculateRouteOptions({ origin, destination, transportType = 'auto' }) {
  const baseRoutes = [
    {
      routeId: 'fastest',
      label: 'Fastest',
      durationSeconds: 900,
      distanceMeters: 4200,
      geometry: [
        [origin.longitude, origin.latitude],
        [destination.longitude, destination.latitude]
      ]
    },
    {
      routeId: 'balanced',
      label: 'Balanced',
      durationSeconds: 1200,
      distanceMeters: 5000,
      geometry: [
        [origin.longitude + 0.003, origin.latitude],
        [origin.longitude + 0.003, origin.latitude + 0.004],
        [destination.longitude, destination.latitude]
      ]
    },
    {
      routeId: 'safest',
      label: 'Safest',
      durationSeconds: 1500,
      distanceMeters: 5600,
      geometry: [
        [origin.longitude - 0.003, origin.latitude],
        [origin.longitude - 0.003, origin.latitude + 0.006],
        [destination.longitude, destination.latitude]
      ]
    }
  ];

  const options = await Promise.all(baseRoutes.map(async (route) => {
    const safety = await calculateRouteSafety({
      route,
      transportType,
      origin,
      destination
    });

    return {
      routeId: route.routeId,
      label: route.label,
      distance: route.distanceMeters,
      estimatedDuration: route.durationSeconds,
      geometry: route.geometry,
      safetyScore: safety.safetyScore,
      availableSafetyFactors: safety.factors || [],
      warnings: safety.warnings || [],
      safety: safety
    };
  }));

  return options;
}

module.exports = { calculateRouteOptions };
