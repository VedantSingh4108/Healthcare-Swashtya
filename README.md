# Swasthya 🏥 - AI-Driven Healthcare Appointment Manager

**Swasthya** is a top-tier, full-stack healthcare management platform engineered to streamline the entire clinical workflow. Designed with a premium Glassmorphism aesthetic, it empowers Patients, Doctors, and Administrators through Role-Based Access Control (RBAC), intelligent AI integrations via Google Gemini, automated Google Calendar syncing, and robust background cron jobs for medication reminders.

---

## ✨ Key Features

- **🎨 Premium UI/UX:** Built with Tailwind CSS and Framer Motion, featuring seamless Dark/Light mode toggling, frosted glassmorphism cards, and a zero-lag HTML5 Canvas bouncing ball physics background.
- **🔐 Role-Based Access Control (RBAC):** Distinct routing and dashboards for `PATIENT`, `DOCTOR`, and `ADMIN` roles.
- **🧠 AI-Powered Insights:** Integrates with Gemini 3.5 Flash to automatically grade appointment urgency, generate patient-friendly post-visit summaries, and summarize longitudinal medical histories.
- **📅 Google Calendar Sync:** Automatically creates and syncs `.ics` calendar events to patient and doctor calendars using a Google Service Account.
- **📧 Bulletproof Email Automation:** Bypasses standard SMTP blocks (like those on Render) by dispatching emails through a robust Google Apps Script Webhook.
- **🛡️ Conflict Prevention:** Prevents double-bookings natively via PostgreSQL partial unique indexes and automatically cancels/notifies patients if a doctor marks an emergency leave.
- **⏱️ Automated Cron Jobs:** A background `node-cron` service parses doctor prescriptions and automatically queues daily medication reminder emails.

---

## 🛠️ Tech Stack

| Domain | Technologies |
| :--- | :--- |
| **Frontend** | React, Vite, Tailwind CSS, Framer Motion, Lucide-React, React Router DOM |
| **Backend** | Node.js, Express.js, JSON Web Tokens (JWT), node-cron |
| **AI Service** | Python, Flask, Google GenAI SDK (Gemini 3.5 Flash) |
| **Database** | PostgreSQL (pg), raw SQL queries |

---

## 🗄️ Database Schema

Here is a high-level overview of the relational database schema:

```mermaid
erDiagram
    USERS ||--o| PATIENT_PROFILES : has
    USERS ||--o| DOCTOR_PROFILES : has
    USERS ||--o{ DOCTOR_LEAVES : logs
    USERS ||--o{ APPOINTMENTS : books
    APPOINTMENTS ||--o{ MEDICATION_REMINDERS : triggers

    USERS {
        int id PK
        string name
        string email
        string role "PATIENT, DOCTOR, ADMIN"
    }
    
    PATIENT_PROFILES {
        int user_id FK
        text chronic_diseases
        text allergies
        text past_surgeries
    }

    DOCTOR_PROFILES {
        int user_id FK
        string specialization
        time working_hours_start
        time working_hours_end
    }

    APPOINTMENTS {
        int id PK
        int patient_id FK
        int doctor_id FK
        timestamp slot_start
        string status "CONFIRMED, CANCELLED, COMPLETED"
        text symptoms
        jsonb prescription
    }
```

---

## 📡 Core API Documentation

| Method | Route | Description | Auth Level |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/auth/register` | Register a new user | Public |
| `POST` | `/api/auth/login` | Authenticate and receive JWT | Public |
| `GET`  | `/api/users/profile` | Get unified profile data | Authenticated |
| `PUT`  | `/api/users/profile` | Update unified profile data | Authenticated |
| `GET`  | `/api/doctors/:id/available-slots`| Fetch slots excluding leaves/bookings | Authenticated |
| `POST` | `/api/appointments` | Book a new appointment | `PATIENT` |
| `PUT`  | `/api/appointments/:id/complete`| Complete appointment & generate AI summary | `DOCTOR` |
| `POST` | `/api/doctors/:id/leave` | Mark doctor leave & cancel conflicts | `ADMIN` / `DOCTOR` |

---

## 🤖 LLM Integration Details

The Python AI Service uses **Gemini-3.5-Flash** to process natural language healthcare tasks. 

### 1. Pre-Visit Urgency & Triage
**Prompt:**
> *"Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: {symptoms}"*

### 2. Post-Visit Summary (Patient-Friendly)
**Prompt:**
> *"You are a warm, empathetic medical assistant translating a doctor's notes for a patient. Doctor's Clinical Notes: {notes}. Prescriptions: {prescription}. Instructions: Write a short, patient-friendly summary explaining their diagnosis, how to take their medications, and any lifestyle/rest advice. Use simple, everyday language. Do NOT use complex medical jargon. CRITICAL: Return ONLY the plain text summary. Do not include markdown formatting, asterisks, or introductory phrases."*

### 3. Patient History Summarization (For Doctors)
**Prompt:**
> *"You are an expert medical AI assistant. Review the following patient history. Chronic Diseases: {chronic}, Allergies: {allergies}, Surgeries: {surgeries}, Past Visit Notes: {notes}. Instructions: Generate a concise, professional longitudinal summary for the attending doctor. Highlight recurring issues, active conditions, and critical risks. Do NOT use markdown. Return plain text only."*

**Graceful Degradation:** If the Gemini API fails, timeouts, or is uninitialized, the Flask service catches the exception and returns a pre-defined static JSON fallback so the UI never breaks.

---

## 🏗️ System Design Highlights

- **Preventing Double-Bookings:** Enforced flawlessly at the database level via a partial unique index:
  `CREATE UNIQUE INDEX unique_doctor_active_slot ON appointments (doctor_id, slot_start) WHERE status != 'CANCELLED';`
- **Leave Conflict Resolution:** When a doctor marks a leave, the system wraps the operation in a SQL Transaction (`BEGIN...COMMIT`). It inserts the leave, queries all conflicting `CONFIRMED` appointments for that day, updates their status to `CANCELLED`, calls the Google Calendar API to delete the events, and queues cancellation emails to the patients.
- **Medication Reminders:** `node-cron` runs a background task every minute. It scans the `medication_reminders` table for pending reminders whose `reminder_time` is due, dispatches the email via Google Apps Script, and updates the status to `SENT` or `FAILED` (with retry logic).

---

## 🚀 Local Setup Guide

### 1. Database Setup
1. Install PostgreSQL and create a database named `swasthya`.
2. The backend will automatically run migrations and table creations on startup via `initDb()`.

### 2. Python AI Service
```bash
cd ai-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
pip install flask flask-cors python-dotenv google-genai
python app.py
```

### 3. Node Backend
```bash
cd backend
npm install
npm run dev
```

### 4. React Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## 🔐 Environment Variables (`.env.example`)

### Backend (`backend/.env`)
```env
PORT=3001
DATABASE_URL=postgresql://postgres:password@localhost:5432/swasthya
JWT_SECRET=your_super_secret_jwt_key
GOOGLE_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

### AI Service (`ai-service/.env`)
```env
GEMINI_API_KEY=your_google_gemini_api_key
```

### Frontend
*(No `.env` required by default, assuming Vite proxies to `localhost:3001`)*

---

## 📧 Google Calendar & Email Setup

### Google Apps Script (Email Webhook)
To bypass cloud provider SMTP blocks (like Render):
1. Go to [script.google.com](https://script.google.com/).
2. Create a new script with a `doPost(e)` function that utilizes `MailApp.sendEmail()`.
3. Deploy as a Web App -> Access: "Anyone".
4. Copy the Web App URL and set it as `GOOGLE_SCRIPT_URL` in the Backend `.env`.

### Google Calendar Service Account
1. Go to Google Cloud Console -> IAM & Admin -> Service Accounts.
2. Create a Service Account and download the JSON key.
3. Rename it to `service-account.json` and place it in the `/backend/` root directory.
4. Enable the **Google Calendar API** in your GCP project.
5. Note: Service Accounts cannot invite external attendees directly without domain-wide delegation, so events are generated and synced as independent `.ics` templates or direct calendar injections.
