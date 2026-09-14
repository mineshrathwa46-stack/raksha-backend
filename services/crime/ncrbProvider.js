async function getNcrbContext() {
  return {
    available: false,
    value: null,
    source: null,
    timestamp: null,
    confidence: 0,
    granularity: 'annual_aggregated_unavailable'
  };
}

module.exports = { getNcrbContext };
