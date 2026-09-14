const express = require('express');
const { createReport, nearbyReports } = require('../controllers/safety.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);
router.post('/reports', createReport);
router.get('/reports/nearby', nearbyReports);

module.exports = router;
