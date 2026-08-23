import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { User, Activity, Clock, Briefcase, Mail, CheckCircle } from 'lucide-react';
import client from '../api/client';
import Navbar from '../components/Navbar';
import BackgroundBalls from '../components/BackgroundBalls';

export default function Profile() {
  const [role, setRole] = useState('');
  
  // Common
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  
  // Patient
  const [chronicDiseases, setChronicDiseases] = useState('');
  const [allergies, setAllergies] = useState('');
  const [pastSurgeries, setPastSurgeries] = useState('');
  
  // Doctor
  const [specialization, setSpecialization] = useState('');
  const [workingHoursStart, setWorkingHoursStart] = useState('');
  const [workingHoursEnd, setWorkingHoursEnd] = useState('');
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const res = await client.get('/users/profile');
      const { user, profile } = res.data;
      
      setRole(user.role);
      setName(user.name || '');
      setEmail(user.email || '');
      
      if (user.role === 'PATIENT') {
        setChronicDiseases(profile.chronic_diseases || '');
        setAllergies(profile.allergies || '');
        setPastSurgeries(profile.past_surgeries || '');
      } else if (user.role === 'DOCTOR') {
        setSpecialization(profile.specialization || '');
        setWorkingHoursStart(profile.working_hours_start || '');
        setWorkingHoursEnd(profile.working_hours_end || '');
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setMessage('');
    
    try {
      const payload = { name, email };
      if (role === 'PATIENT') {
        payload.chronicDiseases = chronicDiseases;
        payload.allergies = allergies;
        payload.pastSurgeries = pastSurgeries;
      } else if (role === 'DOCTOR') {
        payload.specialization = specialization;
        payload.workingHoursStart = workingHoursStart;
        payload.workingHoursEnd = workingHoursEnd;
      }
      
      const res = await client.put('/users/profile', payload);
      
      const localUser = JSON.parse(localStorage.getItem('user'));
      if (localUser) {
        localUser.name = res.data.user.name;
        localStorage.setItem('user', JSON.stringify(localUser));
      }
      
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error(err);
      setMessage('Failed to update profile');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-transparent">
        <BackgroundBalls count={2} />
        <Navbar />
        <div className="text-xl text-slate-700 dark:text-slate-300">Loading profile...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-transparent transition-colors duration-300 relative overflow-hidden">
      <BackgroundBalls count={2} />
      <Navbar />
      
      <motion.main 
        initial={{ opacity: 0, y: 10 }} 
        animate={{ opacity: 1, y: 0 }} 
        className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 relative z-10"
      >
        <div className="bg-white/90 dark:bg-slate-900/90 backdrop-blur-md p-8 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-8 border-b border-gray-200 dark:border-gray-700 pb-4">
            <div className="p-3 bg-indigo-100 dark:bg-indigo-900/50 rounded-full">
              <User className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 dark:text-white">Your Profile</h1>
              <p className="text-slate-500 dark:text-slate-400">{role.charAt(0) + role.slice(1).toLowerCase()} Settings</p>
            </div>
          </div>
          
          {message && (
            <div className={`mb-6 p-4 rounded-lg flex items-center gap-2 ${message.includes('success') ? 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300 border border-teal-200 dark:border-teal-800' : 'bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800'}`}>
              {message.includes('success') && <CheckCircle className="w-5 h-5" />}
              {message}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-6">
            
            {/* Common Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <User className="w-4 h-4" /> Full Name
                </label>
                <input 
                  type="text" 
                  className="w-full bg-white dark:bg-slate-800 border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg border p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" 
                  value={name} 
                  onChange={e => setName(e.target.value)} 
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                  <Mail className="w-4 h-4" /> Email
                </label>
                <input 
                  type="email" 
                  disabled
                  className="w-full bg-gray-50 dark:bg-slate-800/50 border-slate-200 dark:border-gray-700 text-slate-500 dark:text-slate-400 rounded-lg border p-2.5 cursor-not-allowed" 
                  value={email} 
                />
                <p className="text-xs text-slate-400 mt-1">Email cannot be changed.</p>
              </div>
            </div>

            {/* Patient Fields */}
            {role === 'PATIENT' && (
              <>
                <hr className="border-gray-200 dark:border-gray-700 my-6" />
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                  <Activity className="w-5 h-5 text-indigo-500" /> Medical History
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Chronic Diseases</label>
                    <textarea rows="2" className="w-full bg-white dark:bg-slate-800 border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg border p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" value={chronicDiseases} onChange={e => setChronicDiseases(e.target.value)} placeholder="e.g. Asthma, Diabetes"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Allergies</label>
                    <textarea rows="2" className="w-full bg-white dark:bg-slate-800 border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg border p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" value={allergies} onChange={e => setAllergies(e.target.value)} placeholder="e.g. Penicillin, Pollen"></textarea>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Past Surgeries</label>
                    <textarea rows="2" className="w-full bg-white dark:bg-slate-800 border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg border p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" value={pastSurgeries} onChange={e => setPastSurgeries(e.target.value)} placeholder="e.g. Appendectomy 2018"></textarea>
                  </div>
                </div>
              </>
            )}

            {/* Doctor Fields */}
            {role === 'DOCTOR' && (
              <>
                <hr className="border-gray-200 dark:border-gray-700 my-6" />
                <h3 className="text-lg font-semibold text-slate-800 dark:text-white flex items-center gap-2">
                  <Briefcase className="w-5 h-5 text-indigo-500" /> Professional Details
                </h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Specialization</label>
                    <input 
                      type="text" 
                      className="w-full bg-white dark:bg-slate-800 border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg border p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" 
                      value={specialization} 
                      onChange={e => setSpecialization(e.target.value)} 
                      placeholder="e.g. Cardiology, General Practice"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <Clock className="w-4 h-4" /> Working Hours Start
                    </label>
                    <input 
                      type="time" 
                      className="w-full bg-white dark:bg-slate-800 border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg border p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" 
                      value={workingHoursStart} 
                      onChange={e => setWorkingHoursStart(e.target.value)} 
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-1">
                      <Clock className="w-4 h-4" /> Working Hours End
                    </label>
                    <input 
                      type="time" 
                      className="w-full bg-white dark:bg-slate-800 border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg border p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" 
                      value={workingHoursEnd} 
                      onChange={e => setWorkingHoursEnd(e.target.value)} 
                    />
                  </div>
                </div>
              </>
            )}

            <div className="pt-6 flex justify-end">
              <button 
                type="submit" 
                disabled={isSaving} 
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white dark:bg-indigo-500 dark:hover:bg-indigo-600 rounded-lg shadow-md transition-all disabled:opacity-50 font-medium"
              >
                {isSaving ? 'Saving Changes...' : 'Save Changes'}
              </button>
            </div>
            
          </form>
        </div>
      </motion.main>
    </div>
  );
}
