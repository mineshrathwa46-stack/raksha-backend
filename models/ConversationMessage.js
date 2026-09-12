const mongoose = require('mongoose');

const conversationMessageSchema = new mongoose.Schema({
  transitSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TransitSession', required: true, index: true },
  role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
  text: { type: String, required: true },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model('ConversationMessage', conversationMessageSchema);
