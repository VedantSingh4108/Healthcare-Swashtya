require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

const authRoutes = require('./routes/authRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const doctorRoutes = require('./routes/doctorRoutes');
const adminRoutes = require('./routes/adminRoutes');
const patientRoutes = require('./routes/patientRoutes');
const userRoutes = require('./routes/userRoutes');
const { initDb } = require('./services/db');
const { initCronJobs } = require('./services/cronService');

const app = express();
app.use(cors());
app.use(express.json());

const port = process.env.PORT || 3001;

app.use('/api/auth', authRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/doctors', doctorRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/patients', patientRoutes);
app.use('/api/users', userRoutes);

app.get('/', (req, res) => {
    res.json({ message: 'Healthcare Appointment Platform Backend' });
});

// Initialize database then start server
initDb().then(() => {
    initCronJobs();
    app.listen(port, () => {
        console.log(`Backend server listening on port ${port}`);
    });
}).catch(err => {
    console.error('Failed to initialize database, shutting down.', err);
    process.exit(1);
});
