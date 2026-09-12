const mongoose = require('mongoose');

const emergencyAlertSchema = new mongoose.Schema({
  transitSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TransitSession', required: true, index: true },
  triggeredBy: { type: String, required: true },
  status: { type: String, enum: ['triggered', 'acknowledged', 'resolved'], default: 'triggered' },
  message: { type: String, required: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('EmergencyAlert', emergencyAlertSchema);
