const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  phone: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false }
}, { timestamps: true });

userSchema.set('toJSON', {
  transform: (document, returned) => {
    delete returned.passwordHash;
    return returned;
  }
});

module.exports = mongoose.model('User', userSchema);
