import React, { useState } from 'react';
import { apiRequest } from '../api';
import { UserCheck, Search, CheckCircle2, AlertCircle, Armchair, Clock, User } from 'lucide-react';

export const FrontDeskCheckIn: React.FC = () => {
  const [regNumber, setRegNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [studentLookup, setStudentLookup] = useState<any | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regNumber.trim()) return;
    setLoading(true);
    setFeedback(null);
    setStudentLookup(null);
    try {
      const data = await apiRequest(`/frontdesk/lookup?reg=${encodeURIComponent(regNumber.trim())}`);
      setStudentLookup(data);
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Student not found.' });
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmCheckIn = async () => {
    setLoading(true);
    setFeedback(null);
    try {
      const res = await apiRequest('/frontdesk/checkin', {
        method: 'POST',
        body: JSON.stringify({ registrationNumber: regNumber.trim() })
      });
      setFeedback({ type: 'success', message: res.message });
      setStudentLookup(null);
      setRegNumber('');
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Check-in failed.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl max-w-3xl mx-auto">
      <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-800">
        <div className="h-10 w-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
          <UserCheck className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-white">Physical Front-Desk Check-In</h2>
          <p className="text-xs text-slate-400">
            Verify student identity and activate seat/room physical occupancy.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          className={`mb-6 p-4 rounded-xl border flex items-center gap-3 text-sm ${
            feedback.type === 'success'
              ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200'
              : 'bg-rose-950/50 border-rose-500/50 text-rose-200'
          }`}
        >
          {feedback.type === 'success' ? (
            <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertCircle className="h-5 w-5 text-rose-400 shrink-0" />
          )}
          <span>{feedback.message}</span>
        </div>
      )}

      <form onSubmit={handleLookup} className="flex gap-3 mb-6">
        <div className="relative flex-1">
          <input
            type="text"
            value={regNumber}
            onChange={(e) => setRegNumber(e.target.value)}
            placeholder="Enter Student Registration No (e.g. REG-2026-001)"
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 focus:outline-none focus:border-amber-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !regNumber.trim()}
          className="bg-amber-600 hover:bg-amber-500 text-slate-950 font-bold px-6 py-3 rounded-xl transition flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <Search className="h-4 w-4" />
          <span>Lookup</span>
        </button>
      </form>

      {studentLookup && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 space-y-6">
          <div className="flex items-start justify-between border-b border-slate-800 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400" />
                <h3 className="text-lg font-bold text-white">{studentLookup.student.name}</h3>
                <span className="font-mono text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                  {studentLookup.student.registration_number}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                {studentLookup.student.department} • Year {studentLookup.student.year_of_study}
              </p>
            </div>
          </div>

          <div>
            <h4 className="text-xs uppercase font-semibold text-slate-400 tracking-wider mb-3">
              Active / Scheduled Bookings Today
            </h4>
            {studentLookup.reservations.length === 0 ? (
              <p className="text-xs text-slate-500">No active or pending bookings found for today.</p>
            ) : (
              <div className="space-y-3">
                {studentLookup.reservations.map((res: any) => (
                  <div
                    key={res.id}
                    className="p-4 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-between"
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Armchair className="h-4 w-4 text-blue-400" />
                        <span className="text-sm font-bold text-white">{res.resource_name}</span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded font-semibold ${
                            res.status === 'PENDING'
                              ? 'bg-amber-500/20 text-amber-400'
                              : 'bg-emerald-500/20 text-emerald-400'
                          }`}
                        >
                          {res.status}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 flex items-center gap-2 mt-1">
                        <Clock className="h-3 w-3" />
                        <span>
                          {new Date(res.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} →{' '}
                          {new Date(res.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              disabled={loading}
              onClick={handleConfirmCheckIn}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold px-6 py-3 rounded-xl transition flex items-center gap-2 cursor-pointer shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              <CheckCircle2 className="h-5 w-5" />
              <span>Confirm Physical Check-In</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
