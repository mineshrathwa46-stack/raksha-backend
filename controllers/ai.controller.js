const { z } = require('zod');
const { transcribe } = require('../services/speechToText.service');
const { analyzeConversation } = require('../services/conversationAnalysis.service');
const { analyzeRisk } = require('../services/riskAnalysis.service');
const { calculateRiskScore } = require('../utils/riskEngine');

async function transcribeAudio(req, res, next) { try { res.json(await transcribe(req.body)); } catch (error) { next(error); } }
async function analyze(req, res, next) {
  try { const data = z.object({ text: z.string() }).parse(req.body); res.json(await analyzeConversation(data.text)); } catch (error) { next(error); }
}
async function risk(req, res, next) {
  try { const signals = await analyzeRisk(req.body); res.json({ ...signals, final: calculateRiskScore(signals.signals) }); } catch (error) { next(error); }
}

module.exports = { transcribeAudio, analyze, risk };
