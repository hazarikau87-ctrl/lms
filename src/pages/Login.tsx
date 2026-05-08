import { useState, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import { FlaskConical, Stethoscope } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const { error, data } = await supabase.auth.signInWithPassword({ 
        email, 
        password 
      });

      if (error) {
        setError(error.message);
        setLoading(false);
      } else if (data.user) {
        navigate('/'); 
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    /* Darkened background to slate-200/50 to prevent "snow blindness" */
    <div className="min-h-screen bg-slate-200/50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-xl shadow-blue-600/40 border-2 border-blue-400">
            <FlaskConical className="w-9 h-9 text-white" strokeWidth={2.5} />
          </div>
          <h1 className="text-2xl font-black text-gray-900 font-[Poppins] tracking-tight">Lab Management System</h1>
          <p className="text-xs font-bold text-gray-600 uppercase tracking-widest mt-1">By Next Appointment</p>
        </div>

        {/* Card - Added border-2 for clear physical boundaries */}
        <div className="bg-white rounded-3xl shadow-2xl shadow-gray-300 border-2 border-gray-200 p-8">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-12 h-12 bg-blue-100 border-2 border-blue-200 rounded-2xl flex items-center justify-center">
              <Stethoscope className="w-6 h-6 text-blue-700" strokeWidth={2.5} />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900">Admin Access</h2>
              <p className="text-xs font-bold text-gray-500 uppercase">Secure Credentials Required</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="admin@yourlab.com"
                required
                className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-900 font-medium placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
              />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                className="w-full px-4 py-3.5 rounded-xl border-2 border-gray-200 bg-gray-50 text-gray-900 font-medium placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition"
              />
            </div>

            {error && (
              <div className="bg-red-100 border-2 border-red-300 text-red-800 text-sm font-bold rounded-xl px-4 py-3 animate-pulse">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-xl font-bold text-base transition-all duration-200 shadow-lg shadow-blue-600/30 mt-4 active:scale-95"
            >
              {loading ? 'Authenticating...' : 'Login to Dashboard'}
            </button>
          </form>
        </div>

        <p className="text-center text-[10px] font-black text-gray-500 uppercase tracking-tighter mt-8">
          Authorized Personnel Only • Secure 256-bit Encryption
        </p>
      </div>
    </div>
  );
}
