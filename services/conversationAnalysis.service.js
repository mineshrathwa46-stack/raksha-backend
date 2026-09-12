const { z } = require('zod');

const analysisSchema = z.object({
  location: z.string().nullable(),
  vehicleType: z.string().nullable(),
  vehicleNumber: z.string().nullable(),
  driverBehaviour: z.string().nullable(),
  safetyConcern: z.boolean(),
  stressSignal: z.enum(['low', 'medium', 'elevated', 'critical', 'unknown']).nullable(),
  needsFollowUp: z.boolean(),
  explicitHelpRequest: z.boolean().default(false),
  repeatedConcerningMessages: z.number().int().nonnegative().default(0),
  explicitSignals: z.object({
    location: z.boolean().default(false),
    vehicleType: z.boolean().default(false),
    vehicleNumber: z.boolean().default(false),
    driverBehaviour: z.boolean().default(false),
    safetyConcern: z.boolean().default(false),
    helpRequest: z.boolean().default(false)
  }).default({}),
  inferredSignals: z.object({
    location: z.boolean().default(false),
    vehicleType: z.boolean().default(false),
    vehicleNumber: z.boolean().default(false),
    driverBehaviour: z.boolean().default(false),
    safetyConcern: z.boolean().default(false),
    helpRequest: z.boolean().default(false)
  }).default({})
}).strict();

function normalize(text = '') {
  return String(text || '').trim();
}

function extractLocation(text) {
  const patterns = [
    /(?:at|near|around|by|outside|beside|opposite)\s+([A-Za-z0-9\s,.-]{2,80})/i,
    /([A-Za-z][A-Za-z0-9\s,.-]{2,60})\s+(?:chaukdi|station|bus stand|crossing|gate|market|square|stop)/i,
    /(?:i am|i'm|hoon|hai)\s+(?:at|near|around)\s+([A-Za-z0-9\s,.-]{2,80})/i
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) return match[1].trim().replace(/\s+/g, ' ');
  }
  return null;
}

function extractVehicleType(text) {
  const lower = text.toLowerCase();
  if (/(auto|rickshaw|autorickshaw|three wheeler)/i.test(lower)) return 'auto';
  if (/(cab|taxi|uber|ola)/i.test(lower)) return 'cab';
  if (/(bike|motorbike|scooter)/i.test(lower)) return 'bike';
  if (/(bus|tempo)/i.test(lower)) return 'bus';
  return null;
}

function extractVehicleNumber(text) {
  const match = text.match(/(?:vehicle|auto|cab|bike|number|plate|numberplate|no\.?|no\s*[:#-])\s*[:#-]?\s*([A-Z]{2}[ -]?[0-9A-Z]{2,10})/i);
  return match ? match[1].trim().toUpperCase() : null;
}

function extractDriverBehaviour(text) {
  const lower = text.toLowerCase();
  if (/(strange|weird|unsafe|rough|drunk|intoxicated|threat|suspicious|ajeeb|aggressive|scary|bad)/i.test(lower)) return 'concerning';
  if (/(good|nice|polite|safe|calm|normal)/i.test(lower)) return 'normal';
  return null;
}

function inferStressSignal(text) {
  const lower = text.toLowerCase();
  if (/(panic|scared|afraid|danger|help|rescue|emergency|critical|unsafe|threat|please help)/i.test(lower)) return 'critical';
  if (/(nervous|stress|anxious|worried|uneasy|trapped|in trouble|unsafe)/i.test(lower)) return 'elevated';
  if (/(okay|fine|safe|calm|comfortable)/i.test(lower)) return 'low';
  return 'medium';
}

async function analyzeConversation(text = '') {
  const normalized = normalize(text);
  if (!normalized) {
    return analysisSchema.parse({
      location: null,
      vehicleType: null,
      vehicleNumber: null,
      driverBehaviour: null,
      safetyConcern: false,
      stressSignal: null,
      needsFollowUp: false,
      explicitHelpRequest: false,
      repeatedConcerningMessages: 0,
      explicitSignals: {
        location: false,
        vehicleType: false,
        vehicleNumber: false,
        driverBehaviour: false,
        safetyConcern: false,
        helpRequest: false
      },
      inferredSignals: {
        location: false,
        vehicleType: false,
        vehicleNumber: false,
        driverBehaviour: false,
        safetyConcern: false,
        helpRequest: false
      }
    });
  }

  const lower = normalized.toLowerCase();
  const explicitHelpRequest = /(help|save me|please help|emergency|danger|unsafe|threat|police|medical)/i.test(lower);
  const location = extractLocation(normalized);
  const vehicleType = extractVehicleType(normalized);
  const vehicleNumber = extractVehicleNumber(normalized);
  const driverBehaviour = extractDriverBehaviour(normalized);
  const safetyConcern = explicitHelpRequest || /(unsafe|danger|scared|afraid|strange|weird|ajeeb|threat|uncomfortable)/i.test(lower) || Boolean(driverBehaviour && driverBehaviour === 'concerning');
  const stressSignal = inferStressSignal(normalized);
  const needsFollowUp = safetyConcern || Boolean(location) || Boolean(vehicleType) || Boolean(driverBehaviour) || explicitHelpRequest;

  const result = {
    location,
    vehicleType,
    vehicleNumber,
    driverBehaviour,
    safetyConcern,
    stressSignal,
    needsFollowUp,
    explicitHelpRequest,
    repeatedConcerningMessages: 0,
    explicitSignals: {
      location: Boolean(location),
      vehicleType: Boolean(vehicleType),
      vehicleNumber: Boolean(vehicleNumber),
      driverBehaviour: Boolean(driverBehaviour),
      safetyConcern,
      helpRequest: explicitHelpRequest
    },
    inferredSignals: {
      location: false,
      vehicleType: false,
      vehicleNumber: false,
      driverBehaviour: driverBehaviour === 'concerning',
      safetyConcern: safetyConcern && !explicitHelpRequest,
      helpRequest: false
    }
  };

  if (process.env.AI_MOCK_MODE === 'false' && process.env.OPENAI_API_KEY) {
    try {
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'gpt-4o-mini',
          messages: [
            { role: 'system', content: 'Return compact JSON only with keys: location, vehicleType, vehicleNumber, driverBehaviour, safetyConcern, stressSignal, needsFollowUp, explicitHelpRequest, repeatedConcerningMessages.' },
            { role: 'user', content: normalized }
          ],
          temperature: 0.1
        })
      });

      if (response && response.ok) {
        const payload = await response.json().catch(() => null);
        const content = payload?.choices?.[0]?.message?.content || '';
        const parsed = JSON.parse(content.replace(/```json|```/g, '').trim());
        return analysisSchema.parse({ ...result, ...parsed });
      }
    } catch (error) {
      // Fallback to deterministic local analysis when external AI is unavailable.
    }
  }

  return analysisSchema.parse(result);
}

function validateAnalysis(analysis) {
  return analysisSchema.parse(analysis);
}

module.exports = { analyzeConversation, validateAnalysis };
