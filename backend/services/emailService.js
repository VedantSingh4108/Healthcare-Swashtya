const { pool } = require('./db');

const sendEmail = async (to, subject, htmlBody) => {
  if (!process.env.GOOGLE_SCRIPT_URL) {
    console.warn('GOOGLE_SCRIPT_URL is undefined or empty. Bypassing email send.');
    return;
  }
  
  try {
    const response = await fetch(process.env.GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, htmlBody }),
      redirect: 'follow'
    });
    
    const rawText = await response.text();
    
    let result;
    try {
      result = JSON.parse(rawText);
    } catch (parseError) {
      console.error('Google returned non-JSON response (Likely an HTML error page or login redirect):', rawText.substring(0, 200) + '...');
      throw new Error('Invalid response from Google Script');
    }

    if (result.status !== 'success') {
      throw new Error(result.message || 'Unknown Google Script error');
    }
    
    console.log('Email sent successfully via Google Apps Script to:', to);
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
};

const sendOrQueueEmail = async (to, subject, body) => {
  try {
    await sendEmail(to, subject, body);
  } catch (error) {
    console.error(`Failed to send email to ${to}. Queueing for retry.`, error);
    await queueEmailForRetry(to, subject, body);
  }
};

const queueEmailForRetry = async (to, subject, body) => {
  try {
    await pool.query(
      `INSERT INTO email_queue (to_email, subject, body, status, retry_count) VALUES ($1, $2, $3, 'PENDING', 1)`,
      [to, subject, body]
    );
  } catch (err) {
    console.error('Failed to queue email:', err);
  }
};

const sendBookingConfirmation = async (appointment) => {
  const { patient_email, patient_name, doctor_email, doctor_name, slot_start_str, slot_start, slot_end, symptoms } = appointment;
  
  // Use slot_start_str if available (e.g. '2026-08-23 10:00'), else fallback
  const displayDate = slot_start_str ? slot_start_str : new Date(slot_start).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  // Generate Google Calendar Link
  const formattedStart = new Date(slot_start).toISOString().replace(/-|:|\.\d+/g, '');
  const formattedEnd = new Date(slot_end || new Date(new Date(slot_start).getTime() + 30 * 60000)).toISOString().replace(/-|:|\.\d+/g, '');
  const encodedSummary = encodeURIComponent(`Medical Appointment with Dr. ${doctor_name}`);
  const encodedDetails = encodeURIComponent(`Symptoms: ${symptoms}`);
  const calendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodedSummary}&dates=${formattedStart}/${formattedEnd}&details=${encodedDetails}`;

  // Notify Patient
  const patientSubject = `Booking Confirmation: Appointment with Dr. ${doctor_name}`;
  const patientBody = `
    <p>Hello ${patient_name},</p>
    <p>Your appointment has been successfully booked.</p>
    <p><strong>Doctor:</strong> Dr. ${doctor_name}</p>
    <p><strong>Time:</strong> ${displayDate}</p>
    <p><strong>Symptoms noted:</strong> ${symptoms}</p>
    <br/>
    <a href="${calendarLink}" style="background-color: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px; display: inline-block;">
      Add to Google Calendar
    </a>
    <br/><br/>
    <p>Thank you.</p>
  `;
  await sendOrQueueEmail(patient_email, patientSubject, patientBody);

  // Notify Doctor
  const doctorSubject = `New Appointment Booking: ${patient_name}`;
  const doctorBody = `
    <p>Hello Dr. ${doctor_name},</p>
    <p>You have a new appointment with ${patient_name} on ${displayDate}.</p>
    <p><strong>Symptoms noted:</strong> ${symptoms}</p>
    <p>Please check your clinic calendar.</p>
  `;
  await sendOrQueueEmail(doctor_email, doctorSubject, doctorBody);
};

const sendCancellationNotification = async (appointment) => {
  const { patient_email, patient_name, doctor_email, doctor_name, slot_start_str, slot_start } = appointment;
  const dateStr = slot_start_str ? slot_start_str : new Date(slot_start).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });

  await sendOrQueueEmail(
    patient_email, 
    `Appointment Cancelled: Dr. ${doctor_name}`, 
    `Hello ${patient_name},\n\nYour appointment with Dr. ${doctor_name} on ${dateStr} has been cancelled.`
  );

  await sendOrQueueEmail(
    doctor_email, 
    `Appointment Cancelled: ${patient_name}`, 
    `Hello Dr. ${doctor_name},\n\nYour appointment with ${patient_name} on ${dateStr} has been cancelled.`
  );
};

const processQueueEmail = async (emailRecord) => {
  const { id, to_email, subject, body, retry_count } = emailRecord;
  try {
    await sendEmail(to_email, subject, body);
    
    await pool.query(`UPDATE email_queue SET status = 'SENT' WHERE id = $1`, [id]);
    console.log(`Successfully sent queued email to ${to_email}`);
  } catch (error) {
    const nextRetryCount = retry_count + 1;
    let newStatus = 'PENDING';
    
    // Max 5 retries
    if (nextRetryCount > 5) {
      newStatus = 'FAILED';
    }

    // Exponential backoff: 2^retry_count minutes
    const backoffMinutes = Math.pow(2, nextRetryCount);
    
    await pool.query(
      `UPDATE email_queue 
       SET retry_count = $1, status = $2, next_retry_at = CURRENT_TIMESTAMP + ($3 * interval '1 minute')
       WHERE id = $4`,
      [nextRetryCount, newStatus, backoffMinutes, id]
    );
    console.error(`Retry failed for email ${id}. Backoff: ${backoffMinutes}m`);
  }
};

const sendMedicationReminder = async (patientEmail, doctorName, prescriptionData) => {
  let medList = '';
  if (Array.isArray(prescriptionData)) {
    medList = prescriptionData.map(med => `- ${med.name} (${med.dosage || 'No specific dosage'})`).join('\n');
  } else {
    medList = JSON.stringify(prescriptionData);
  }

  const subject = `Your Daily Medication Reminder - Dr. ${doctorName}`;
  const body = `Hello,\n\nHere is your daily medication reminder from Dr. ${doctorName}:\n\n${medList}\n\nPlease remember to take your medications as prescribed.\n\nThank you.`;

  await sendOrQueueEmail(patientEmail, subject, body);
};

module.exports = {
  sendOrQueueEmail,
  sendBookingConfirmation,
  sendCancellationNotification,
  processQueueEmail,
  sendMedicationReminder
};
