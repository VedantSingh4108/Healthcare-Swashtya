const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const initDb = async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        role VARCHAR(20) NOT NULL CHECK (role IN ('PATIENT', 'DOCTOR', 'ADMIN')),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create doctor_profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS doctor_profiles (
        id SERIAL PRIMARY KEY,
        user_id INT REFERENCES users(id) ON DELETE CASCADE,
        specialization VARCHAR(100) NOT NULL,
        working_hours_start TIME NOT NULL,
        working_hours_end TIME NOT NULL,
        break_start TIME DEFAULT '13:00',
        break_end TIME DEFAULT '14:00',
        slot_duration_mins INT NOT NULL DEFAULT 30,
        working_days INT[] DEFAULT '{1,2,3,4,5,6}',
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Safely add columns if they don't exist (for existing databases)
    await client.query(`
      DO $$ 
      BEGIN 
        BEGIN
          ALTER TABLE doctor_profiles ADD COLUMN break_start TIME DEFAULT '13:00';
        EXCEPTION WHEN duplicate_column THEN END;
        
        BEGIN
          ALTER TABLE doctor_profiles ADD COLUMN break_end TIME DEFAULT '14:00';
        EXCEPTION WHEN duplicate_column THEN END;
        
        BEGIN
          ALTER TABLE doctor_profiles ADD COLUMN working_days INT[] DEFAULT '{1,2,3,4,5,6}';
        EXCEPTION WHEN duplicate_column THEN END;
      END $$;
    `);

    // Create doctor_leaves table
    await client.query(`
      CREATE TABLE IF NOT EXISTS doctor_leaves (
        id SERIAL PRIMARY KEY,
        doctor_id INT REFERENCES users(id) ON DELETE CASCADE,
        leave_date DATE NOT NULL,
        reason TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create patient_profiles table
    await client.query(`
      CREATE TABLE IF NOT EXISTS patient_profiles (
        user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        chronic_diseases TEXT,
        allergies TEXT,
        past_surgeries TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create appointments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS appointments (
        id SERIAL PRIMARY KEY,
        patient_id INT REFERENCES users(id),
        doctor_id INT REFERENCES users(id),
        slot_start TIMESTAMP NOT NULL,
        slot_end TIMESTAMP NOT NULL,
        status VARCHAR(20) NOT NULL DEFAULT 'CONFIRMED' CHECK (status IN ('CONFIRMED', 'CANCELLED', 'COMPLETED')),
        symptoms TEXT NOT NULL,
        urgency_level VARCHAR(20),
        pre_visit_summary JSONB,
        clinical_notes TEXT,
        post_visit_summary JSONB,
        prescription JSONB,
        calendar_event_id VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create medication_reminders table
    await client.query(`
      CREATE TABLE IF NOT EXISTS medication_reminders (
        id SERIAL PRIMARY KEY,
        appointment_id INT REFERENCES appointments(id) ON DELETE CASCADE,
        patient_id INT REFERENCES users(id),
        reminder_time TIMESTAMP NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
        retry_count INT DEFAULT 0
      )
    `);

    // Create unique partial index to guarantee no double bookings at the database engine level
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS unique_doctor_active_slot 
      ON appointments (doctor_id, slot_start) 
      WHERE status != 'CANCELLED'
    `);

    // Create email_queue table for retries
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_queue (
        id SERIAL PRIMARY KEY,
        to_email VARCHAR(255) NOT NULL,
        subject VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        status VARCHAR(20) DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SENT', 'FAILED')),
        retry_count INT DEFAULT 0,
        next_retry_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Ensure prescription is JSONB (migration)
    await client.query(`
      ALTER TABLE appointments ALTER COLUMN prescription TYPE JSONB USING prescription::jsonb;
    `).catch(err => {
      // Ignore error if it's empty string conversion failure or already JSONB
      if (err.code !== '42804') console.log('Prescription alteration skipped or failed safely:', err.message);
    });

    await client.query('COMMIT');
    console.log('Database initialization completed successfully.');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Database initialization failed:', error);
    throw error;
  } finally {
    client.release();
  }
};

module.exports = {
  pool,
  initDb
};
