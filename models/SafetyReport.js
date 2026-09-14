const mongoose = require('mongoose');

const safetyReportSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  location: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
      required: true
    },
    coordinates: { type: [Number], required: true }
  },
  category: {
    type: String,
    enum: ['unsafe_area', 'harassment', 'poor_lighting', 'suspicious_activity', 'isolated_area', 'road_issue', 'safe_area', 'other'],
    required: true
  },
  severity: { type: String, enum: ['low', 'medium', 'high'], default: 'medium' },
  description: { type: String, required: true, maxlength: 500 },
  status: { type: String, enum: ['active', 'resolved', 'under_review'], default: 'active' },
  source: { type: String, enum: ['user'], default: 'user' }
}, { timestamps: true });

safetyReportSchema.index({ location: '2dsphere' });
safetyReportSchema.index({ status: 1, category: 1, createdAt: -1 });

module.exports = mongoose.model('SafetyReport', safetyReportSchema);
