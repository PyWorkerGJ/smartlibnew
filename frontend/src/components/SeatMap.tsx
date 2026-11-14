import React, { useState } from 'react';
import { Resource } from '../types';
import { apiRequest } from '../api';
import { Armchair, Zap, Wifi, CheckCircle2, AlertCircle, Clock, Calendar } from 'lucide-react';

interface SeatMapProps {
  resources: Resource[];
  selectedFloor: number;
  onReservationSuccess: () => void;
}

export const SeatMap: React.FC<SeatMapProps> = ({ resources, selectedFloor, onReservationSuccess }) => {
  const [selectedSeat, setSelectedSeat] = useState<Resource | null>(null);
  const [bookingDate, setBookingDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [durationMinutes, setDurationMinutes] = useState(120);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Filter seats on the selected floor
  const floorSeats = resources.filter(
    (r) => r.type === 'SEAT' && r.floor === selectedFloor
  );

  // Group by rows
  const maxRow = Math.max(...floorSeats.map((s) => s.layout_row || 1), 1);
  const maxCol = Math.max(...floorSeats.map((s) => s.layout_col || 1), 1);

  const getSeatAt = (row: number, col: number) => {
    return floorSeats.find((s) => s.layout_row === row && s.layout_col === col);
  };

  const getStatusColor = (seat: Resource, isSelected: boolean) => {
    if (isSelected) return 'bg-blue-600 text-white border-blue-400 ring-2 ring-blue-400/50 scale-105';
    switch (seat.currentStatus) {
      case 'AVAILABLE':
        return 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/60 hover:border-emerald-400';
      case 'RESERVED':
        return 'bg-amber-950/40 border-amber-500/50 text-amber-300 cursor-not-allowed opacity-80';
      case 'OCCUPIED':
        return 'bg-rose-950/40 border-rose-500/50 text-rose-300 cursor-not-allowed opacity-80';
      case 'MAINTENANCE':
        return 'bg-slate-800 border-slate-600 text-slate-500 cursor-not-allowed';
      default:
        return 'bg-slate-800 border-slate-700 text-slate-300';
    }
  };

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSeat) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const [hours, minutes] = startTime.split(':').map(Number);
      const startDateTime = new Date(`${bookingDate}T00:00:00`);
      startDateTime.setHours(hours, minutes, 0, 0);

      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);

      const pad = (n: number) => String(n).padStart(2, '0');
      const formatLocal = (d: Date) =>
        `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

      await apiRequest('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          resourceId: selectedSeat.id,
          startTime: formatLocal(startDateTime),
          endTime: formatLocal(endDateTime)
        })
      });

      setFeedback({
        type: 'success',
        message: `Successfully reserved ${selectedSeat.name}! Arrive within 15 minutes of scheduled start to check in.`
      });
      setSelectedSeat(null);
      onReservationSuccess();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Could not complete reservation.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Armchair className="h-6 w-6 text-blue-400" />
            Floor {selectedFloor} Interactive Cinema-Style Seat Map
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time status calculated from live database records. Click an available seat to reserve.
          </p>
        </div>

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-3 text-xs bg-slate-950/70 px-4 py-2.5 rounded-xl border border-slate-800">
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-emerald-500/30 border border-emerald-500"></span>
            <span className="text-slate-300">Available</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-amber-500/30 border border-amber-500"></span>
            <span className="text-slate-300">Reserved</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-rose-500/30 border border-rose-500"></span>
            <span className="text-slate-300">Occupied</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-slate-800 border border-slate-600"></span>
            <span className="text-slate-400">Maintenance</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3.5 h-3.5 rounded bg-blue-600 border border-blue-400"></span>
            <span className="text-blue-300 font-medium">Selected</span>
          </div>
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

      {/* Grid Canvas */}
      <div className="overflow-x-auto pb-4">
        <div className="min-w-[640px] flex flex-col items-center">
          {/* Whiteboard / Screen Visual Anchor */}
          <div className="w-3/4 max-w-lg mb-8 py-2 px-4 rounded-lg bg-slate-800/60 border border-slate-700/80 text-center text-xs tracking-widest uppercase font-semibold text-slate-400 shadow-inner">
            📚 Main Library Front & Study Screen Direction
          </div>

          <div className="space-y-4">
            {Array.from({ length: maxRow }, (_, rIdx) => {
              const rowNum = rIdx + 1;
              return (
                <div key={rowNum} className="flex items-center gap-3">
                  <span className="text-xs font-mono text-slate-400 w-6 text-right">
                    R{rowNum}
                  </span>
                  <div className="flex gap-2.5">
                    {Array.from({ length: maxCol }, (_, cIdx) => {
                      const colNum = cIdx + 1;
                      const seat = getSeatAt(rowNum, colNum);

                      if (!seat) {
                        return <div key={colNum} className="w-12 h-12" />;
                      }

                      const isSelected = selectedSeat?.id === seat.id;
                      const isClickable = seat.currentStatus === 'AVAILABLE';

                      return (
                        <button
                          key={seat.id}
                          type="button"
                          disabled={!isClickable}
                          onClick={() => setSelectedSeat(isSelected ? null : seat)}
                          className={`w-12 h-12 rounded-xl border transition-all duration-150 flex flex-col items-center justify-center p-1 relative ${getStatusColor(
                            seat,
                            isSelected
                          )}`}
                          title={`${seat.name} (${seat.zone}) - Status: ${seat.currentStatus}`}
                        >
                          <span className="text-xs font-bold leading-none">
                            {seat.identifier.split('-')[1] || seat.identifier}
                          </span>
                          <div className="flex gap-1 mt-1">
                            {seat.amenities?.has_power_socket && (
                              <Zap className="h-2.5 w-2.5 text-amber-400" />
                            )}
                            {seat.amenities?.has_ethernet && (
                              <Wifi className="h-2.5 w-2.5 text-cyan-400" />
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Seat Booking Drawer */}
      {selectedSeat && (
        <div className="mt-8 pt-6 border-t border-slate-800 bg-slate-950/60 p-6 rounded-2xl border border-blue-500/20 shadow-2xl">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  {selectedSeat.zone}
                </span>
                <h3 className="text-lg font-bold text-white">{selectedSeat.name}</h3>
              </div>
              <p className="text-xs text-slate-400 mt-1">
                Row {selectedSeat.layout_row}, Column {selectedSeat.layout_col} • Floor {selectedSeat.floor}
              </p>
            </div>

            <div className="flex items-center gap-4 text-xs text-slate-300">
              {selectedSeat.amenities?.has_power_socket && (
                <span className="flex items-center gap-1 text-amber-400">
                  <Zap className="h-3.5 w-3.5" /> Power Socket
                </span>
              )}
              {selectedSeat.amenities?.near_window && <span>🪟 Near Window</span>}
              {selectedSeat.amenities?.accessible && <span>♿ Accessible</span>}
            </div>
          </div>

          <form onSubmit={handleBook} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-400" /> Date
              </label>
              <input
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5 text-blue-400" /> Start Time
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                Duration (Max 3 hrs)
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-500"
              >
                <option value={30}>30 Minutes</option>
                <option value={60}>1 Hour</option>
                <option value={90}>1.5 Hours</option>
                <option value={120}>2 Hours</option>
                <option value={180}>3 Hours</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl transition shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
              >
                {submitting ? (
                  <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Confirm Reservation</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
