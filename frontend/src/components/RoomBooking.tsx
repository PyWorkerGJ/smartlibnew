import React, { useState } from 'react';
import { Resource } from '../types';
import { apiRequest } from '../api';
import { Users, Tv, Presentation, Wind, Calendar, Clock, CheckCircle2, AlertCircle } from 'lucide-react';

interface RoomBookingProps {
  resources: Resource[];
  onReservationSuccess: () => void;
}

export const RoomBooking: React.FC<RoomBookingProps> = ({ resources, onReservationSuccess }) => {
  const rooms = resources.filter((r) => r.type === 'STUDY_ROOM' || r.type === 'MEETING_ROOM');
  const [selectedRoom, setSelectedRoom] = useState<Resource | null>(null);
  const [bookingDate, setBookingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState(() => {
    const d = new Date(Date.now() + 5 * 60 * 1000);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  });
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleBook = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRoom) return;
    setSubmitting(true);
    setFeedback(null);

    try {
      const [hours, minutes] = startTime.split(':').map(Number);
      const startDateTime = new Date(`${bookingDate}T00:00:00`);
      startDateTime.setHours(hours, minutes, 0, 0);

      const endDateTime = new Date(startDateTime.getTime() + durationMinutes * 60 * 1000);

      await apiRequest('/reservations', {
        method: 'POST',
        body: JSON.stringify({
          resourceId: selectedRoom.id,
          startTime: startDateTime.toISOString(),
          endTime: endDateTime.toISOString()
        })
      });

      setFeedback({
        type: 'success',
        message: `Reserved ${selectedRoom.name}! Check in at front desk within 15 mins of start time.`
      });
      setSelectedRoom(null);
      onReservationSuccess();
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Could not complete room booking.'
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {feedback && (
        <div
          className={`p-4 rounded-xl border flex items-center gap-3 text-sm ${
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {rooms.map((room) => {
          const isSelected = selectedRoom?.id === room.id;
          const isAvailable = room.currentStatus === 'AVAILABLE';

          return (
            <div
              key={room.id}
              className={`bg-slate-900 border rounded-2xl p-6 transition flex flex-col justify-between ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-500/30'
                  : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              <div>
                <div className="flex justify-between items-start mb-3">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold uppercase tracking-wider ${
                      room.type === 'STUDY_ROOM'
                        ? 'bg-purple-500/20 text-purple-400 border border-purple-500/30'
                        : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    }`}
                  >
                    {room.type === 'STUDY_ROOM' ? 'Study Room' : 'Meeting Room'}
                  </span>

                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                      room.currentStatus === 'AVAILABLE'
                        ? 'bg-emerald-950/60 text-emerald-400 border border-emerald-500/30'
                        : room.currentStatus === 'OCCUPIED'
                        ? 'bg-rose-950/60 text-rose-400 border border-rose-500/30'
                        : 'bg-amber-950/60 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {room.currentStatus}
                  </span>
                </div>

                <h3 className="text-lg font-bold text-white mb-1">{room.name}</h3>
                <p className="text-xs text-slate-400 mb-4">
                  Floor {room.floor} • {room.zone}
                </p>

                <div className="space-y-2 mb-6 text-xs text-slate-300">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-slate-400" />
                    <span>Capacity: {room.capacity} Persons</span>
                  </div>
                  {room.amenities?.projector && (
                    <div className="flex items-center gap-2">
                      <Presentation className="h-4 w-4 text-blue-400" />
                      <span>HD Projector & Screen</span>
                    </div>
                  )}
                  {room.amenities?.monitor && (
                    <div className="flex items-center gap-2">
                      <Tv className="h-4 w-4 text-cyan-400" />
                      <span>LED Display Monitor</span>
                    </div>
                  )}
                  {room.amenities?.ac && (
                    <div className="flex items-center gap-2">
                      <Wind className="h-4 w-4 text-teal-400" />
                      <span>Climate Controlled AC</span>
                    </div>
                  )}
                </div>
              </div>

              <div>
                <button
                  type="button"
                  disabled={!isAvailable}
                  onClick={() => setSelectedRoom(isSelected ? null : room)}
                  className={`w-full py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white'
                      : isAvailable
                      ? 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'
                      : 'bg-slate-800/40 text-slate-500 border border-slate-800 cursor-not-allowed'
                  }`}
                >
                  {isSelected ? 'Selected for Booking' : isAvailable ? 'Select Room' : 'Unavailable Now'}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedRoom && (
        <div className="bg-slate-900 border border-blue-500/40 rounded-2xl p-6 shadow-2xl mt-6">
          <h3 className="text-lg font-bold text-white mb-2">Book {selectedRoom.name}</h3>
          <p className="text-xs text-slate-400 mb-6">
            Study and meeting room sessions max 2 hours. Physical check-in at front desk required.
          </p>

          <form onSubmit={handleBook} className="grid grid-cols-1 sm:grid-cols-4 gap-4 items-end">
            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5 flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-blue-400" /> Booking Date
              </label>
              <input
                type="date"
                value={bookingDate}
                onChange={(e) => setBookingDate(e.target.value)}
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
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
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase text-slate-300 mb-1.5">
                Duration (Max 120 mins)
              </label>
              <select
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm"
              >
                <option value={30}>30 Minutes</option>
                <option value={60}>1 Hour</option>
                <option value={90}>1.5 Hours</option>
                <option value={120}>2 Hours</option>
              </select>
            </div>

            <div>
              <button
                type="submit"
                disabled={submitting}
                className="w-full bg-blue-600 hover:bg-blue-500 text-white font-medium py-2.5 rounded-xl transition cursor-pointer shadow-lg shadow-blue-600/30 flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <div className="h-4 w-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                ) : (
                  <span>Confirm Room Booking</span>
                )}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
