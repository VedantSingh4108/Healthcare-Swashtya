const { pool } = require('../services/db');
const emailService = require('../services/emailService');
const calendarService = require('../services/calendarService');

const updateDoctorProfile = async (req, res) => {
  const { id } = req.params;
  const { specialization, workingHoursStart, workingHoursEnd, slotDurationMins } = req.body;

  try {
    const result = await pool.query(
      `UPDATE doctor_profiles 
       SET specialization = $1, working_hours_start = $2, working_hours_end = $3, slot_duration_mins = $4 
       WHERE user_id = $5 RETURNING *`,
      [specialization, workingHoursStart, workingHoursEnd, slotDurationMins, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error('updateDoctorProfile error:', error);
    res.status(500).json({ error: 'Internal server error updating doctor profile' });
  }
};

const markDoctorLeave = async (req, res) => {
  const { doctorId, leaveDate, reason } = req.body;

  if (!doctorId || !leaveDate) {
    return res.status(400).json({ error: 'doctorId and leaveDate are required' });
  }

  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // Insert leave
    await client.query(
      'INSERT INTO doctor_leaves (doctor_id, leave_date, reason) VALUES ($1, $2, $3)',
      [doctorId, leaveDate, reason || null]
    );

    // Cancel conflicting appointments
    const cancelResult = await client.query(
      `UPDATE appointments a
       SET status = 'CANCELLED' 
       WHERE a.doctor_id = $1 AND DATE(a.slot_start) = $2 AND a.status = 'CONFIRMED'
       RETURNING a.*, 
                 (SELECT email FROM users WHERE id = a.patient_id) as patient_email,
                 (SELECT name FROM users WHERE id = a.patient_id) as patient_name,
                 (SELECT email FROM users WHERE id = a.doctor_id) as doctor_email,
                 (SELECT name FROM users WHERE id = a.doctor_id) as doctor_name`,
      [doctorId, leaveDate]
    );

    await client.query('COMMIT');
    
    // Trigger emails and calendar deletion
    for (const appt of cancelResult.rows) {
      if (appt.calendar_event_id) {
        calendarService.deleteEvent(appt.calendar_event_id).catch(err => console.error(err));
      }
      emailService.sendCancellationNotification(appt).catch(err => console.error(err));
    }
    
    res.json({ success: true, cancelledCount: cancelResult.rows.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('markDoctorLeave error:', error);
    res.status(500).json({ error: 'Internal server error marking leave' });
  } finally {
    client.release();
  }
};

module.exports = {
  updateDoctorProfile,
  markDoctorLeave
};
