import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import client from '../api/client';
import { motion } from 'framer-motion';
import { Activity } from 'lucide-react';
import BackgroundBalls from '../components/BackgroundBalls';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await client.post('/auth/login', { email, password });
      const { token, user } = res.data;
      
      localStorage.setItem('jwt', token);
      localStorage.setItem('user', JSON.stringify(user));

      if (user.role === 'PATIENT') navigate('/patient');
      else if (user.role === 'DOCTOR') navigate('/doctor');
      else if (user.role === 'ADMIN') navigate('/admin');
      
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to login');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4">
      <BackgroundBalls count={6} />
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-white/80 dark:bg-slate-900/80 backdrop-blur-md shadow-xl p-8 rounded-xl border border-gray-100 dark:border-gray-800 relative z-10"
      >
        <div className="flex flex-col items-center mb-8">
          <Activity className="w-10 h-10 text-indigo-600 dark:text-indigo-400 mb-2" />
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Welcome Back</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">Sign in to your HealthPortal account</p>
        </div>
        {error && <div className="mb-6 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/30 p-3 rounded-lg text-sm">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-5">
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
          <button type="submit" className="w-full bg-indigo-600 text-white dark:bg-indigo-500 hover:bg-indigo-700 dark:hover:bg-indigo-600 p-2.5 rounded-lg transition-colors font-medium">
            Login
          </button>
        </form>
        <p className="mt-6 text-center text-sm text-slate-600 dark:text-slate-400">
          Don't have an account? <Link to="/register" className="text-indigo-600 dark:text-indigo-400 font-medium hover:underline">Register here</Link>
        </p>
      </motion.div>
    </div>
  );
}
