const EARTH_RADIUS_METERS = 6371000;
const DEFAULT_TOLERANCE_METERS = 60;
const DEFAULT_REQUIRED_CONSECUTIVE_UPDATES = 3;

function toRadians(value) {
  return value * Math.PI / 180;
}

function distanceBetween(first, second) {
  const latitudeDelta = toRadians(second.latitude - first.latitude);
  const longitudeDelta = toRadians(second.longitude - first.longitude);
  const firstLatitude = toRadians(first.latitude);
  const secondLatitude = toRadians(second.latitude);
  const value = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(firstLatitude) * Math.cos(secondLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}

function toLocalMeters(point, reference) {
  return {
    x: toRadians(point.longitude - reference.longitude) * EARTH_RADIUS_METERS * Math.cos(toRadians(reference.latitude)),
    y: toRadians(point.latitude - reference.latitude) * EARTH_RADIUS_METERS
  };
}

function distanceToSegment(point, start, end) {
  const localPoint = toLocalMeters(point, start);
  const localEnd = toLocalMeters(end, start);
  const segmentLengthSquared = localEnd.x ** 2 + localEnd.y ** 2;
  if (segmentLengthSquared === 0) return Math.hypot(localPoint.x, localPoint.y);

  const projection = Math.max(0, Math.min(1,
    (localPoint.x * localEnd.x + localPoint.y * localEnd.y) / segmentLengthSquared
  ));
  return Math.hypot(
    localPoint.x - localEnd.x * projection,
    localPoint.y - localEnd.y * projection
  );
}

function geometryToPoints(routeGeometry = []) {
  return routeGeometry
    .filter((coordinate) => Array.isArray(coordinate) && coordinate.length >= 2)
    .map(([longitude, latitude]) => ({
      longitude: Number(longitude),
      latitude: Number(latitude)
    }))
    .filter((point) => Number.isFinite(point.longitude) && Number.isFinite(point.latitude));
}

function distanceFromRoute(location, routeGeometry) {
  const points = geometryToPoints(routeGeometry);
  if (points.length < 2) return null;

  let closestDistance = Number.POSITIVE_INFINITY;
  for (let index = 1; index < points.length; index += 1) {
    closestDistance = Math.min(
      closestDistance,
      distanceToSegment(location, points[index - 1], points[index])
    );
  }
  return closestDistance;
}

function classifyRouteDeviation({ location, routeGeometry, consecutiveOffRouteUpdates = 0, toleranceMeters = DEFAULT_TOLERANCE_METERS, requiredConsecutiveUpdates = DEFAULT_REQUIRED_CONSECUTIVE_UPDATES }) {
  const distanceFromSelectedRoute = distanceFromRoute(location, routeGeometry);
  if (distanceFromSelectedRoute === null) {
    return {
      state: 'ON_ROUTE',
      distanceFromRoute: null,
      consecutiveOffRouteUpdates: 0,
      hasRouteData: false
    };
  }

  if (distanceFromSelectedRoute <= toleranceMeters) {
    return {
      state: 'ON_ROUTE',
      distanceFromRoute: Math.round(distanceFromSelectedRoute),
      consecutiveOffRouteUpdates: 0,
      hasRouteData: true
    };
  }

  const nextConsecutiveCount = consecutiveOffRouteUpdates + 1;
  return {
    state: nextConsecutiveCount >= requiredConsecutiveUpdates ? 'DEVIATED' : 'POSSIBLE_DEVIATION',
    distanceFromRoute: Math.round(distanceFromSelectedRoute),
    consecutiveOffRouteUpdates: nextConsecutiveCount,
    hasRouteData: true
  };
}

module.exports = {
  classifyRouteDeviation,
  distanceFromRoute,
  DEFAULT_TOLERANCE_METERS,
  DEFAULT_REQUIRED_CONSECUTIVE_UPDATES
};
