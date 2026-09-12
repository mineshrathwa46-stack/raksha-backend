const bcrypt = require('bcrypt');
const { z } = require('zod');
const User = require('../models/User');
const { createToken } = require('../utils/jwt');

const registerSchema = z.object({
  name: z.string().min(1), phone: z.string().min(5), email: z.string().email(), password: z.string().min(6)
});
const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

async function register(req, res, next) {
  try {
    const data = registerSchema.parse(req.body);
    const existing = await User.findOne({ email: data.email.toLowerCase() });
    if (existing) return res.status(409).json({ message: 'Email already registered' });

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await User.create({ ...data, email: data.email.toLowerCase(), passwordHash });
    res.status(201).json({ user: user.toJSON(), token: createToken(user._id) });
  } catch (error) { next(error); }
}

async function login(req, res, next) {
  try {
    const data = loginSchema.parse(req.body);
    const user = await User.findOne({ email: data.email.toLowerCase() }).select('+passwordHash');
    if (!user || !(await bcrypt.compare(data.password, user.passwordHash))) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }
    user.passwordHash = undefined;
    res.json({ user, token: createToken(user._id) });
  } catch (error) { next(error); }
}

async function me(req, res) { res.json({ user: req.user }); }

module.exports = { register, login, me };
