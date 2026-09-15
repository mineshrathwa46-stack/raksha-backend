const SAFETY_WEIGHTS = Object.freeze({
  publicFacilities: 0.25,
  lighting: 0.20,
  crowd: 0.10,
  userReports: 0.35,
  historicalCrime: 0.10
});

function confidenceLabel(confidence) {
  if (confidence >= 0.75) return 'high';
  if (confidence >= 0.45) return 'medium';
  return 'low';
}

function factor(value, source, sourceType, timestamp, confidence, available = true) {
  return { value, source, sourceType, timestamp, confidence, available };
}

function scoreSafety({ overpass, reports, crime = { available: false }, crowd = { available: false } }) {
  const factors = {
    publicFacilities: overpass.available
      ? factor(overpass.facilities.length, overpass.source, 'osm', overpass.timestamp, 0.65)
      : factor(null, overpass.source || null, 'osm', null, 0, false),
    lighting: overpass.available && overpass.lighting
      ? factor(overpass.lighting.litSegments + overpass.lighting.streetLamps, overpass.source, 'osm', overpass.timestamp, 0.55)
      : factor(null, overpass.source || null, 'osm', null, 0, false),
    crowd: crowd.available
      ? factor(crowd.score, crowd.source, 'traffic_flow', crowd.timestamp, 0.6)
      : factor(null, null, 'traffic_flow', null, 0, false),
    userReports: reports.available
      ? factor(reports.count, 'Raksha user reports', 'user_report', reports.timestamp, reports.confidence)
      : factor(null, null, 'user_report', null, 0, false),
    historicalCrime: crime.available
      ? factor(crime.value, crime.source, 'ncrb', crime.timestamp, crime.confidence)
      : factor(null, null, 'ncrb', null, 0, false)
  };

  const availableFactors = Object.values(factors).filter((item) => item.available);
  if (availableFactors.length === 0) {
    return {
      score: null,
      confidence: 0,
      confidenceLabel: 'low',
      dataCoverage: 0,
      factors,
      positiveFactors: [],
      concerns: ['Safety data unavailable for this area.']
    };
  }

  const facilitySignal = overpass.available ? Math.min(100, 40 + Math.min(60, overpass.facilities.length * 4)) : null;
  const reportSignal = reports.available ? Math.max(0, 100 - Math.min(100, reports.weightedSeverity)) : null;
  const crimeSignal = crime.available ? crime.value : null;
  const lightingSignal = overpass.available && overpass.lighting
    ? Math.min(100, 45 + Math.min(55, (overpass.lighting.litSegments + overpass.lighting.streetLamps) * 3))
    : null;
  const crowdSignal = crowd.available ? crowd.score : null;
  const weighted = [];
  if (facilitySignal !== null) weighted.push({ value: facilitySignal, weight: SAFETY_WEIGHTS.publicFacilities });
  if (lightingSignal !== null) weighted.push({ value: lightingSignal, weight: SAFETY_WEIGHTS.lighting });
  if (crowdSignal !== null) weighted.push({ value: crowdSignal, weight: SAFETY_WEIGHTS.crowd });
  if (reportSignal !== null) weighted.push({ value: reportSignal, weight: SAFETY_WEIGHTS.userReports });
  if (crimeSignal !== null) weighted.push({ value: crimeSignal, weight: SAFETY_WEIGHTS.historicalCrime });
  const totalWeight = weighted.reduce((sum, item) => sum + item.weight, 0);
  const score = Math.round(weighted.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight);
  const dataCoverage = availableFactors.length / Object.keys(factors).length;
  const confidence = availableFactors.reduce((sum, item) => sum + item.confidence, 0) / Object.keys(factors).length;
  const positiveFactors = [];
  const concerns = [];
  if (overpass.available && overpass.facilities.length > 0) positiveFactors.push('Mapped public facilities are present along the route corridor.');
  if (overpass.available && overpass.safePlaces?.length > 0) positiveFactors.push(`${overpass.safePlaces.length} mapped safe places are near the route corridor.`);
  if (overpass.available && lightingSignal >= 60) positiveFactors.push('Mapped lighting coverage is available along the route corridor.');
  if (crowd.available && crowd.level === 'low') positiveFactors.push('Traffic flow indicates a less congested corridor.');
  if (reports.available && reports.count === 0) positiveFactors.push('No active Raksha safety reports were found in the route corridor.');
  if (reports.available && reports.count > 0) concerns.push('Active Raksha safety reports were found near the route corridor.');
  if (!crime.available) concerns.push('Historical crime data unavailable at route level.');
  if (!overpass.available) concerns.push('OpenStreetMap facility data unavailable for this route.');
  if (!crowd.available) concerns.push('Live crowd proxy data unavailable; add TOMTOM_API_KEY for traffic-flow coverage.');

  return {
    score,
    confidence: Number(confidence.toFixed(2)),
    confidenceLabel: confidenceLabel(confidence),
    dataCoverage: Number(dataCoverage.toFixed(2)),
    factors,
    positiveFactors,
    concerns
  };
}

module.exports = { scoreSafety, SAFETY_WEIGHTS, confidenceLabel };
