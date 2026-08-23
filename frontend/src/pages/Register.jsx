import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import BackgroundBalls from '../components/BackgroundBalls';

export default function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('PATIENT');
  
  // Doctor specific fields
  const [specialization, setSpecialization] = useState('');
  const [workingHoursStart, setWorkingHoursStart] = useState('09:00');
  const [workingHoursEnd, setWorkingHoursEnd] = useState('17:00');
  
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      await client.post('/auth/register', { 
        name, 
        email, 
        password, 
        role,
        ...(role === 'DOCTOR' && { specialization, workingHoursStart, workingHoursEnd })
      });
      navigate('/login');
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || 'Failed to register');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden py-12 px-4">
      <BackgroundBalls count={6} />
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xl p-8 rounded-xl border border-gray-100 dark:border-gray-800 relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <Activity className="w-10 h-10 text-indigo-600 dark:text-indigo-400 mb-2" />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Create an Account</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Join HealthPortal today</p>
        </div>
        {error && <div className="mb-6 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-3 rounded-lg text-sm">{error}</div>}
        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
            <input 
              type="text" 
              required 
              className="mt-1 block w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg shadow-sm border p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" 
              value={name} 
              onChange={e => setName(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Email</label>
            <input 
              type="email" 
              required 
              className="mt-1 block w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg shadow-sm border p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" 
              value={email} 
              onChange={e => setEmail(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <input 
              type="password" 
              required 
              className="mt-1 block w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg shadow-sm border p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" 
              value={password} 
              onChange={e => setPassword(e.target.value)} 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Role</label>
            <select 
              className="mt-1 block w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg shadow-sm border p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition-colors"
              value={role}
              onChange={e => setRole(e.target.value)}
            >
              <option className="dark:bg-slate-800" value="PATIENT">Patient</option>
              <option className="dark:bg-slate-800" value="DOCTOR">Doctor</option>
              <option className="dark:bg-slate-800" value="ADMIN">Admin</option>
            </select>
          </div>

          {role === 'DOCTOR' && (
            <div className="space-y-4 border-t border-slate-200 dark:border-slate-700 pt-4 mt-4">
              <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Doctor Profile Details</h3>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Specialization</label>
                <input 
                  type="text" 
                  required 
                  className="mt-1 block w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg shadow-sm border p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" 
                  value={specialization} 
                  onChange={e => setSpecialization(e.target.value)} 
                  placeholder="e.g. Cardiology"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Working Hours Start</label>
                  <input 
                    type="time" 
                    required 
                    className="mt-1 block w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg shadow-sm border p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" 
                    value={workingHoursStart} 
                    onChange={e => setWorkingHoursStart(e.target.value)} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Working Hours End</label>
                  <input 
                    type="time" 
                    required 
                    className="mt-1 block w-full bg-transparent border-slate-300 dark:border-gray-700 text-slate-900 dark:text-white rounded-lg shadow-sm border p-2.5 focus:ring-indigo-500 focus:border-indigo-500 transition-colors" 
                    value={workingHoursEnd} 
                    onChange={e => setWorkingHoursEnd(e.target.value)} 
                  />
                </div>
              </div>
            </div>
          )}

          <button type="submit" className="w-full bg-indigo-600 text-white dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 p-2.5 rounded-lg transition-colors font-medium mt-6">
            Register
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Already have an account? <Link to="/login" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Login here</Link>
        </p>
      </motion.div>
    </div>
  );
}
