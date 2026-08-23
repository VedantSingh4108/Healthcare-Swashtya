const { pool } = require('../services/db');
const axios = require('axios');
const { decrypt } = require('../utils/encryption');
const calendarService = require('../services/calendarService');
const emailService = require('../services/emailService');

const getDoctors = async (req, res) => {
  const { specialization } = req.query;
  
  try {
    let query = `
      SELECT u.id, u.name, u.email, dp.specialization, dp.working_hours_start, dp.working_hours_end, dp.slot_duration_mins
      FROM users u
      JOIN doctor_profiles dp ON u.id = dp.user_id
      WHERE u.role = 'DOCTOR'
    `;
    const params = [];

    if (specialization) {
      query += ` AND dp.specialization ILIKE $1`;
      params.push(`%${specialization}%`);
    }

    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('getDoctors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const markLeave = async (req, res) => {
  const { id } = req.params;
  const { leaveDate, reason } = req.body;

  if (!leaveDate) {
    return res.status(400).json({ error: 'leaveDate is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert leave record
    await client.query(
      'INSERT INTO doctor_leaves (doctor_id, leave_date, reason) VALUES ($1, $2, $3)',
      [id, leaveDate, reason]
    );

    // 2. Query conflicting appointments (appointments on that date that are not cancelled)
    const appointmentsResult = await client.query(
      `SELECT a.*, 
              u.email AS patient_email, u.name AS patient_name,
              d.email AS doctor_email, d.name AS doctor_name
       FROM appointments a
       JOIN users u ON a.patient_id = u.id
       JOIN users d ON a.doctor_id = d.id
       WHERE a.doctor_id = $1 AND DATE(a.slot_start) = $2 AND a.status = 'CONFIRMED' FOR UPDATE`,
      [id, leaveDate]
    );

    // 3. Cancel conflicting appointments
    if (appointmentsResult.rows.length > 0) {
      const appointmentIds = appointmentsResult.rows.map(row => row.id);
      await client.query(
        `UPDATE appointments SET status = 'CANCELLED' WHERE id = ANY($1::int[])`,
        [appointmentIds]
      );
      
      for (const appt of appointmentsResult.rows) {
        try {
          if (appt.calendar_event_id) {
            await calendarService.deleteEvent(appt.calendar_event_id);
          }
          await emailService.sendCancellationNotification(appt);
        } catch (innerError) {
          console.error(`Failed to process cancellation side-effects for appt ${appt.id}:`, innerError);
        }
      }
      console.log(`Cancelled ${appointmentIds.length} appointments for doctor ${id} on ${leaveDate}`);
    }

    await client.query('COMMIT');
    res.json({ message: 'Leave marked and conflicting appointments cancelled', cancelledCount: appointmentsResult.rows.length });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('markLeave error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

const getAvailableSlots = async (req, res) => {
  const { id } = req.params;
  const { date } = req.query; // e.g. YYYY-MM-DD

  if (!date) return res.status(400).json({ error: 'date query parameter is required' });

  try {
    // 1. Fetch Doctor Profile
    const profileRes = await pool.query(
      `SELECT working_hours_start, working_hours_end, break_start, break_end, slot_duration_mins, working_days 
       FROM doctor_profiles WHERE user_id = $1`,
      [id]
    );

    if (profileRes.rows.length === 0) {
      return res.status(404).json({ error: 'Doctor profile not found' });
    }

    const profile = profileRes.rows[0];

    // 2. Check if requested date is in working_days
    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay(); // 0 = Sunday, 1 = Monday...
    const workingDays = profile.working_days || [1, 2, 3, 4, 5, 6];
    if (!workingDays.includes(dayOfWeek)) {
      return res.json({ reason: 'Holiday / Non-working day', slots: [] });
    }

    // 3. Check if doctor is on leave
    const leaveRes = await pool.query(
      `SELECT id FROM doctor_leaves WHERE doctor_id = $1 AND leave_date = $2`,
      [id, date]
    );
    if (leaveRes.rows.length > 0) {
      return res.json({ reason: 'Doctor on Leave', slots: [] });
    }

    // 4. Generate discrete time intervals
    const startTimeStr = profile.working_hours_start;
    const endTimeStr = profile.working_hours_end;
    const breakStartStr = profile.break_start || '13:00';
    const breakEndStr = profile.break_end || '14:00';
    const duration = profile.slot_duration_mins || 30;

    const slots = [];
    const currentSlot = new Date(`${date}T${startTimeStr}`);
    const endSlot = new Date(`${date}T${endTimeStr}`);
    const breakStartSlot = new Date(`${date}T${breakStartStr}`);
    const breakEndSlot = new Date(`${date}T${breakEndStr}`);

    while (currentSlot < endSlot) {
      const slotEnd = new Date(currentSlot.getTime() + duration * 60000);
      
      // Exclude if it overlaps with break
      const isDuringBreak = (currentSlot >= breakStartSlot && currentSlot < breakEndSlot) || 
                            (slotEnd > breakStartSlot && slotEnd <= breakEndSlot);
      
      if (!isDuringBreak && slotEnd <= endSlot) {
        const timeString = currentSlot.toTimeString().substring(0, 5); // 'HH:MM'
        slots.push(timeString);
      }
      currentSlot.setTime(currentSlot.getTime() + duration * 60000);
    }

    // 5. Query active appointments and exclude those times
    const apptRes = await pool.query(
      `SELECT slot_start FROM appointments 
       WHERE doctor_id = $1 AND DATE(slot_start) = $2 AND status != 'CANCELLED'`,
      [id, date]
    );

    const bookedSlots = apptRes.rows.map(row => {
      const d = new Date(row.slot_start);
      // toTimeString() gives 'HH:MM:SS GMT...', substring(0,5) gives 'HH:MM'
      return d.toTimeString().substring(0, 5);
    });
    
    const availableSlots = slots.filter(slot => !bookedSlots.includes(slot));

    res.json({ slots: availableSlots });
  } catch (error) {
    console.error('getAvailableSlots error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

const getPatientSummary = async (req, res) => {
  const { patientId } = req.params;

  try {
    // 1. Fetch patient profile
    const profileRes = await pool.query(
      `SELECT * FROM patient_profiles WHERE user_id = $1`,
      [patientId]
    );
    const profile = profileRes.rows[0] || {};

    // 2. Fetch past completed appointments
    const apptsRes = await pool.query(
      `SELECT clinical_notes, post_visit_summary 
       FROM appointments 
       WHERE patient_id = $1 AND status = 'COMPLETED'
       ORDER BY slot_start DESC`,
      [patientId]
    );

    // Format past notes
    const pastNotes = apptsRes.rows.map((appt, i) => {
      let notes = decrypt(appt.clinical_notes) || 'No clinical notes.';
      let aiSum = appt.post_visit_summary || 'No AI summary.';
      if (typeof aiSum !== 'string') {
        aiSum = aiSum.clinical_summary || aiSum.patient_friendly_summary || JSON.stringify(aiSum);
      }
      return `Visit ${i + 1}:\nClinical Notes: ${notes}\nSummary: ${aiSum}`;
    }).join('\n\n');

    // 3. Call AI Service
    const aiPayload = {
      chronic_diseases: decrypt(profile.chronic_diseases) || 'None reported',
      allergies: decrypt(profile.allergies) || 'None reported',
      surgeries: decrypt(profile.past_surgeries) || 'None reported',
      past_visit_notes: pastNotes || 'No past visits'
    };

    let summary = 'Failed to generate summary.';
    try {
      const aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:5000';
      const aiRes = await axios.post(`${aiServiceUrl}/api/ai/patient-history`, aiPayload);
      if (aiRes.data && aiRes.data.summary) {
        summary = aiRes.data.summary;
      }
    } catch (err) {
      console.error("AI Summary Error:", err.message);
    }

    res.json({ summary });
  } catch (error) {
    console.error('getPatientSummary error:', error);
    res.status(500).json({ error: 'Internal server error generating patient summary' });
  }
};

module.exports = {
  getDoctors,
  markLeave,
  getAvailableSlots,
  getPatientSummary
};
