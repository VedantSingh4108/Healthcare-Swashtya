const { bookAppointment } = require('../services/appointmentService');
const { pool } = require('../services/db');
const calendarService = require('../services/calendarService');
const emailService = require('../services/emailService');
const { encrypt, decrypt } = require('../utils/encryption');

const createAppointment = async (req, res) => {
  const { doctorId, date, time, symptoms } = req.body;
  const patientId = req.user.userId;

  if (!doctorId || !date || !time || !symptoms) {
    return res.status(400).json({ error: 'doctorId, date, time, and symptoms are required' });
  }

  try {
    let urgencyLevel = 'MEDIUM';
    let preVisitSummary = {
      chief_complaint: 'Unknown',
      suggested_questions: []
    };

    // Call AI Pre-Visit Service
    try {
      const aiRes = await fetch('http://localhost:5000/api/ai/pre-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symptoms })
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        
        if (aiData.status === 'fallback') {
          urgencyLevel = aiData.urgency_level.toUpperCase();
          preVisitSummary = {
            chief_complaint: aiData.chief_complaint,
            suggested_questions: aiData.questions_for_doctor
          };
        } else if (aiData.data) {
          // Parse the text or assume the AI service can return json
          const text = aiData.data.toLowerCase();
          if (text.includes('high')) urgencyLevel = 'HIGH';
          else if (text.includes('low')) urgencyLevel = 'LOW';
          
          preVisitSummary = {
            raw_ai_summary: aiData.data,
            chief_complaint: 'See raw summary',
            suggested_questions: []
          };
          
          // Try to parse if it happened to return JSON
          try {
            let aiText = aiData.data;
            if (typeof aiText === 'string') {
                aiText = aiText.replace(/```json/gi, '').replace(/```/g, '').trim();
            }
            const parsedData = typeof aiText === 'string' ? JSON.parse(aiText) : aiText;
            
            if (parsedData.urgency_level) urgencyLevel = String(parsedData.urgency_level).toUpperCase();
            if (parsedData.chief_complaint) preVisitSummary.chief_complaint = parsedData.chief_complaint;
            if (parsedData.suggested_questions) preVisitSummary.suggested_questions = parsedData.suggested_questions;
            else if (parsedData.questions_for_doctor) preVisitSummary.suggested_questions = parsedData.questions_for_doctor;
          } catch (e) {
            // keep raw
          }
        }
      }
    } catch (aiErr) {
      console.error('AI Pre-Visit Service Error:', aiErr);
    }

    const result = await bookAppointment(patientId, doctorId, date, time, symptoms, urgencyLevel, preVisitSummary);
    
    if (!result.success) {
      return res.status(result.status).json({ error: result.message });
    }

    const appointment = result.appointment;

    // Send emails (background/async)
    emailService.sendBookingConfirmation(appointment).catch(err => console.error('Failed to send confirmation emails', err));

    // Create Calendar Event
    try {
      const eventId = await calendarService.createEvent({
        doctorEmail: appointment.doctor_email,
        patientEmail: appointment.patient_email,
        doctorName: appointment.doctor_name,
        patientName: appointment.patient_name,
        slotStart: `${date} ${time}`,
        slotEnd: result.appointment.slot_end_str || result.appointment.slot_end,
        symptoms
      });

      if (eventId) {
        await pool.query('UPDATE appointments SET calendar_event_id = $1 WHERE id = $2', [eventId, appointment.id]);
        appointment.calendar_event_id = eventId;
      }
    } catch (err) {
      console.error('Failed to create calendar event', err);
    }

    res.status(201).json(appointment);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error during booking' });
  }
};

const getUserAppointments = async (req, res) => {
  const userId = req.user.userId;
  const { role } = req.user;

  try {
    let query = '';
    if (role === 'PATIENT') {
      query = `
        SELECT a.*, 
               u.name as doctor_name,
               TO_CHAR(a.slot_start, 'HH24:MI') as appointment_time,
               DATE(a.slot_start) as appointment_date,
               a.pre_visit_summary->>'chief_complaint' as chief_complaint,
               a.pre_visit_summary->'suggested_questions' as suggested_questions
        FROM appointments a 
        JOIN users u ON a.doctor_id = u.id 
        WHERE a.patient_id = $1 
        ORDER BY a.slot_start DESC
      `;
    } else if (role === 'DOCTOR') {
      query = `
        SELECT a.*, 
               p.name AS patient_name, 
               p.email AS patient_email,
               TO_CHAR(a.slot_start, 'HH24:MI') as appointment_time,
               DATE(a.slot_start) as appointment_date,
               a.pre_visit_summary->>'chief_complaint' as chief_complaint,
               a.pre_visit_summary->'suggested_questions' as suggested_questions
        FROM appointments a
        JOIN users p ON a.patient_id = p.id
        WHERE a.doctor_id = $1 
        ORDER BY a.slot_start DESC
      `;
    } else {
      query = 'SELECT * FROM appointments ORDER BY slot_start DESC'; // ADMIN
    }

    const result = await pool.query(query, [userId]);
    
    // Decrypt data
    const decryptedAppointments = result.rows.map(appt => {
      let pres = appt.prescription;
      if (typeof pres === 'string') {
        try {
          pres = JSON.parse(pres);
        } catch (e) {
          console.error('Failed to parse prescription', e);
        }
      }
      return {
        ...appt,
        symptoms: decrypt(appt.symptoms),
        clinical_notes: decrypt(appt.clinical_notes),
        prescription: pres
      };
    });

    res.json(decryptedAppointments);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error fetching appointments' });
  }
};

const completeAppointment = async (req, res) => {
  console.log("Attempting to complete appointment:", req.params.id);
  console.log("Payload:", req.body);
  const { id } = req.params;
  const { clinical_notes, prescription } = req.body;

  if (!clinical_notes) {
    return res.status(400).json({ error: 'clinical_notes are required' });
  }

  try {
    let postVisitSummary = "Summary unavailable. Please refer to clinical notes.";

    try {
      const aiRes = await fetch('http://localhost:5000/api/ai/post-visit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: clinical_notes, prescription: prescription })
      });
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        
        let summary = aiData.summary || '';
        postVisitSummary = summary.replace(/```(json|markdown)?/g, '').replace(/```/g, '').trim();
      }
    } catch (err) {
      console.error('Failed to call AI post-visit service', err);
    }

    const prescriptionPayload = Array.isArray(prescription) ? JSON.stringify(prescription) : JSON.stringify([]);
    const postVisitSummaryPayload = JSON.stringify(postVisitSummary || "Summary unavailable. Please refer to clinical notes.");

    const result = await pool.query(
      `UPDATE appointments 
       SET status = 'COMPLETED', clinical_notes = $1, prescription = $2, post_visit_summary = $3 
       WHERE id = $4 AND doctor_id = $5 RETURNING *`,
      [encrypt(clinical_notes), prescriptionPayload, postVisitSummaryPayload, id, req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found or unauthorized' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Completion Error:", error);
    res.status(500).json({ error: error.message || "Failed to complete visit" });
  }
};

const cancelAppointment = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.userId;
  const { role } = req.user;

  try {
    // Only patient or doctor of this appointment can cancel (or admin)
    const authCheckResult = await pool.query(
      `SELECT * FROM appointments WHERE id = $1`,
      [id]
    );

    if (authCheckResult.rows.length === 0) {
      return res.status(404).json({ error: 'Appointment not found' });
    }

    const appt = authCheckResult.rows[0];
    if (role === 'PATIENT' && appt.patient_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (role === 'DOCTOR' && appt.doctor_id !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }
    if (appt.status === 'CANCELLED') {
      return res.status(400).json({ error: 'Already cancelled' });
    }

    const result = await pool.query(
      `UPDATE appointments a
       SET status = 'CANCELLED' 
       WHERE a.id = $1
       RETURNING a.*, 
                 (SELECT email FROM users WHERE id = a.patient_id) as patient_email,
                 (SELECT name FROM users WHERE id = a.patient_id) as patient_name,
                 (SELECT email FROM users WHERE id = a.doctor_id) as doctor_email,
                 (SELECT name FROM users WHERE id = a.doctor_id) as doctor_name`,
      [id]
    );

    const cancelledAppt = result.rows[0];

    // Trigger emails and calendar deletion
    if (cancelledAppt.calendar_event_id) {
      calendarService.deleteEvent(cancelledAppt.calendar_event_id).catch(err => console.error(err));
    }
    emailService.sendCancellationNotification(cancelledAppt).catch(err => console.error(err));

    res.json({ success: true, appointment: cancelledAppt });
  } catch (error) {
    console.error("Cancel Error:", error);
    res.status(500).json({ error: "Failed to cancel appointment" });
  }
};

module.exports = {
  createAppointment,
  getUserAppointments,
  completeAppointment,
  cancelAppointment
};
