const express = require('express');
const router = express.Router();
const { getProfile, updateProfile } = require('../controllers/patientController');
const { verifyToken, authorizeRoles } = require('../middlewares/authMiddleware');

router.use(verifyToken);
router.use(authorizeRoles('PATIENT'));

router.get('/profile', getProfile);
router.put('/profile', updateProfile);

module.exports = router;
