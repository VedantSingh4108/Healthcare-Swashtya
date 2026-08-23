import { useState, useEffect } from 'react';
import client from '../api/client';
import Navbar from '../components/Navbar';
import { Settings, CalendarOff, Users } from 'lucide-react';
import { motion } from 'framer-motion';
import BackgroundBalls from '../components/BackgroundBalls';

export default function AdminDashboard() {
  const [doctors, setDoctors] = useState([]);
  
  // Profile Form State
  const [selectedDoctorId, setSelectedDoctorId] = useState('');
  const [specialization, setSpecialization] = useState('');
  const [startHours, setStartHours] = useState('09:00');
  const [endHours, setEndHours] = useState('17:00');
  const [slotDuration, setSlotDuration] = useState(30);

  const handleDoctorSelect = (e) => {
    const docId = e.target.value;
    setSelectedDoctorId(docId);
    
    if (!docId) {
      setSpecialization('');
      setStartHours('09:00');
      setEndHours('17:00');
      setSlotDuration(30);
      return;
    }
    
    const doc = doctors.find(d => String(d.id) === docId);
    if (doc) {
      setSpecialization(doc.specialization || '');
      setStartHours(doc.working_hours_start ? doc.working_hours_start.substring(0, 5) : '09:00');
      setEndHours(doc.working_hours_end ? doc.working_hours_end.substring(0, 5) : '17:00');
      setSlotDuration(doc.slot_duration_mins || 30);
    }
  };

  // Leave Form State
  const [leaveDoctorId, setLeaveDoctorId] = useState('');
  const [leaveDate, setLeaveDate] = useState('');
  const [leaveReason, setLeaveReason] = useState('');

  useEffect(() => {
    fetchDoctors();
  }, []);

  const fetchDoctors = async () => {
    try {
      const res = await client.get('/doctors');
      setDoctors(res.data);
    } catch (err) {
      console.error('Failed to fetch doctors', err);
    }
  };

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!selectedDoctorId) return alert('Select a doctor');
    try {
      await client.put(`/admin/doctors/${selectedDoctorId}`, {
        specialization,
        workingHoursStart: startHours,
        workingHoursEnd: endHours,
        slotDurationMins: slotDuration
      });
      alert('Profile updated successfully');
      setSpecialization('');
    } catch (err) {
      alert('Failed to update profile');
    }
  };

  const handleMarkLeave = async (e) => {
    e.preventDefault();
    if (!leaveDoctorId || !leaveDate) return alert('Fill required fields');
    try {
      await client.post('/admin/leaves', {
        doctorId: leaveDoctorId,
        leaveDate,
        reason: leaveReason
      });
      alert('Leave marked successfully. Conflicting appointments cancelled automatically.');
      setLeaveDate('');
      setLeaveReason('');
    } catch (err) {
      alert('Failed to mark leave');
    }
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
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white flex items-center">
          <Settings className="w-7 h-7 mr-2 text-indigo-600 dark:text-indigo-400" /> Admin Control Panel
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Manage Doctor Profile */}
          <section className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm hover:shadow-lg transition-all border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center">
              <Users className="w-5 h-5 mr-2 text-slate-500 dark:text-slate-400" /> Manage Doctor Profiles
            </h3>
            <form onSubmit={handleUpdateProfile} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Select Doctor</label>
                <select 
                  className="mt-1 w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-md border p-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  value={selectedDoctorId} 
                  onChange={handleDoctorSelect}
                >
                  <option className="dark:bg-slate-800" value="">-- Choose Doctor --</option>
                  {doctors.map(doc => <option className="dark:bg-slate-800" key={doc.id} value={doc.id}>{doc.name} ({doc.email})</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Specialization</label>
                <input type="text" required className="mt-1 w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-md border p-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" value={specialization} onChange={e => setSpecialization(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Start Time</label>
                  <input type="time" required className="mt-1 w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-md border p-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" value={startHours} onChange={e => setStartHours(e.target.value)} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">End Time</label>
                  <input type="time" required className="mt-1 w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-md border p-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" value={endHours} onChange={e => setEndHours(e.target.value)} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Slot Duration (mins)</label>
                <input type="number" required className="mt-1 w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-md border p-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" value={slotDuration} onChange={e => setSlotDuration(e.target.value)} />
              </div>
              <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 p-2 rounded-lg transition-colors font-medium">Update Profile</button>
            </form>
          </section>

          {/* Mark Doctor Leave */}
          <section className="bg-white dark:bg-slate-900 p-6 rounded-xl shadow-sm hover:shadow-lg transition-all border border-gray-100 dark:border-gray-800">
            <h3 className="text-lg font-bold text-slate-800 dark:text-white mb-4 flex items-center">
              <CalendarOff className="w-5 h-5 mr-2 text-slate-500 dark:text-slate-400" /> Mark Doctor on Leave
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
              Marking a doctor on leave will automatically cancel any conflicting appointments and email the patients.
            </p>
            <form onSubmit={handleMarkLeave} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Select Doctor</label>
                <select 
                  className="mt-1 w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-md border p-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
                  value={leaveDoctorId} 
                  onChange={e => setLeaveDoctorId(e.target.value)}
                >
                  <option className="dark:bg-slate-800" value="">-- Choose Doctor --</option>
                  {doctors.map(doc => <option className="dark:bg-slate-800" key={doc.id} value={doc.id}>{doc.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Leave Date</label>
                <input type="date" required className="mt-1 w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-md border p-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" value={leaveDate} onChange={e => setLeaveDate(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Reason (Optional)</label>
                <input type="text" className="mt-1 w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-md border p-2 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" value={leaveReason} onChange={e => setLeaveReason(e.target.value)} placeholder="e.g. Personal Emergency" />
              </div>
              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white dark:bg-red-500 dark:hover:bg-red-600 p-2 rounded-lg transition-colors flex justify-center items-center font-medium">
                <CalendarOff className="w-4 h-4 mr-2" /> Mark Leave
              </button>
            </form>
          </section>

        </div>
      </motion.main>
    </div>
  );
}
