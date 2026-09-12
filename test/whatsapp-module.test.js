const test = require('node:test');
const assert = require('node:assert/strict');

const { verifyWebhook, handleWebhook } = require('../controllers/whatsapp.controller');
const { sendTextMessage } = require('../services/whatsapp.service');
const { analyzeConversation, validateAnalysis } = require('../services/conversationAnalysis.service');
const { calculateRiskFromSignals } = require('../services/riskAnalysis.service');
const User = require('../models/User');
const TransitSession = require('../models/TransitSession');
const ConversationMessage = require('../models/ConversationMessage');
const RiskEvent = require('../models/RiskEvent');

const originalEnv = { ...process.env };

function setEnv(overrides = {}) {
  process.env = { ...originalEnv, ...overrides };
}

function makeRes() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    send(payload) {
      this.body = payload;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    }
  };
}

test.beforeEach(() => {
  setEnv({
    WHATSAPP_VERIFY_TOKEN: 'demo-token',
    WHATSAPP_MOCK_MODE: 'true',
    AI_MOCK_MODE: 'true',
    WHATSAPP_ACCESS_TOKEN: 'demo-access-token',
    WHATSAPP_PHONE_NUMBER_ID: '12345'
  });
  global.fetch = async () => ({ ok: true, json: async () => ({}) });
  User.findOne = async () => null;
  TransitSession.findOne = async () => null;
  ConversationMessage.findOne = async () => null;
  ConversationMessage.create = async () => ({ _id: 'cm1' });
  RiskEvent.create = async () => ({ _id: 're1' });
});

test.afterEach(() => {
  process.env = { ...originalEnv };
  delete global.fetch;
});

test('webhook verification', () => {
  const req = { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'demo-token', 'hub.challenge': 'challenge-123' } };
  const res = makeRes();

  verifyWebhook(req, res);

  assert.equal(res.statusCode, 200);
  assert.equal(res.body, 'challenge-123');
});

test('invalid verification token', () => {
  const req = { query: { 'hub.mode': 'subscribe', 'hub.verify_token': 'wrong-token', 'hub.challenge': 'challenge-123' } };
  const res = makeRes();

  verifyWebhook(req, res);

  assert.equal(res.statusCode, 403);
  assert.equal(res.body, 'Verification failed');
});

test('incoming text message', async () => {
  const req = {
    body: {
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: '919999999999',
              id: 'wamsg-1',
              type: 'text',
              text: { body: 'Driver thoda ajeeb behave kar raha hai.' },
              timestamp: '1710000000'
            }],
            metadata: { phone_number_id: '12345' }
          }
        }]
      }]
    }
  };
  const res = makeRes();

  User.findOne = async () => ({ _id: 'user-1', phone: '919999999999' });
  TransitSession.findOne = async () => ({ _id: 'session-1', userId: 'user-1', status: 'active' });

  await handleWebhook(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body && typeof res.body === 'object');
});

test('unknown WhatsApp user', async () => {
  const req = {
    body: {
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: '919999999999',
              id: 'wamsg-2',
              type: 'text',
              text: { body: 'Hi' },
              timestamp: '1710000001'
            }],
            metadata: { phone_number_id: '12345' }
          }
        }]
      }]
    }
  };
  const res = makeRes();

  await handleWebhook(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body && typeof res.body.reply === 'string');
  assert.match(res.body.reply, /not yet linked|safe generic|unknown/i);
});

test('no active transit', async () => {
  const req = {
    body: {
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: '919999999999',
              id: 'wamsg-3',
              type: 'text',
              text: { body: 'Hi' },
              timestamp: '1710000002'
            }],
            metadata: { phone_number_id: '12345' }
          }
        }]
      }]
    }
  };
  const res = makeRes();

  User.findOne = async () => ({ _id: 'user-2', phone: '919999999999' });

  await handleWebhook(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body && typeof res.body.reply === 'string');
  assert.match(res.body.reply, /safe transit|start a safe transit/i);
});

test('active transit message', async () => {
  const req = {
    body: {
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: '919999999999',
              id: 'wamsg-4',
              type: 'text',
              text: { body: 'Kahan pahunchi?' },
              timestamp: '1710000003'
            }],
            metadata: { phone_number_id: '12345' }
          }
        }]
      }]
    }
  };
  const res = makeRes();

  User.findOne = async () => ({ _id: 'user-3', phone: '919999999999' });
  TransitSession.findOne = async () => ({ _id: 'session-3', userId: 'user-3', status: 'active', vehicleType: 'auto' });
  ConversationMessage.create = async () => ({ _id: 'cm-3' });

  await handleWebhook(req, res);

  assert.equal(res.statusCode, 200);
  assert.ok(res.body && typeof res.body === 'object');
  assert.ok(/Kahan pahunchi|Driver kaisa|Sab theek|Auto number/i.test(String(res.body.message || res.body.reply || JSON.stringify(res.body))));
});

test('AI structured response', async () => {
  const analysis = await analyzeConversation('Driver thoda ajeeb behave kar raha hai.');

  validateAnalysis(analysis);
  assert.equal(analysis.driverBehaviour, 'concerning');
  assert.equal(analysis.safetyConcern, true);
  assert.ok(['low', 'medium', 'high', 'elevated'].includes(analysis.stressSignal || 'low'));
});

test('risk score calculation', () => {
  const result = calculateRiskFromSignals({
    safetyConcern: true,
    driverBehaviour: 'concerning',
    stressSignal: 'elevated',
    needsFollowUp: true,
    repeatedConcerningMessages: 2
  });

  assert.ok(result.riskScore >= 0 && result.riskScore <= 100);
  assert.ok(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].includes(result.riskLevel));
});

test('HIGH/CRITICAL risk', () => {
  const high = calculateRiskFromSignals({ safetyConcern: true, driverBehaviour: 'concerning', explicitHelpRequest: true, repeatedConcerningMessages: 3 });
  const critical = calculateRiskFromSignals({ explicitHelpRequest: true, safetyConcern: true, stressSignal: 'critical' });

  assert.ok(['HIGH', 'CRITICAL'].includes(high.riskLevel));
  assert.equal(critical.riskLevel, 'CRITICAL');
});

test('duplicate webhook message', async () => {
  const req = {
    body: {
      entry: [{
        changes: [{
          value: {
            messages: [{
              from: '919999999999',
              id: 'duplicate-1',
              type: 'text',
              text: { body: 'Test duplicate' },
              timestamp: '1710000010'
            }],
            metadata: { phone_number_id: '12345' }
          }
        }]
      }]
    }
  };
  const res = makeRes();

  User.findOne = async () => ({ _id: 'user-4', phone: '919999999999' });
  TransitSession.findOne = async () => ({ _id: 'session-4', userId: 'user-4', status: 'active' });
  let createCalls = 0;
  let duplicateCheckCount = 0;
  ConversationMessage.create = async () => {
    createCalls += 1;
    return { _id: 'created' };
  };
  ConversationMessage.findOne = async () => {
    duplicateCheckCount += 1;
    return duplicateCheckCount === 1 ? null : { _id: 'existing' };
  };

  await handleWebhook(req, res);
  await handleWebhook(req, res);

  assert.equal(createCalls, 1);
  assert.equal(duplicateCheckCount, 2);
});

test('WhatsApp API failure', async () => {
  setEnv({ WHATSAPP_MOCK_MODE: 'false', WHATSAPP_ACCESS_TOKEN: '' });
  const result = await sendTextMessage('919999999999', 'hello world');

  assert.equal(result.ok, false);
  assert.ok(result.error);
});

test('AI API failure', async () => {
  setEnv({ AI_MOCK_MODE: 'false', OPENAI_API_KEY: 'invalid-key' });
  global.fetch = async () => {
    throw new Error('Network failure');
  };

  const analysis = await analyzeConversation('Driver is acting weird.');

  assert.ok(analysis);
  assert.ok(analysis.location === null || typeof analysis.location === 'string');
  assert.equal(analysis.safetyConcern, true);
});
