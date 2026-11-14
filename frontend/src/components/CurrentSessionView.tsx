import React, { useState, useEffect } from 'react';
import { ActiveSession } from '../types';
import { apiRequest } from '../api';
import { Clock, Armchair, PlusCircle, LogOut, AlertCircle, CheckCircle2 } from 'lucide-react';

interface CurrentSessionProps {
  onSessionChange: () => void;
}

export const CurrentSessionView: React.FC<CurrentSessionProps> = ({ onSessionChange }) => {
  const [session, setSession] = useState<ActiveSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [extending, setExtending] = useState(false);
  const [releasing, setReleasing] = useState(false);
  const [remainingTime, setRemainingTime] = useState<string>('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchSession = async () => {
    try {
      const data = await apiRequest<ActiveSession | null>('/sessions/active');
      setSession(data);
    } catch (err) {
      console.error('Failed to fetch session', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  // Update countdown timer
  useEffect(() => {
    if (!session) return;

    const interval = setInterval(() => {
      const end = new Date(session.scheduled_end_time).getTime();
      const now = new Date().getTime();
      const diff = end - now;

      if (diff <= 0) {
        setRemainingTime('Elapsed (Auto-completing...)');
      } else {
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        setRemainingTime(
          `${hours > 0 ? `${hours}h ` : ''}${minutes}m ${String(seconds).padStart(2, '0')}s`
        );
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [session]);

  const handleExtend = async (minutes: number) => {
    if (!session) return;
    setExtending(true);
    setFeedback(null);
    try {
      const res = await apiRequest(`/sessions/${session.id}/extend`, {
        method: 'POST',
        body: JSON.stringify({ minutes })
      });
      setFeedback({ type: 'success', message: res.message });
      await fetchSession();
      onSessionChange();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Extension failed.' });
    } finally {
      setExtending(false);
    }
  };

  const handleRelease = async () => {
    if (!session) return;
    if (!window.confirm(`Are you sure you want to release ${session.resource_name}? This will free the seat for other students.`)) {
      return;
    }
    setReleasing(true);
    setFeedback(null);
    try {
      await apiRequest(`/sessions/${session.id}/release`, {
        method: 'POST'
      });
      setFeedback({ type: 'success', message: `${session.resource_name} has been released.` });
      setSession(null);
      onSessionChange();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to release session.' });
    } finally {
      setReleasing(false);
    }
  };

  if (loading) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 flex items-center justify-center">
        <div className="h-6 w-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 text-center">
        <Armchair className="h-10 w-10 text-slate-600 mx-auto mb-3" />
        <h3 className="text-base font-semibold text-slate-300">No Active Physical Session</h3>
        <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1">
          When you reserve a seat and check in at the library front desk, your live session and timer will appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-br from-slate-900 via-slate-900 to-blue-950/40 border border-blue-500/30 rounded-2xl p-6 shadow-2xl relative overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            ● Physically Checked In
          </span>
          <h2 className="text-2xl font-bold text-white mt-2 flex items-center gap-2">
            <Armchair className="h-6 w-6 text-blue-400" />
            {session.resource_name}
          </h2>
          <p className="text-xs text-slate-400">
            Floor {session.floor} • {session.zone} • Checked In at{' '}
            {new Date(session.check_in_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </p>
        </div>

        <div className="bg-slate-950/80 border border-slate-800 px-6 py-3 rounded-2xl text-center shadow-inner">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-400 flex items-center gap-1.5 justify-center">
            <Clock className="h-3.5 w-3.5 text-blue-400" /> Time Remaining
          </span>
          <div className="text-2xl font-black font-mono text-blue-300 mt-1">{remainingTime}</div>
          <span className="text-[11px] text-slate-500">
            Scheduled End:{' '}
            {new Date(session.scheduled_end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
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

      <div className="pt-6 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold text-slate-400">Extend Session:</span>
          <button
            type="button"
            disabled={extending}
            onClick={() => handleExtend(15)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <PlusCircle className="h-3.5 w-3.5 text-blue-400" /> +15m
          </button>
          <button
            type="button"
            disabled={extending}
            onClick={() => handleExtend(30)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <PlusCircle className="h-3.5 w-3.5 text-blue-400" /> +30m
          </button>
          <button
            type="button"
            disabled={extending}
            onClick={() => handleExtend(60)}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs rounded-xl border border-slate-700 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            <PlusCircle className="h-3.5 w-3.5 text-blue-400" /> +60m
          </button>
        </div>

        <button
          type="button"
          disabled={releasing}
          onClick={handleRelease}
          className="px-4 py-2 bg-rose-600/90 hover:bg-rose-500 text-white font-medium text-xs rounded-xl transition shadow-lg shadow-rose-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50"
        >
          <LogOut className="h-4 w-4" />
          <span>Release {session.resource_type === 'SEAT' ? 'Seat' : 'Room'} Now</span>
        </button>
      </div>
    </div>
  );
};
