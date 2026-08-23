const { pool } = require('./db');
const { encrypt, decrypt } = require('../utils/encryption');

const bookAppointment = async (patientId, doctorId, date, time, symptoms, urgencyLevel, preVisitSummary) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 0. Fetch Doctor Profile & Validate Schedule
    const profileRes = await client.query(
      `SELECT working_hours_start, working_hours_end, break_start, break_end, slot_duration_mins, working_days 
       FROM doctor_profiles WHERE user_id = $1`,
      [doctorId]
    );

    if (profileRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return { success: false, status: 404, message: 'Doctor profile not found' };
    }

    const profile = profileRes.rows[0];
    
    // Validate Day of Week (using pure ISO Date math without time to avoid offset issues)
    const [year, month, day] = date.split('-').map(Number);
    const slotDate = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = slotDate.getUTCDay();
    const workingDays = profile.working_days || [1, 2, 3, 4, 5, 6];

    if (!workingDays.includes(dayOfWeek)) {
      await client.query('ROLLBACK');
      return { success: false, status: 400, message: 'Requested day is a non-working day for this doctor' };
    }

    // Validation for time boundaries via pure string comparison
    const reqStartStr = time; // e.g. "09:00"
    
    // compute end time string
    const [h, m] = time.split(':').map(Number);
    const endTotalMins = h * 60 + m + (profile.slot_duration_mins || 30);
    const endH = String(Math.floor(endTotalMins / 60)).padStart(2, '0');
    const endM = String(endTotalMins % 60).padStart(2, '0');
    const reqEndStr = `${endH}:${endM}`;

    const workStartStr = profile.working_hours_start.substring(0, 5);
    const workEndStr = profile.working_hours_end.substring(0, 5);
    const breakStartStr = (profile.break_start || '13:00').substring(0, 5);
    const breakEndStr = (profile.break_end || '14:00').substring(0, 5);

    if (reqStartStr < workStartStr || reqEndStr > workEndStr) {
      await client.query('ROLLBACK');
      return { success: false, status: 400, message: 'Requested slot is outside working hours' };
    }

    const isDuringBreak = (reqStartStr >= breakStartStr && reqStartStr < breakEndStr) || 
                          (reqEndStr > breakStartStr && reqEndStr <= breakEndStr);

    if (isDuringBreak) {
      await client.query('ROLLBACK');
      return { success: false, status: 400, message: 'Requested slot is during break time' };
    }

    // 1. Check if doctor is on leave for the requested date
    const leaveDateStr = date;
    const leaveResult = await client.query(
      'SELECT id FROM doctor_leaves WHERE doctor_id = $1 AND leave_date = $2',
      [doctorId, leaveDateStr]
    );

    if (leaveResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, status: 409, message: 'Doctor is on leave on the requested date' };
    }

    // 2. Check slot conflict with row-level locking
    const slotStartStr = `${date} ${time}`;
    const slotEndStr = `${date} ${reqEndStr}`;

    const conflictResult = await client.query(
      "SELECT id FROM appointments WHERE doctor_id = $1 AND slot_start = $2::TIMESTAMP AND status != 'CANCELLED' FOR UPDATE",
      [doctorId, slotStartStr]
    );

    if (conflictResult.rows.length > 0) {
      await client.query('ROLLBACK');
      return { success: false, status: 409, message: 'Time slot is already booked' };
    }

    // 3. Insert new appointment and fetch patient and doctor details
    const encryptedSymptoms = encrypt(symptoms);
    const insertResult = await client.query(
      `WITH new_appt AS (
        INSERT INTO appointments 
        (patient_id, doctor_id, slot_start, slot_end, symptoms, urgency_level, pre_visit_summary) 
        VALUES ($1, $2, $3::TIMESTAMP, $4::TIMESTAMP, $5, $6, $7) RETURNING *
      )
      SELECT a.*, 
             TO_CHAR(a.slot_start, 'YYYY-MM-DD HH24:MI') as slot_start_str,
             TO_CHAR(a.slot_end, 'YYYY-MM-DD HH24:MI') as slot_end_str,
             p.email AS patient_email, p.name AS patient_name,
             d.email AS doctor_email, d.name AS doctor_name
      FROM new_appt a
      JOIN users p ON a.patient_id = p.id
      JOIN users d ON a.doctor_id = d.id`,
      [patientId, doctorId, slotStartStr, slotEndStr, encryptedSymptoms, urgencyLevel, preVisitSummary]
    );

    await client.query('COMMIT');
    const appointment = insertResult.rows[0];
    appointment.symptoms = decrypt(appointment.symptoms);
    return { success: true, appointment };

  } catch (error) {
    await client.query('ROLLBACK');
    // Handle unique constraint violation on unique_doctor_active_slot
    if (error.code === '23505') {
      return { success: false, status: 409, message: 'Concurrency conflict: Time slot was just booked by another user.' };
    }
    console.error('Booking transaction error:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  bookAppointment
};
