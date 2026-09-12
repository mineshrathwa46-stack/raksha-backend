const express = require('express');
const controller = require('../controllers/transit.controller');
const { requireAuth } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(requireAuth);
router.post('/start', controller.start);
router.get('/:id', controller.getById);
router.post('/:id/location', controller.addLocation);
router.post('/:id/check-in', controller.checkIn);
router.post('/:id/end', controller.end);
router.get('/:id/events', controller.events);
module.exports = router;
