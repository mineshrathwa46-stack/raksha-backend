const test = require('node:test');
const assert = require('node:assert/strict');
const TransitSession = require('../models/TransitSession');
const RiskEvent = require('../models/RiskEvent');
const EmergencyContact = require('../models/EmergencyContact');
const EmergencyAlert = require('../models/EmergencyAlert');
const { report } = require('../controllers/risk.controller');

function responseCapture() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

function queryResult(value) {
  return { sort: async () => value };
}

function activeSession(riskScore = 0) {
  return {
    _id: 'session-1',
    status: 'active',
    userId: 'user-1',
    riskScore,
    riskLevel: riskScore >= 70 ? 'high' : 'low',
    destination: 'Office',
    vehicleType: 'cab',
    vehicleNumber: 'GJ-01-AA-1234',
    currentLocation: { type: 'Point', coordinates: [73.1, 22.3] },
    save: async function save() { return this; }
  };
}

test('risk report validates ownership and creates a low risk event', async () => {
  const originalSessionFindOne = TransitSession.findOne;
  const originalRiskFindOne = RiskEvent.findOne;
  const originalRiskCreate = RiskEvent.create;
  const session = activeSession();
  TransitSession.findOne = async () => session;
  RiskEvent.findOne = () => queryResult(null);
  RiskEvent.create = async () => ({ _id: 'event-1' });

  try {
    const res = responseCapture();
    await report({
      body: { transitSessionId: 'session-1', reason: 'route_concern' },
      user: { _id: 'user-1', name: 'Mina' }
    }, res, () => {});
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.riskLevel, 'LOW');
    assert.equal(res.body.recommendedAction, 'CONTINUE_MONITORING');
    assert.equal(res.body.eventId, 'event-1');
  } finally {
    TransitSession.findOne = originalSessionFindOne;
    RiskEvent.findOne = originalRiskFindOne;
    RiskEvent.create = originalRiskCreate;
  }
});

test('risk report rejects an unowned transit session', async () => {
  const originalSessionFindOne = TransitSession.findOne;
  TransitSession.findOne = async () => null;
  try {
    const res = responseCapture();
    await report({
      body: { transitSessionId: 'session-unknown', reason: 'other' },
      user: { _id: 'user-1', name: 'Mina' }
    }, res, () => {});
    assert.equal(res.statusCode, 404);
  } finally {
    TransitSession.findOne = originalSessionFindOne;
  }
});

test('risk report returns the existing event for a duplicate request', async () => {
  const originalSessionFindOne = TransitSession.findOne;
  const originalRiskFindOne = RiskEvent.findOne;
  const originalRiskCreate = RiskEvent.create;
  TransitSession.findOne = async () => activeSession();
  RiskEvent.findOne = () => queryResult({ _id: 'existing-event' });
  RiskEvent.create = async () => { throw new Error('duplicate event was created'); };
  try {
    const res = responseCapture();
    await report({
      body: { transitSessionId: 'session-1', reason: 'other' },
      user: { _id: 'user-1', name: 'Mina' }
    }, res, () => {});
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.eventId, 'existing-event');
  } finally {
    TransitSession.findOne = originalSessionFindOne;
    RiskEvent.findOne = originalRiskFindOne;
    RiskEvent.create = originalRiskCreate;
  }
});

test('high risk reports confirmed trusted-contact delivery', async () => {
  const originalService = process.env.NOTIFICATION_SERVICE;
  const originalSessionFindOne = TransitSession.findOne;
  const originalRiskFindOne = RiskEvent.findOne;
  const originalRiskCreate = RiskEvent.create;
  const originalContactsFind = EmergencyContact.find;
  process.env.NOTIFICATION_SERVICE = 'test';
  TransitSession.findOne = async () => activeSession();
  RiskEvent.findOne = () => queryResult(null);
  RiskEvent.create = async () => ({ _id: 'high-event' });
  EmergencyContact.find = async () => [{ phone: '+910000000000' }];
  try {
    const res = responseCapture();
    await report({
      body: { transitSessionId: 'session-1', reason: 'suspicious_activity' },
      user: { _id: 'user-1', name: 'Mina' }
    }, res, () => {});
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.riskLevel, 'HIGH');
    assert.equal(res.body.trustedContactsNotified, true);
    assert.equal(res.body.notificationStatus, 'triggered');
  } finally {
    process.env.NOTIFICATION_SERVICE = originalService;
    TransitSession.findOne = originalSessionFindOne;
    RiskEvent.findOne = originalRiskFindOne;
    RiskEvent.create = originalRiskCreate;
    EmergencyContact.find = originalContactsFind;
  }
});

test('critical risk uses the existing emergency workflow', async () => {
  const originalSessionFindOne = TransitSession.findOne;
  const originalRiskFindOne = RiskEvent.findOne;
  const originalRiskCreate = RiskEvent.create;
  const originalAlertCreate = EmergencyAlert.create;
  const session = activeSession(20);
  TransitSession.findOne = async () => session;
  RiskEvent.findOne = () => queryResult(null);
  RiskEvent.create = async () => ({ _id: 'critical-event' });
  EmergencyAlert.create = async () => ({ _id: 'alert-1', status: 'pending' });
  try {
    const res = responseCapture();
    await report({
      body: { transitSessionId: 'session-1', reason: 'suspicious_activity' },
      user: { _id: 'user-1', name: 'Mina' }
    }, res, () => {});
    assert.equal(res.statusCode, 201);
    assert.equal(res.body.riskLevel, 'CRITICAL');
    assert.equal(res.body.emergency.alertId, 'alert-1');
  } finally {
    TransitSession.findOne = originalSessionFindOne;
    RiskEvent.findOne = originalRiskFindOne;
    RiskEvent.create = originalRiskCreate;
    EmergencyAlert.create = originalAlertCreate;
  }
});
