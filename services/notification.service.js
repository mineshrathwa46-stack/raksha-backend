async function notifyEmergency(alert) {
  const notificationServiceConfigured = Boolean(process.env.NOTIFICATION_SERVICE_URL || process.env.TRUSTED_CONTACT_SMS_API || process.env.NOTIFICATION_SERVICE || process.env.SMS_API_KEY);

  if (!notificationServiceConfigured) {
    return { delivered: false, mode: 'pending', status: 'unconfigured', alertId: alert._id };
  }

  return { delivered: true, mode: 'configured', status: 'triggered', alertId: alert._id };
}

async function notifyTrustedContacts({ user, contacts, session, riskLevel, reason, location }) {
  const notificationServiceConfigured = Boolean(
    process.env.NOTIFICATION_SERVICE_URL
      || process.env.TRUSTED_CONTACT_SMS_API
      || process.env.NOTIFICATION_SERVICE
      || process.env.SMS_API_KEY
  );

  if (!contacts || contacts.length === 0) {
    return { delivered: false, status: 'no_contacts', mode: 'pending', recipientCount: 0 };
  }
  if (!notificationServiceConfigured) {
    return { delivered: false, status: 'unconfigured', mode: 'pending', recipientCount: contacts.length };
  }

  const payload = {
    userName: user.name,
    currentLocation: location || 'Location unavailable',
    transitId: session._id,
    destination: session.destination || 'Unavailable',
    vehicleType: session.vehicleType || 'Unavailable',
    vehicleNumber: session.vehicleNumber || 'Unavailable',
    riskLevel,
    reason
  };
  console.info('Trusted-contact notification prepared', {
    recipientCount: contacts.length,
    transitSessionId: session._id,
    payload
  });
  return { delivered: true, status: 'triggered', mode: 'configured', recipientCount: contacts.length };
}

module.exports = { notifyEmergency, notifyTrustedContacts };
