const mongoose = require('mongoose');

const emergencyContactSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  relationship: { type: String, required: true, trim: true }
}, { timestamps: { createdAt: true, updatedAt: false } });

module.exports = mongoose.model('EmergencyContact', emergencyContactSchema);
