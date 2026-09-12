const test = require('node:test');
const assert = require('node:assert/strict');
const { classifyRouteDeviation } = require('../services/routeDeviation.service');

test('route deviation ignores a point within GPS tolerance', () => {
  const result = classifyRouteDeviation({
    location: { latitude: 0, longitude: 0.0001 },
    routeGeometry: [[0, 0], [0.01, 0]],
    consecutiveOffRouteUpdates: 0
  });

  assert.equal(result.state, 'ON_ROUTE');
  assert.equal(result.consecutiveOffRouteUpdates, 0);
});

test('route deviation requires consecutive off-route updates', () => {
  const routeGeometry = [[0, 0], [0.01, 0]];
  const first = classifyRouteDeviation({
    location: { latitude: 0.001, longitude: 0.005 },
    routeGeometry,
    consecutiveOffRouteUpdates: 0
  });
  const second = classifyRouteDeviation({
    location: { latitude: 0.001, longitude: 0.005 },
    routeGeometry,
    consecutiveOffRouteUpdates: first.consecutiveOffRouteUpdates
  });
  const third = classifyRouteDeviation({
    location: { latitude: 0.001, longitude: 0.005 },
    routeGeometry,
    consecutiveOffRouteUpdates: second.consecutiveOffRouteUpdates
  });

  assert.equal(first.state, 'POSSIBLE_DEVIATION');
  assert.equal(second.state, 'POSSIBLE_DEVIATION');
  assert.equal(third.state, 'DEVIATED');
});

test('route deviation reports unavailable when route geometry is missing', () => {
  const result = classifyRouteDeviation({
    location: { latitude: 1, longitude: 1 },
    routeGeometry: [],
    consecutiveOffRouteUpdates: 5
  });

  assert.equal(result.state, 'ON_ROUTE');
  assert.equal(result.hasRouteData, false);
  assert.equal(result.distanceFromRoute, null);
});
