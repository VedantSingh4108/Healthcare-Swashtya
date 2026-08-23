import { useState, useEffect } from 'react';
import client from '../api/client';
import Navbar from '../components/Navbar';
import { Calendar, Clock, AlertCircle, FileText, CheckCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import BackgroundBalls from '../components/BackgroundBalls';

export default function DoctorDashboard() {
  const [appointments, setAppointments] = useState([]);
  
  // Post-Visit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAppt, setSelectedAppt] = useState(null);
  const [clinicalNotes, setClinicalNotes] = useState('');
  const [prescription, setPrescription] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  // Patient Summary State
  const [summaryModalOpen, setSummaryModalOpen] = useState(false);
  const [patientSummary, setPatientSummary] = useState('');
  const [isLoadingSummary, setIsLoadingSummary] = useState(false);

  useEffect(() => {
    fetchAppointments();
  }, []);

  const fetchAppointments = async () => {
    try {
      const res = await client.get('/appointments/me');
      setAppointments(res.data);
    } catch (err) {
      console.error('Failed to fetch appointments', err);
    }
  };

  const handleCompleteVisit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await client.put(`/appointments/${selectedAppt.id}/complete`, {
        clinical_notes: clinicalNotes,
        prescription
      });
      setIsModalOpen(false);
      setSelectedAppt(null);
      setClinicalNotes('');
      setPrescription('');
      fetchAppointments();
    } catch (err) {
      alert(err.response?.data?.error || "Failed to complete visit");
    } finally {
      setSubmitting(false);
    }
  };

  const openPostVisitModal = (appt) => {
    setSelectedAppt(appt);
    setClinicalNotes(appt.clinical_notes || '');
    setPrescription(appt.prescription && Array.isArray(appt.prescription) ? appt.prescription : [{ name: '', dosage: 'od (Once a day)' }]);
    setIsModalOpen(true);
  };

  const addMedication = () => {
    setPrescription([...prescription, { name: '', dosage: 'od (Once a day)' }]);
  };

  const removeMedication = (index) => {
    const newPrescription = [...prescription];
    newPrescription.splice(index, 1);
    setPrescription(newPrescription);
  };

  const updateMedication = (index, field, value) => {
    const newPrescription = [...prescription];
    newPrescription[index][field] = value;
    setPrescription(newPrescription);
  };

  const handleViewSummary = async (patientId) => {
    setSummaryModalOpen(true);
    setIsLoadingSummary(true);
    setPatientSummary('');
    try {
      const res = await client.get(`/doctors/patients/${patientId}/summary`);
      setPatientSummary(res.data.summary);
    } catch (err) {
      console.error(err);
      setPatientSummary('Failed to load patient summary.');
    } finally {
      setIsLoadingSummary(false);
    }
  };

  return (
    <div className="min-h-screen bg-transparent transition-colors duration-300 relative overflow-hidden">
      <BackgroundBalls count={2} />
      <Navbar />
      
      <motion.main 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10"
      >
        <h2 className="text-xl font-bold text-slate-800 dark:text-white mb-6 flex items-center">
          <Calendar className="w-6 h-6 mr-2 text-indigo-600 dark:text-indigo-400" /> My Appointments
        </h2>
        
        <div className="space-y-6">
          {appointments.length === 0 ? (
            <p className="text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900 p-6 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm text-center">No scheduled appointments.</p>
          ) : (
            appointments.map(appt => (
              <div key={appt.id} className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm hover:shadow-lg transition-all border border-gray-100 dark:border-gray-800">
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Basic Info */}
                  <div className="flex-1 border-b lg:border-b-0 lg:border-r border-slate-200 dark:border-gray-800 pb-4 lg:pb-0 lg:pr-6">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-slate-400 dark:text-slate-500" />
                        <span className="font-semibold text-lg text-slate-900 dark:text-white">{new Date(appt.appointment_date).toLocaleDateString()}</span>
                        <span className="text-slate-600 dark:text-slate-400">{appt.appointment_time}</span>
                      </div>
                      <div className="flex gap-2">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium 
                          ${appt.status === 'COMPLETED' ? 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300' : 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-300'}`}>
                          {appt.status}
                        </span>
                        {appt.urgency_level && (
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium 
                            ${appt.urgency_level === 'HIGH' ? 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300' : 
                              appt.urgency_level === 'MEDIUM' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300' : 'bg-teal-100 text-teal-800 dark:bg-teal-900/50 dark:text-teal-300'}`}>
                            {appt.urgency_level}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-slate-700 dark:text-slate-300 mb-1"><strong>Patient:</strong> {appt.patient_name || appt.patient_id}</p>
                    <p className="text-slate-700 dark:text-slate-300 mb-2"><strong>Email:</strong> {appt.patient_email || 'N/A'}</p>
                    <p className="text-slate-700 dark:text-slate-300 mb-4"><strong>Symptoms:</strong> {appt.symptoms}</p>
                    
                    {appt.status === 'CONFIRMED' && (
                      <button 
                        onClick={() => openPostVisitModal(appt)}
                        className="bg-indigo-600 text-white dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 py-2 px-4 rounded-lg transition-colors text-sm font-medium mr-2"
                      >
                        Complete Visit
                      </button>
                    )}
                    {appt.patient_id && (
                      <button 
                        onClick={() => handleViewSummary(appt.patient_id)}
                        className="bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 py-2 px-4 rounded-lg hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors text-sm font-medium border border-slate-300 dark:border-gray-700 mt-2 lg:mt-0"
                      >
                        View Full Patient Summary
                      </button>
                    )}
                  </div>

                  {/* AI Summaries */}
                  <div className="flex-1 flex flex-col gap-4">
                    {/* Pre-Visit AI */}
                    {appt.pre_visit_summary ? (
                      <div className="bg-orange-50 dark:bg-slate-800/50 p-4 rounded-xl border border-orange-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-2 text-orange-800 dark:text-orange-400 font-medium">
                          <AlertCircle className="w-4 h-4" /> AI Pre-Visit Analysis
                        </div>
                        <div className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                          <p><span className="font-semibold">Urgency:</span> {appt.urgency_level || 'Unknown'}</p>
                          <p><span className="font-semibold">Chief Complaint:</span> {appt.chief_complaint || 'N/A'}</p>
                          <div>
                            <span className="font-semibold">Suggested Questions:</span>
                            <ul className="list-disc pl-5 mt-1">
                              {appt.suggested_questions?.map((q, i) => <li key={i}>{q}</li>)}
                            </ul>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <p className="text-sm text-slate-400 dark:text-slate-500 italic">No AI Pre-visit summary available yet.</p>
                    )}

                    {/* Post-Visit AI */}
                    {appt.status === 'COMPLETED' && (
                      <div className="bg-indigo-50 dark:bg-slate-800/50 p-4 rounded-xl border border-indigo-100 dark:border-slate-700">
                        <div className="flex items-center gap-2 mb-2 text-indigo-800 dark:text-indigo-400 font-medium">
                          <FileText className="w-4 h-4" /> Visit Results
                        </div>
                        {typeof appt.post_visit_summary === 'string' ? (
                          <div className="mb-4">
                            <strong className="block text-sm mb-1 text-slate-800 dark:text-slate-200">AI Summary:</strong>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{appt.post_visit_summary}</p>
                          </div>
                        ) : appt.post_visit_summary && (
                          <div className="mb-4">
                            <strong className="block text-sm mb-1 text-slate-800 dark:text-slate-200">AI Summary:</strong>
                            <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{appt.post_visit_summary.clinical_summary || appt.post_visit_summary.patient_friendly_summary}</p>
                          </div>
                        )}
                        {appt.prescription && Array.isArray(appt.prescription) && appt.prescription.length > 0 && (
                          <div>
                            <strong className="block text-sm mb-1 text-slate-800 dark:text-slate-200">Prescription:</strong>
                            <ul className="text-sm text-slate-700 dark:text-slate-300 list-disc pl-5">
                              {appt.prescription.map((med, i) => (
                                <li key={i}>{med.name} - {med.dosage}</li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.main>

      {/* Post-Visit Modal */}
      {isModalOpen && selectedAppt && (
        <div className="fixed inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full p-6 border border-gray-100 dark:border-gray-800"
          >
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center">
              <CheckCircle className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" /> Complete Visit
            </h3>
            <form onSubmit={handleCompleteVisit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Clinical Notes</label>
                <textarea 
                  required 
                  rows="4" 
                  className="w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-md border p-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" 
                  placeholder="Enter detailed clinical notes..."
                  value={clinicalNotes} 
                  onChange={e => setClinicalNotes(e.target.value)}
                ></textarea>
              </div>
              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Prescription</label>
                  <button type="button" onClick={addMedication} className="text-xs bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300 px-2 py-1 rounded-md hover:bg-indigo-200 dark:hover:bg-indigo-900/70 transition-colors">
                    + Add Medication
                  </button>
                </div>
                <div className="space-y-2">
                  {prescription.map((med, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input 
                        type="text" 
                        required 
                        className="flex-1 bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-md border p-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" 
                        placeholder="Medicine Name"
                        value={med.name} 
                        onChange={e => updateMedication(index, 'name', e.target.value)}
                      />
                      <select 
                        required
                        className="w-1/3 bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-md border p-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                        value={med.dosage}
                        onChange={e => updateMedication(index, 'dosage', e.target.value)}
                      >
                        <option className="dark:bg-slate-800" value="od (Once a day)">od (Once a day)</option>
                        <option className="dark:bg-slate-800" value="bd (Twice a day)">bd (Twice a day)</option>
                        <option className="dark:bg-slate-800" value="tds (Thrice a day)">tds (Thrice a day)</option>
                        <option className="dark:bg-slate-800" value="qid (Four times a day)">qid (Four times a day)</option>
                        <option className="dark:bg-slate-800" value="Before Meal">Before Meal</option>
                        <option className="dark:bg-slate-800" value="After Meal">After Meal</option>
                        <option className="dark:bg-slate-800" value="Once a week">Once a week</option>
                        <option className="dark:bg-slate-800" value="Once in two days">Once in two days</option>
                        <option className="dark:bg-slate-800" value="Only when required">Only when required</option>
                      </select>
                      <button type="button" onClick={() => removeMedication(index)} className="text-red-500 hover:text-red-700 p-2 transition-colors">
                        &times;
                      </button>
                    </div>
                  ))}
                  {prescription.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400 italic">No medications added.</p>
                  )}
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors" disabled={submitting}>Cancel</button>
                <button type="submit" className="px-4 py-2 bg-indigo-600 text-white dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 rounded-lg flex items-center transition-colors disabled:opacity-50" disabled={submitting}>
                  {submitting ? 'Processing AI Summary...' : 'Submit & Generate AI Summary'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Full Patient Summary Modal */}
      {summaryModalOpen && (
        <div className="fixed inset-0 bg-slate-900/20 dark:bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ opacity: 0, scale: 0.95 }} 
            animate={{ opacity: 1, scale: 1 }} 
            className="bg-white dark:bg-slate-900 rounded-xl shadow-xl max-w-2xl w-full p-6 border border-gray-100 dark:border-gray-800"
          >
            <h3 className="text-xl font-bold text-slate-800 dark:text-white mb-4 flex items-center">
              <FileText className="w-5 h-5 mr-2 text-indigo-600 dark:text-indigo-400" /> Longitudinal Patient Summary
            </h3>
            <div className="mb-6">
              {isLoadingSummary ? (
                <div className="flex items-center justify-center py-8">
                  <svg className="animate-spin h-8 w-8 text-indigo-600 dark:text-indigo-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span className="ml-3 text-slate-500 dark:text-slate-400 font-medium">Generating comprehensive AI summary...</span>
                </div>
              ) : (
                <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-xl border border-slate-200 dark:border-slate-700">
                  <p className="text-gray-700 dark:text-gray-300 leading-relaxed whitespace-pre-wrap">{patientSummary}</p>
                </div>
              )}
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={() => setSummaryModalOpen(false)} className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-800 dark:text-slate-200 hover:bg-slate-300 dark:hover:bg-slate-700 rounded-lg transition-colors">Close</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
