async function getHistoricalCrimeContext() {
  return {
    available: false,
    value: null,
    source: null,
    timestamp: null,
    confidence: 0,
    granularity: 'unavailable'
  };
}

module.exports = { getHistoricalCrimeContext };
