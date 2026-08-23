const { pool } = require('../services/db');
const { encrypt, decrypt } = require('../utils/encryption');

const getProfile = async (req, res) => {
  const userId = req.user.userId;

  try {
    const result = await pool.query(
      `SELECT * FROM patient_profiles WHERE user_id = $1`,
      [userId]
    );

    if (result.rows.length === 0) {
      // Return empty profile gracefully if it doesn't exist yet
      return res.json({
        user_id: userId,
        chronic_diseases: '',
        allergies: '',
        past_surgeries: ''
      });
    }

    const profile = result.rows[0];
    profile.chronic_diseases = decrypt(profile.chronic_diseases);
    profile.allergies = decrypt(profile.allergies);
    profile.past_surgeries = decrypt(profile.past_surgeries);

    res.json(profile);
  } catch (error) {
    console.error('getProfile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProfile = async (req, res) => {
  const userId = req.user.userId;
  const { chronicDiseases, allergies, pastSurgeries } = req.body;

  try {
    const result = await pool.query(
      `INSERT INTO patient_profiles (user_id, chronic_diseases, allergies, past_surgeries, updated_at)
       VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP)
       ON CONFLICT (user_id) 
       DO UPDATE SET 
         chronic_diseases = EXCLUDED.chronic_diseases,
         allergies = EXCLUDED.allergies,
         past_surgeries = EXCLUDED.past_surgeries,
         updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [userId, encrypt(chronicDiseases) || '', encrypt(allergies) || '', encrypt(pastSurgeries) || '']
    );

    const profile = result.rows[0];
    profile.chronic_diseases = decrypt(profile.chronic_diseases);
    profile.allergies = decrypt(profile.allergies);
    profile.past_surgeries = decrypt(profile.past_surgeries);

    res.json(profile);
  } catch (error) {
    console.error('updateProfile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getProfile,
  updateProfile
};
