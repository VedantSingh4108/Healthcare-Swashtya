const cron = require('node-cron');
const { pool } = require('./db');
const { sendOrQueueEmail, processQueueEmail, sendMedicationReminder } = require('./emailService');

const initCronJobs = () => {
  // Run every hour
  cron.schedule('0 * * * *', async () => {
    console.log('Running background cron jobs (hourly)...');
    await processEmailRetries();
  });

  // Daily medication reminder at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    console.log('Running daily medication reminders (8:00 AM)...');
    await processDailyMedicationReminders();
  });
};

const processEmailRetries = async () => {
  try {
    const result = await pool.query(
      `SELECT * FROM email_queue 
       WHERE status = 'PENDING' AND next_retry_at <= CURRENT_TIMESTAMP
       LIMIT 50`
    );

    for (const record of result.rows) {
      await processQueueEmail(record);
    }
  } catch (error) {
    console.error('Error processing email retries:', error);
  }
};

const processDailyMedicationReminders = async () => {
  try {
    const result = await pool.query(
      `SELECT a.*, u.email as patient_email, d.name as doctor_name 
       FROM appointments a
       JOIN users u ON a.patient_id = u.id
       JOIN users d ON a.doctor_id = d.id
       WHERE a.status = 'COMPLETED' 
       AND a.prescription IS NOT NULL
       AND a.slot_start >= CURRENT_DATE - INTERVAL '7 days'`
    );

    for (const appt of result.rows) {
      if (!appt.prescription) continue;
      
      let prescriptionList = [];
      try {
        prescriptionList = typeof appt.prescription === 'string' ? JSON.parse(appt.prescription) : appt.prescription;
      } catch (e) {
        continue;
      }

      if (prescriptionList && prescriptionList.length > 0) {
        await sendMedicationReminder(appt.patient_email, appt.doctor_name, prescriptionList);
      }
    }
  } catch (error) {
    console.error('Error processing daily medication reminders:', error);
  }
};

module.exports = {
  initCronJobs
};
