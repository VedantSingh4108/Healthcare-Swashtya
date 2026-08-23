const { pool } = require('../services/db');
const { encrypt, decrypt } = require('../utils/encryption');

const getProfile = async (req, res) => {
  const { userId, role } = req.user;
  
  try {
    const userRes = await pool.query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [userId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    const user = userRes.rows[0];
    let profileData = {};
    
    if (role === 'PATIENT') {
      const pRes = await pool.query('SELECT * FROM patient_profiles WHERE user_id = $1', [userId]);
      if (pRes.rows.length > 0) {
        profileData = pRes.rows[0];
        profileData.chronic_diseases = decrypt(profileData.chronic_diseases) || '';
        profileData.allergies = decrypt(profileData.allergies) || '';
        profileData.past_surgeries = decrypt(profileData.past_surgeries) || '';
      }
    } else if (role === 'DOCTOR') {
      const dRes = await pool.query('SELECT * FROM doctor_profiles WHERE user_id = $1', [userId]);
      if (dRes.rows.length > 0) {
        profileData = dRes.rows[0];
      }
    }
    
    res.json({ user, profile: profileData });
  } catch (error) {
    console.error('getProfile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const updateProfile = async (req, res) => {
  const { userId, role } = req.user;
  const { 
    name, email, // Common
    chronicDiseases, allergies, pastSurgeries, // Patient
    specialization, workingHoursStart, workingHoursEnd // Doctor
  } = req.body;
  
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Update users table (Basic Info)
    if (name || email) {
      await client.query('UPDATE users SET name = COALESCE($1, name), email = COALESCE($2, email) WHERE id = $3', [name, email, userId]);
    }
    
    let updatedProfile = {};
    
    if (role === 'PATIENT') {
      const pRes = await client.query(
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
      updatedProfile = pRes.rows[0];
      updatedProfile.chronic_diseases = decrypt(updatedProfile.chronic_diseases) || '';
      updatedProfile.allergies = decrypt(updatedProfile.allergies) || '';
      updatedProfile.past_surgeries = decrypt(updatedProfile.past_surgeries) || '';
      
    } else if (role === 'DOCTOR') {
      const dRes = await client.query(
        `UPDATE doctor_profiles 
         SET specialization = COALESCE($1, specialization), 
             working_hours_start = COALESCE($2, working_hours_start), 
             working_hours_end = COALESCE($3, working_hours_end)
         WHERE user_id = $4 RETURNING *`,
        [specialization, workingHoursStart, workingHoursEnd, userId]
      );
      if (dRes.rows.length === 0) {
        // Fallback insert if not exists
        const insertRes = await client.query(
          `INSERT INTO doctor_profiles (user_id, specialization, working_hours_start, working_hours_end) 
           VALUES ($1, $2, $3, $4) RETURNING *`,
          [userId, specialization || 'General', workingHoursStart || '09:00', workingHoursEnd || '17:00']
        );
        updatedProfile = insertRes.rows[0];
      } else {
        updatedProfile = dRes.rows[0];
      }
    }
    
    const userRes = await client.query('SELECT id, name, email, role, created_at FROM users WHERE id = $1', [userId]);
    
    await client.query('COMMIT');
    res.json({ user: userRes.rows[0], profile: updatedProfile });
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('updateProfile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

module.exports = {
  getProfile,
  updateProfile
};
