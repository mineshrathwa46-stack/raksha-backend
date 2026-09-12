const express = require('express');
const { transcribeAudio, analyze, risk } = require('../controllers/ai.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);
router.post('/transcribe', transcribeAudio);
router.post('/analyze', analyze);
router.post('/risk', risk);
module.exports = router;
