const mongoose = require('mongoose');

const riskEventSchema = new mongoose.Schema({
  transitSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TransitSession', required: true, index: true },
  type: { type: String, required: true },
  severity: { type: String, enum: ['low', 'medium', 'high', 'critical'], required: true },
  description: { type: String, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('RiskEvent', riskEventSchema);
