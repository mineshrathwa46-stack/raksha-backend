async function analyzeConversation(text = '') {
  const normalized = text.toLowerCase();
  const concern = ['help', 'danger', 'unsafe', 'threat'].some((word) => normalized.includes(word));
  return {
    summary: concern ? 'Conversation contains a possible safety concern.' : 'No immediate safety concern detected.',
    signals: { behaviorRisk: concern ? 35 : 0 },
    concern
  };
}

module.exports = { analyzeConversation };
