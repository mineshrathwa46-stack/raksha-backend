function calculateRiskScore(signals = {}) {
  const score = Math.max(0, Math.min(100,
    Number(signals.baseScore || 0) +
    Number(signals.locationRisk || 0) +
    Number(signals.behaviorRisk || 0) +
    Number(signals.timeRisk || 0)
  ));

  const riskLevel = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
  return { riskScore: Math.round(score), riskLevel };
}

module.exports = { calculateRiskScore };
