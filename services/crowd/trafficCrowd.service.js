const DEFAULT_TOMTOM_URL = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';

function unavailable() {
  return {
    available: false,
    source: null,
    timestamp: null,
    level: null,
    score: null,
    currentSpeed: null,
    freeFlowSpeed: null
  };
}

function routeMidpoint(geometry) {
  const points = geometry.filter((point) => Array.isArray(point) && point.length >= 2);
  if (points.length === 0) return null;
  const point = points[Math.floor(points.length / 2)];
  return { latitude: Number(point[1]), longitude: Number(point[0]) };
}

async function getTrafficCrowdContext(geometry, { fetchImpl = fetch } = {}) {
  const apiKey = process.env.TOMTOM_API_KEY;
  const midpoint = routeMidpoint(geometry);
  if (!apiKey || !midpoint) return unavailable();

  const baseUrl = process.env.TOMTOM_FLOW_URL || DEFAULT_TOMTOM_URL;
  const url = new URL(baseUrl);
  url.searchParams.set('point', `${midpoint.latitude},${midpoint.longitude}`);
  url.searchParams.set('unit', 'KMPH');
  url.searchParams.set('key', apiKey);
  try {
    const response = await fetchImpl(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(10000) });
    if (!response.ok) return unavailable();
    const segment = (await response.json()).flowSegmentData;
    const currentSpeed = Number(segment?.currentSpeed);
    const freeFlowSpeed = Number(segment?.freeFlowSpeed);
    if (!Number.isFinite(currentSpeed) || !Number.isFinite(freeFlowSpeed) || freeFlowSpeed <= 0) return unavailable();
    const ratio = Math.max(0, Math.min(1, currentSpeed / freeFlowSpeed));
    return {
      available: true,
      source: 'TomTom Traffic Flow',
      timestamp: new Date().toISOString(),
      level: ratio >= 0.8 ? 'low' : ratio >= 0.5 ? 'medium' : 'high',
      score: Math.round(ratio * 100),
      currentSpeed,
      freeFlowSpeed
    };
  } catch (_) {
    return unavailable();
  }
}

module.exports = { getTrafficCrowdContext, routeMidpoint };