const express = require('express');
const router = express.Router();
const { updateDoctorProfile, markDoctorLeave } = require('../controllers/adminController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.use(authorizeRoles('ADMIN'));

router.put('/doctors/:id', updateDoctorProfile);
router.post('/leaves', markDoctorLeave);

module.exports = router;
