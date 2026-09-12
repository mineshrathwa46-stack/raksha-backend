async function calculateRouteSafety({ route, transportType, origin, destination }) {
  const factors = [];
  const warnings = [];

  const routeLength = route.distanceMeters || 0;
  if (routeLength > 5000) {
    factors.push('Longer route increases exposure time');
  }

  if (transportType === 'auto') {
    factors.push('Auto is being used for this segment');
  }

  if (transportType === 'bus') {
    factors.push('Bus travel may provide higher public visibility');
  }

  if (origin && destination) {
    const latDelta = Math.abs(origin.latitude - destination.latitude);
    const lonDelta = Math.abs(origin.longitude - destination.longitude);
    if ((latDelta + lonDelta) > 0.03) {
      factors.push('Longer route distance may require extra attention');
    }
  }

  if (route.routeId === 'fastest') {
    warnings.push('Fastest route may have higher exposure to traffic and road conditions');
  }

  return {
    safetyScore: null,
    factors,
    warnings
  };
}

module.exports = { calculateRouteSafety };
