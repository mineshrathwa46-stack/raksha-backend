const express = require('express');
const { calculateRoutes } = require('../controllers/route.controller');

const router = express.Router();

router.post('/calculate', calculateRoutes);

module.exports = router;
