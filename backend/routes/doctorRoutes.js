const express = require('express');
const router = express.Router();
const { getDoctors, markLeave, getAvailableSlots, getPatientSummary } = require('../controllers/doctorController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.get('/', getDoctors);
router.get('/:id/available-slots', getAvailableSlots);
router.post('/:id/leave', verifyToken, authorizeRoles('ADMIN'), markLeave);
router.get('/patients/:patientId/summary', verifyToken, authorizeRoles('DOCTOR'), getPatientSummary);

module.exports = router;
