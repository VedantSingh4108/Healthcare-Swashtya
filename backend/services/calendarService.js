const { google } = require('googleapis');
const path = require('path');

let auth;
if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON) {
  const credentials = JSON.parse(process.env.GOOGLE_SERVICE_ACCOUNT_JSON);
  auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
} else {
  auth = new google.auth.GoogleAuth({
    keyFile: path.join(__dirname, '../service-account.json'),
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
}

const calendar = google.calendar({ version: 'v3', auth });

const createEvent = async (appointmentDetails) => {
  const { doctorEmail, patientEmail, slotStart, slotEnd, symptoms } = appointmentDetails;

  const event = {
    summary: `Medical Appointment with Dr. ${appointmentDetails.doctorName}`,
    description: `Symptoms: ${symptoms}`,
    start: {
      dateTime: typeof slotStart === 'string' && !slotStart.includes('T') ? `${slotStart.replace(' ', 'T')}:00+05:30` : new Date(slotStart).toISOString(),
      timeZone: 'Asia/Kolkata',
    },
    end: {
      dateTime: typeof slotEnd === 'string' && !slotEnd.includes('T') ? `${slotEnd.replace(' ', 'T')}:00+05:30` : new Date(slotEnd).toISOString(),
      timeZone: 'Asia/Kolkata',
    },
    reminders: {
      useDefault: true,
    },
  };

  try {
    const response = await calendar.events.insert({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      resource: event,
    });
    return response.data.id;
  } catch (error) {
    console.error('Error creating Calendar event:', error);
    // Don't throw, just return null so it doesn't break the booking flow completely if Calendar fails
    return null;
  }
};

const updateEvent = async (eventId, appointmentDetails) => {
  if (!eventId) return;

  const { doctorEmail, patientEmail, slotStart, slotEnd, symptoms } = appointmentDetails;

  const event = {
    summary: `Updated: Medical Appointment with Dr. ${appointmentDetails.doctorName}`,
    description: `Symptoms: ${symptoms}`,
    start: {
      dateTime: typeof slotStart === 'string' && !slotStart.includes('T') ? `${slotStart.replace(' ', 'T')}:00+05:30` : new Date(slotStart).toISOString(),
      timeZone: 'Asia/Kolkata',
    },
    end: {
      dateTime: typeof slotEnd === 'string' && !slotEnd.includes('T') ? `${slotEnd.replace(' ', 'T')}:00+05:30` : new Date(slotEnd).toISOString(),
      timeZone: 'Asia/Kolkata',
    },
    reminders: {
      useDefault: true,
    },
  };

  try {
    await calendar.events.update({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      eventId: eventId,
      resource: event,
    });
  } catch (error) {
    console.error('Error updating Calendar event:', error);
  }
};

const deleteEvent = async (eventId) => {
  if (!eventId) return;

  try {
    await calendar.events.delete({
      calendarId: process.env.GOOGLE_CALENDAR_ID,
      eventId: eventId,
    });
  } catch (error) {
    console.error('Error deleting Calendar event:', error);
  }
};

module.exports = {
  createEvent,
  updateEvent,
  deleteEvent
};
