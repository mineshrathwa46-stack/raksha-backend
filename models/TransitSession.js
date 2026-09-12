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
  driverName: String,
  trustedContacts: [String],
  selectedRouteId: String,
  routeGeometry: [ [Number] ],
  routeDistance: Number,
  routeDuration: Number,
  routeSafetyScore: Number,
  routeSafetyFactors: [String],
  origin: pointSchema,
  currentLocation: pointSchema,
  routeDeviationState: { type: String, enum: ['ON_ROUTE', 'POSSIBLE_DEVIATION', 'DEVIATED'], default: 'ON_ROUTE' },
  consecutiveOffRouteUpdates: { type: Number, default: 0, min: 0 },
  riskScore: { type: Number, default: 0, min: 0, max: 100 },
  riskLevel: { type: String, enum: ['low', 'medium', 'high', 'critical'], default: 'low' }
}, { timestamps: true });

transitSessionSchema.index({ currentLocation: '2dsphere' });
module.exports = mongoose.model('TransitSession', transitSessionSchema);
