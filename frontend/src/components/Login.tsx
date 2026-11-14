import React, { useState } from 'react';
import { User, StudentProfile } from '../types';
import { apiRequest, setAuthToken } from '../api';
import { Library, LogIn, Shield, UserCheck, GraduationCap, AlertCircle } from 'lucide-react';

interface LoginProps {
  onLoginSuccess: (user: User, student: StudentProfile | null) => void;
}

export const Login: React.FC<LoginProps> = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('smartlib123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await apiRequest<{ token: string; user: User; student: StudentProfile | null }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
      });
      setAuthToken(data.token);
      onLoginSuccess(data.user, data.student);
    } catch (err: any) {
      setError(err.message || 'Login failed. Please check credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = (demoEmail: string) => {
    setEmail(demoEmail);
    setPassword('smartlib123');
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col justify-center items-center px-4 py-8">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="h-16 w-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl flex items-center justify-center text-blue-400 mb-4 shadow-inner">
            <Library className="h-8 w-8" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">SmartLib University</h1>
          <p className="text-slate-400 text-sm mt-1 text-center">Seat, Room & Real-time Occupancy Management</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-950/60 border border-red-500/40 rounded-xl flex items-center gap-3 text-red-200 text-sm">
            <AlertCircle className="h-5 w-5 text-red-400 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Institutional Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="e.g. student1@smartlib.edu"
              required
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-300 mb-2">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full bg-slate-950/80 border border-slate-700/80 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-3 rounded-xl transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer"
          >
            {loading ? (
              <div className="h-5 w-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                <LogIn className="h-5 w-5" />
                <span>Sign In to SmartLib</span>
              </>
            )}
          </button>
        </form>

        <div className="mt-8 pt-6 border-t border-slate-800">
          <p className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-3 text-center">
            Demo Portal Fast-Fill
          </p>
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              onClick={() => handleQuickLogin('student1@smartlib.edu')}
              className="px-2 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs rounded-lg flex flex-col items-center gap-1 transition"
            >
              <GraduationCap className="h-4 w-4 text-emerald-400" />
              <span>Student 1</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('librarian@smartlib.edu')}
              className="px-2 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs rounded-lg flex flex-col items-center gap-1 transition"
            >
              <UserCheck className="h-4 w-4 text-amber-400" />
              <span>Front Desk</span>
            </button>
            <button
              type="button"
              onClick={() => handleQuickLogin('admin@smartlib.edu')}
              className="px-2 py-2 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 text-xs rounded-lg flex flex-col items-center gap-1 transition"
            >
              <Shield className="h-4 w-4 text-indigo-400" />
              <span>Admin</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
