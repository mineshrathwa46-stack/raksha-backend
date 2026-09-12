async function analyzeRisk(input = {}) {
  return {
    signals: {
      baseScore: Number(input.baseScore || 0),
      locationRisk: Number(input.locationRisk || 0),
      behaviorRisk: Number(input.behaviorRisk || 0),
      timeRisk: Number(input.timeRisk || 0)
    },
    source: 'mock-ai'
  };
}

module.exports = { analyzeRisk };
