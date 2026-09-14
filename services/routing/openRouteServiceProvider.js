const PROFILE_BY_MODE = {
  driving: 'driving-car',
  cab: 'driving-car',
  auto: 'driving-car',
  bus: 'driving-car',
  other: 'driving-car',
  walking: 'foot-walking',
  walk: 'foot-walking'
};

function routeProviderError(message, statusCode = 503) {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.code = 'ROUTE_PROVIDER_ERROR';
  return error;
}

function routeConfigurationError() {
  const error = routeProviderError('Routing provider is not configured.', 503);
  error.code = 'ROUTING_PROVIDER_NOT_CONFIGURED';
  return error;
}

async function calculateRoutes({ origin, destination, mode = 'driving', fetchImpl = fetch }) {
  const apiKey = process.env.ORS_API_KEY;
  if (!apiKey) throw routeConfigurationError();

  const baseUrl = (process.env.ORS_BASE_URL || 'https://api.heigit.org/openrouteservice/v2').replace(/\/$/, '');
  const profile = PROFILE_BY_MODE[mode] || PROFILE_BY_MODE.driving;
  const url = `${baseUrl}/directions/${profile}/geojson`;
  const requestBody = {
    coordinates: [
      [origin.longitude, origin.latitude],
      [destination.longitude, destination.latitude]
    ],
    instructions: false,
    elevation: false,
    geometry: true,
    alternative_routes: {
      target_count: 3,
      share_factor: 0.6,
      weight_factor: 1.4
    }
  };
  console.info('[ROUTE] ORS request started', { profile, baseUrl });
  let response;
  try {
    response = await fetchImpl(url, {
      method: 'POST',
      headers: {
        Authorization: apiKey,
        'Content-Type': 'application/json',
        Accept: 'application/geo+json, application/json'
      },
      body: JSON.stringify(requestBody),
      signal: AbortSignal.timeout(20000)
    });
  } catch (error) {
    console.warn('[ROUTE] ORS request failed', { profile, name: error.name });
    throw routeProviderError('Route service temporarily unavailable.', 502);
  }
  console.info('[ROUTE] ORS response status', { status: response.status, profile });

  if (!response.ok) {
    const status = response.status === 401 || response.status === 403 ? 502 : response.status === 429 ? 429 : 503;
    throw routeProviderError('Route service temporarily unavailable.', status);
  }

  let payload;
  try {
    payload = await response.json();
  } catch (_) {
    throw routeProviderError('Route service returned malformed data.', 502);
  }

  console.info('[ROUTE] ORS response received', { featureCount: Array.isArray(payload.features) ? payload.features.length : 0 });
  if (!Array.isArray(payload.features)) {
    throw routeProviderError('No route found for this journey.', 404);
  }

  const routes = payload.features
    .map((feature, index) => {
      const coordinates = feature.geometry && feature.geometry.coordinates;
      const summary = feature.properties && feature.properties.summary;
      if (!Array.isArray(coordinates) || coordinates.length < 2 || !summary) return null;
      return {
        routeId: `ors-${index + 1}`,
        label: `Route ${index + 1}`,
        geometry: coordinates,
        distanceMeters: Number(summary.distance),
        durationSeconds: Number(summary.duration),
        provider: 'openrouteservice'
      };
    })
    .filter((route) => Number.isFinite(route.distanceMeters) && Number.isFinite(route.durationSeconds));

  if (routes.length === 0) throw routeProviderError('No route found for this journey.', 404);
  return routes;
}

module.exports = { calculateRoutes, PROFILE_BY_MODE, routeProviderError, routeConfigurationError };
