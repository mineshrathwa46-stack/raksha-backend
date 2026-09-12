const express = require('express');
const { report } = require('../controllers/risk.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);
router.post('/report', report);

module.exports = router;
