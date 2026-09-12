function calculateRiskFromSignals(signals = {}) {
  let score = 0;

  if (signals.safetyConcern) score += 28;
  if (signals.driverBehaviour === 'concerning') score += 22;
  if (signals.driverBehaviour === 'normal') score -= 6;
  if (signals.explicitHelpRequest) score += 30;
  if (signals.stressSignal === 'elevated') score += 12;
  if (signals.stressSignal === 'critical') score += 25;
  if (signals.repeatedConcerningMessages && signals.repeatedConcerningMessages > 0) {
    score += Math.min(25, signals.repeatedConcerningMessages * 10);
  }
  if (signals.location && String(signals.location).length > 6) score += 8;
  if (signals.vehicleType) score += 5;

  const clamp = Math.max(0, Math.min(100, score));

  let riskLevel = 'LOW';
  if (clamp >= 85 || (signals.explicitHelpRequest && clamp >= 60)) riskLevel = 'CRITICAL';
  else if (clamp >= 60) riskLevel = 'HIGH';
  else if (clamp >= 30) riskLevel = 'MEDIUM';

  return { riskScore: clamp, riskLevel };
}

async function analyzeRisk(input = {}) {
  const combined = {
    safetyConcern: Boolean(input.safetyConcern),
    driverBehaviour: input.driverBehaviour || null,
    explicitHelpRequest: Boolean(input.explicitHelpRequest),
    stressSignal: input.stressSignal || null,
    repeatedConcerningMessages: Number(input.repeatedConcerningMessages || 0),
    location: input.location || null,
    vehicleType: input.vehicleType || null,
    baseScore: Number(input.baseScore || 0),
    locationRisk: Number(input.locationRisk || 0),
    behaviorRisk: Number(input.behaviorRisk || 0),
    timeRisk: Number(input.timeRisk || 0)
  };

  const risk = calculateRiskFromSignals(combined);

  return {
    signals: combined,
    riskScore: risk.riskScore,
    riskLevel: risk.riskLevel,
    source: 'mock-ai'
  };
}

module.exports = { analyzeRisk, calculateRiskFromSignals };
