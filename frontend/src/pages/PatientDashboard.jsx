import { useState, useEffect } from 'react';
import client from '../api/client';
import Navbar from '../components/Navbar';
import { Calendar, Clock, Activity, FileText, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import BackgroundBalls from '../components/BackgroundBalls';

export default function PatientDashboard() {
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [specializationFilter, setSpecializationFilter] = useState('');
  
  // Booking Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [isFetchingSlots, setIsFetchingSlots] = useState(false);
  const [slotError, setSlotError] = useState('');

  useEffect(() => {
    fetchAppointments();
    fetchDoctors();
  }, []);

  useEffect(() => {
    if (bookingDate && selectedDoctor) {
      fetchAvailableSlots(selectedDoctor.id, bookingDate);
    } else {
      setAvailableSlots([]);
      setSlotError('');
      setBookingTime('');
    }
  }, [bookingDate, selectedDoctor]);

  const fetchAvailableSlots = async (doctorId, date) => {
    setIsFetchingSlots(true);
    setSlotError('');
    setBookingTime('');
    try {
      const res = await client.get(`/doctors/${doctorId}/available-slots?date=${date}`);
      if (res.data.reason) {
        setSlotError(res.data.reason);
        setAvailableSlots([]);
      } else {
        setAvailableSlots(res.data.slots || []);
        if (res.data.slots?.length === 0) {
          setSlotError('No slots available for this date');
        }
      }
    } catch (err) {
      setSlotError('Failed to fetch available slots');
      setAvailableSlots([]);
    } finally {
      setIsFetchingSlots(false);
    }
  };

  const fetchAppointments = async () => {
    try {
      const res = await client.get('/appointments/me');
      setAppointments(res.data);
    } catch (err) {
      console.error('Failed to fetch appointments', err);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await client.get('/doctors');
      setDoctors(res.data);
    } catch (err) {
      console.error('Failed to fetch doctors', err);
    }
  };



  const filteredDoctors = doctors.filter(d => 
    d.specialization?.toLowerCase().includes(specializationFilter.toLowerCase())
  );

  const handleBookAppointment = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await client.post('/appointments', {
        doctorId: selectedDoctor.id,
        date: bookingDate,
        time: bookingTime,
        symptoms
      });

      setBookingSuccess('Appointment booked successfully!');
      setTimeout(() => {
        setIsModalOpen(false);
        setBookingSuccess('');
        setSelectedDoctor(null);
        setBookingDate('');
        setBookingTime('');
        setSymptoms('');
        setIsSubmitting(false);
        fetchAppointments();
      }, 2000);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to book appointment');
      setIsSubmitting(false);
    }
  };

  const openBookingModal = (doc) => {
    setSelectedDoctor(doc);
    setIsModalOpen(true);
    setBookingDate('');
    setBookingTime('');
    setAvailableSlots([]);
    setSlotError('');
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors duration-300 relative overflow-hidden">
      <BackgroundBalls count={2} />
      <Navbar />
      
      <motion.main 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 relative z-10"
      >

        {/* Book Appointment Section */}
        <section className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm hover:shadow-lg transition-all border border-gray-100 dark:border-gray-800">
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Find a Doctor</h2>
          <div className="mb-4">
            <input 
              type="text" 
              placeholder="Filter by Specialization (e.g. Cardiology)" 
              className="w-full max-w-md bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-md shadow-sm border p-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              value={specializationFilter}
              onChange={e => setSpecializationFilter(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDoctors.map(doc => (
              <div key={doc.id} className="border border-gray-200 dark:border-gray-700 p-4 rounded-xl flex flex-col justify-between">
                <div>
                  <h3 className="font-semibold text-lg text-indigo-700 dark:text-indigo-400">Dr. {doc.name}</h3>
                  <p className="text-slate-600 dark:text-slate-400 text-sm">{doc.specialization}</p>
                </div>
                <button 
                  onClick={() => openBookingModal(doc)}
                  className="mt-4 bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300 py-2 px-4 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors font-medium text-sm"
                >
                  Book Appointment
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Upcoming Appointments Section */}
        <section>
          <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Your Appointments</h2>
          <div className="space-y-4">
            {appointments.length === 0 ? (
              <p className="text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 text-center shadow-sm">No upcoming appointments.</p>
            ) : (
              appointments.map(appt => (
                <div key={appt.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm hover:shadow-lg transition-all border border-gray-100 dark:border-gray-800 flex flex-col md:flex-row gap-6">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Calendar className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                      <span className="font-semibold text-lg text-slate-900 dark:text-white">{new Date(appt.appointment_date).toLocaleDateString()}</span>
                      <Clock className="w-4 h-4 ml-2 text-slate-400" />
                      <span className="text-slate-600 dark:text-slate-400">{appt.appointment_time}</span>
                    </div>
                    <div className="mb-2">
                      <span className="text-slate-700 dark:text-slate-300 font-medium">Doctor: Dr. {appt.doctor_name || appt.doctor_id}</span>
                    </div>
                    <div className="mb-4">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                        ${appt.status === 'CONFIRMED' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300' : 
                          appt.status === 'CANCELLED' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300'}`}>
                        {appt.status}
                      </span>
                      {appt.urgency_level && (
                        <span className={`ml-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium 
                          ${appt.urgency_level === 'HIGH' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/50 dark:text-orange-300' : 
                            appt.urgency_level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' : 'bg-blue-100 text-blue-800 dark:bg-blue-900/50 dark:text-blue-300'}`}>
                          Urgency: {appt.urgency_level}
                        </span>
                      )}
                    </div>
                    <p className="text-slate-700 dark:text-slate-400"><strong>Symptoms:</strong> {appt.symptoms}</p>
                  </div>
                  
                  {appt.status === 'COMPLETED' && (
                    <div className="flex-1 bg-indigo-50 dark:bg-slate-800/50 p-4 rounded-xl border border-indigo-100 dark:border-slate-700">
                      <div className="flex items-center gap-2 mb-2 text-indigo-800 dark:text-indigo-300 font-medium">
                        <FileText className="w-4 h-4" /> Visit Results
                      </div>
                      
                      {typeof appt.post_visit_summary === 'string' ? (
                        <div className="mb-4">
                          <strong className="block text-sm mb-1 text-indigo-800 dark:text-indigo-400">Doctor's Note / AI Summary</strong>
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{appt.post_visit_summary}</p>
                        </div>
                      ) : appt.post_visit_summary && (
                        <div className="mb-4">
                          <strong className="block text-sm mb-1 text-indigo-800 dark:text-indigo-400">Doctor's Note / AI Summary</strong>
                          <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{appt.post_visit_summary.patient_friendly_summary || appt.post_visit_summary.clinical_summary}</p>
                        </div>
                      )}
                      
                      {appt.prescription && Array.isArray(appt.prescription) && appt.prescription.length > 0 && (
                        <div className="border-t border-indigo-200 dark:border-slate-600 pt-3">
                          <strong className="text-sm text-indigo-800 dark:text-indigo-300 flex items-center gap-1 mb-2"><Activity className="w-4 h-4"/> Prescription</strong>
                          <ul className="text-sm text-slate-700 dark:text-slate-300 space-y-1 list-disc pl-5">
                            {appt.prescription.map((med, i) => (
                              <li key={i}><span className="font-medium">{med.name}</span> - {med.dosage}</li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

      </motion.main>

      {/* Booking Modal */}
      {isModalOpen && selectedDoctor && (
        <div className="fixed inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-md w-full p-6 border border-gray-100 dark:border-gray-800"
          >
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4">Book with Dr. {selectedDoctor.name}</h3>
            {bookingSuccess ? (
              <div className="flex flex-col items-center justify-center py-8 text-teal-600 dark:text-teal-400">
                <CheckCircle className="w-12 h-12 mb-2" />
                <p className="font-medium text-lg">{bookingSuccess}</p>
              </div>
            ) : (
              <form onSubmit={handleBookAppointment} className="space-y-4">
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Date</label>
                    <input 
                      type="date" 
                      required 
                      min={new Date().toISOString().split('T')[0]}
                      className="mt-1 block w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-md border p-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" 
                      value={bookingDate} 
                      onChange={e => setBookingDate(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Available Time</label>
                    {isFetchingSlots ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Loading slots...</p>
                    ) : slotError ? (
                      <p className="text-sm text-red-500 dark:text-red-400">{slotError}</p>
                    ) : availableSlots.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {availableSlots.map((slot) => {
                          const slotTime = slot; 
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setBookingTime(slotTime)}
                              className={`px-3 py-1.5 text-sm font-medium rounded-full border transition-colors ${
                                bookingTime === slotTime 
                                  ? 'bg-indigo-600 text-white border-indigo-600 dark:bg-indigo-500' 
                                  : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-600 hover:border-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400'
                              }`}
                            >
                              {slotTime}
                            </button>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 dark:text-slate-400">Select a date to see available slots</p>
                    )}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Symptoms</label>
                  <textarea required rows="3" className="mt-1 block w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-md border p-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" value={symptoms} onChange={e => setSymptoms(e.target.value)}></textarea>
                </div>
                <div className="flex justify-end gap-2 mt-6">
                  <button type="button" onClick={() => setIsModalOpen(false)} disabled={isSubmitting} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg disabled:opacity-50 transition-colors">Cancel</button>
                  <button type="submit" disabled={isSubmitting || !bookingTime} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg flex items-center transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                    {isSubmitting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Analyzing symptoms & confirming...
                      </>
                    ) : 'Confirm Booking'}
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </div>
      )}
    </div>
  );
}
