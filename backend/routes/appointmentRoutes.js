const express = require('express');
const router = express.Router();
const { createAppointment, getUserAppointments, completeAppointment, cancelAppointment } = require('../controllers/appointmentController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);

router.post('/', authorizeRoles('PATIENT'), createAppointment);
router.get('/me', getUserAppointments); // Any authenticated user can view their own
router.put('/:id/complete', authorizeRoles('DOCTOR'), completeAppointment);
router.put('/:id/cancel', authorizeRoles('PATIENT', 'DOCTOR', 'ADMIN'), cancelAppointment);

module.exports = router;
