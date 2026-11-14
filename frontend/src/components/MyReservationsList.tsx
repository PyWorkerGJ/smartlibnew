import React, { useState } from 'react';
import { Reservation } from '../types';
import { apiRequest } from '../api';
import { Calendar, Clock, Armchair, Ban, CheckCircle2, AlertCircle } from 'lucide-react';

interface MyReservationsProps {
  reservations: Reservation[];
  onRefresh: () => void;
}

export const MyReservationsList: React.FC<MyReservationsProps> = ({ reservations, onRefresh }) => {
  const [cancellingId, setCancellingId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleCancel = async (id: number) => {
    if (!window.confirm('Are you sure you want to cancel this pending reservation?')) return;
    setCancellingId(id);
    setFeedback(null);
    try {
      await apiRequest(`/reservations/${id}/cancel`, { method: 'POST' });
      setFeedback({ type: 'success', message: 'Reservation cancelled successfully.' });
      onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'error', message: err.message || 'Failed to cancel reservation.' });
    } finally {
      setCancellingId(null);
    }
  };

  const getStatusBadge = (status: Reservation['status']) => {
    switch (status) {
      case 'PENDING':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">Pending Check-in</span>;
      case 'CHECKED_IN':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">Active Session</span>;
      case 'COMPLETED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-700 text-slate-300">Completed</span>;
      case 'CANCELLED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-slate-800 text-slate-500">Cancelled</span>;
      case 'EXPIRED':
        return <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/20 text-rose-400 border border-rose-500/30">No-show Expired</span>;
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-lg font-bold text-white flex items-center gap-2">
            <Calendar className="h-5 w-5 text-blue-400" /> My Booking History & Upcoming
          </h3>
          <p className="text-xs text-slate-400 mt-1">Review your reservations, arrival windows, and completion records.</p>
        </div>
      </div>

      {feedback && (
        <div className={`mb-4 p-3 rounded-xl border flex items-center gap-2 text-xs ${
          feedback.type === 'success' ? 'bg-emerald-950/50 border-emerald-500/50 text-emerald-200' : 'bg-rose-950/50 border-rose-500/50 text-rose-200'
        }`}>
          {feedback.type === 'success' ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <AlertCircle className="h-4 w-4 text-rose-400" />}
          <span>{feedback.message}</span>
        </div>
      )}

      {reservations.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          No bookings yet. Explore the seat map or meeting rooms above!
        </div>
      ) : (
        <div className="divide-y divide-slate-800">
          {reservations.map((res) => (
            <div key={res.id} className="py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <div className="flex items-center gap-2.5">
                  <Armchair className="h-4 w-4 text-blue-400" />
                  <span className="font-semibold text-white text-sm">{res.resource_name}</span>
                  {getStatusBadge(res.status)}
                </div>
                <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 mt-1.5">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    {new Date(res.start_time).toLocaleString([], { dateStyle: 'short', timeStyle: 'short' })} → {new Date(res.end_time).toLocaleTimeString([], { timeStyle: 'short' })}
                  </span>
                  <span>Floor {res.floor} • {res.zone}</span>
                </div>
              </div>

              {res.status === 'PENDING' && (
                <button
                  type="button"
                  disabled={cancellingId === res.id}
                  onClick={() => handleCancel(res.id)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-rose-900/40 text-slate-300 hover:text-rose-300 text-xs rounded-xl border border-slate-700 transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <Ban className="h-3.5 w-3.5" />
                  <span>{cancellingId === res.id ? 'Cancelling...' : 'Cancel'}</span>
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
