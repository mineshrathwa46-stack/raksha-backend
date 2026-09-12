const express = require('express');
const { createAlert, getAlerts } = require('../controllers/emergency.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);
router.post('/alert', createAlert);
router.get('/:transitSessionId', getAlerts);
module.exports = router;
