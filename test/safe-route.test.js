const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateRoutes, routeProviderError } = require('../services/routing/openRouteServiceProvider');
const { scoreSafety } = require('../services/safety/safetyScore.service');
const { rankRoutes } = require('../services/route.service');

function response(payload, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => payload
  };
}

test('ORS provider parses one real route and does not fabricate alternatives', async () => {
  const previousKey = process.env.ORS_API_KEY;
  process.env.ORS_API_KEY = 'test-key';
  try {
    const routes = await calculateRoutes({
      origin: { latitude: 22.3, longitude: 73.18 },
      destination: { latitude: 22.32, longitude: 73.17 },
      mode: 'driving',
      fetchImpl: async () => response({
        features: [{
          geometry: { coordinates: [[73.18, 22.3], [73.17, 22.32]] },
          properties: { summary: { distance: 2400, duration: 600 } }
        }]
      })
    });
    assert.equal(routes.length, 1);
    assert.equal(routes[0].distanceMeters, 2400);
    assert.deepEqual(routes[0].geometry[0], [73.18, 22.3]);
  } finally {
    process.env.ORS_API_KEY = previousKey;
  }
});

test('ORS provider reports missing API configuration', async () => {
  const previousKey = process.env.ORS_API_KEY;
  delete process.env.ORS_API_KEY;
  try {
    await assert.rejects(
      calculateRoutes({
        origin: { latitude: 22.3, longitude: 73.18 },
        destination: { latitude: 22.32, longitude: 73.17 },
        fetchImpl: async () => response({})
      }),
      (error) => error instanceof Error && error.code === 'ROUTING_PROVIDER_NOT_CONFIGURED'
    );
  } finally {
    process.env.ORS_API_KEY = previousKey;
  }
});

test('safety score is unavailable when every corridor source is unavailable', () => {
  const result = scoreSafety({
    overpass: { available: false },
    reports: { available: false },
    crime: { available: false }
  });
  assert.equal(result.score, null);
  assert.equal(result.dataCoverage, 0);
  assert.match(result.concerns[0], /unavailable/i);
});

test('safety score is deterministic for identical real inputs', () => {
  const input = {
    overpass: {
      available: true,
      facilities: [{ type: 'police' }, { type: 'hospital' }],
      source: 'OpenStreetMap Overpass',
      timestamp: '2026-09-14T00:00:00.000Z'
    },
    reports: {
      available: true,
      count: 1,
      weightedSeverity: 25,
      confidence: 0.75,
      timestamp: '2026-09-14T00:00:00.000Z'
    },
    crime: { available: false }
  };
  assert.deepEqual(scoreSafety(input), scoreSafety(input));
});

test('ranking uses travel time and available safety data', () => {
  const routes = [
    { routeId: 'a', durationSeconds: 600, safety: { score: 50 } },
    { routeId: 'b', durationSeconds: 660, safety: { score: 80 } }
  ];
  const ranking = rankRoutes(routes);
  assert.equal(ranking[0].fastest, true);
  assert.equal(ranking[1].safest, true);
  assert.ok(ranking.some((item) => item.balanced));
});
