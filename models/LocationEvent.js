const mongoose = require('mongoose');

const locationEventSchema = new mongoose.Schema({
  transitSessionId: { type: mongoose.Schema.Types.ObjectId, ref: 'TransitSession', required: true, index: true },
  location: {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], required: true }
  },
  timestamp: { type: Date, default: Date.now }
});

locationEventSchema.index({ location: '2dsphere' });
module.exports = mongoose.model('LocationEvent', locationEventSchema);
