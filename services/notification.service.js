async function notifyEmergency(alert) {
  return { delivered: false, mode: 'mock', alertId: alert._id };
}

module.exports = { notifyEmergency };
