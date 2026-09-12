const mongoose = require('mongoose');

const pointSchema = new mongoose.Schema({
  type: { type: String, enum: ['Point'], default: 'Point' },
  coordinates: { type: [Number], required: true }
}, { _id: false });

const transitSessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' },
  startedAt: { type: Date, default: Date.now },
  endedAt: Date,
   destination: String,
  vehicleType: String,
  vehicleNumber: String,
  currentLocation: pointSchema,
  riskScore: { type: Number, default: 0, min: 0, max: 100 },
  riskLevel: { type: String, enum: ['low', 'medium', 'high'], default: 'low' }
}, { timestamps: true });

transitSessionSchema.index({ currentLocation: '2dsphere' });
module.exports = mongoose.model('TransitSession', transitSessionSchema);
