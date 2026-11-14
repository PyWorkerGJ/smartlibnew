import React, { useState, useEffect } from 'react';
import { User, StudentProfile, Resource, Reservation } from './types';
import { apiRequest, setAuthToken, getSocket } from './api';
import { Login } from './components/Login';
import { SeatMap } from './components/SeatMap';
import { RoomBooking } from './components/RoomBooking';
import { CurrentSessionView } from './components/CurrentSessionView';
import { MyReservationsList } from './components/MyReservationsList';
import { FrontDeskCheckIn } from './components/FrontDeskCheckIn';
import { AdminDashboard } from './components/AdminDashboard';
import {
  Library,
  Armchair,
  DoorOpen,
  CalendarDays,
  UserCheck,
  Shield,
  LogOut,
  Layers,
  Sparkles,
  Wifi
} from 'lucide-react';

export function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [studentProfile, setStudentProfile] = useState<StudentProfile | null>(null);
  const [activeTab, setActiveTab] = useState<'seats' | 'rooms' | 'reservations' | 'frontdesk' | 'admin'>('seats');
  const [selectedFloor, setSelectedFloor] = useState<number>(1);
  const [resources, setResources] = useState<Resource[]>([]);
  const [occupancyStats, setOccupancyStats] = useState<any>(null);
  const [myReservations, setMyReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);

  // Authenticate session on boot
  useEffect(() => {
    apiRequest<{ user: User; student: StudentProfile | null }>('/auth/me')
      .then((data) => {
        setCurrentUser(data.user);
        setStudentProfile(data.student);
        if (data.user.role === 'LIBRARIAN') setActiveTab('frontdesk');
        if (data.user.role === 'ADMIN') setActiveTab('admin');
      })
      .catch(() => {
        setCurrentUser(null);
        setStudentProfile(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // Fetch live resource and occupancy data
  const refreshData = async () => {
    try {
      const [resData, statsData] = await Promise.all([
        apiRequest<Resource[]>('/resources'),
        apiRequest<any>('/resources/stats')
      ]);
      setResources(resData);
      setOccupancyStats(statsData);

      if (currentUser?.role === 'STUDENT') {
        const reservations = await apiRequest<Reservation[]>('/reservations/my');
        setMyReservations(reservations);
      }
    } catch (err) {
      console.error('Error fetching library data:', err);
    }
  };

  useEffect(() => {
    if (currentUser) {
      refreshData();
      const socket = getSocket();

      socket.on('RESERVATION_CREATED', refreshData);
      socket.on('RESERVATION_CANCELLED', refreshData);
      socket.on('RESERVATION_EXPIRED', refreshData);
      socket.on('RESOURCE_OCCUPIED', refreshData);
      socket.on('RESOURCE_RELEASED', refreshData);
      socket.on('SESSION_EXTENDED', refreshData);
      socket.on('RESOURCE_UPDATED', refreshData);

      return () => {
        socket.off('RESERVATION_CREATED');
        socket.off('RESERVATION_CANCELLED');
        socket.off('RESERVATION_EXPIRED');
        socket.off('RESOURCE_OCCUPIED');
        socket.off('RESOURCE_RELEASED');
        socket.off('SESSION_EXTENDED');
        socket.off('RESOURCE_UPDATED');
      };
    }
  }, [currentUser]);

  const handleLogout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch (e) {
      // Ignore
    }
    setAuthToken(null);
    setCurrentUser(null);
    setStudentProfile(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Login
        onLoginSuccess={(user, student) => {
          setCurrentUser(user);
          setStudentProfile(student);
          if (user.role === 'LIBRARIAN') setActiveTab('frontdesk');
          else if (user.role === 'ADMIN') setActiveTab('admin');
          else setActiveTab('seats');
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Navigation Header */}
      <header className="border-b border-slate-800/80 bg-slate-900/60 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
              <Library className="h-5 w-5" />
            </div>
            <div>
              <h1 className="font-bold text-white text-base leading-none">SmartLib</h1>
              <span className="text-[11px] text-slate-400">Campus Seat & Occupancy Engine</span>
            </div>
          </div>

          {/* Navigation Tabs */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-950/80 p-1 rounded-xl border border-slate-800 text-xs">
            {currentUser.role === 'STUDENT' && (
              <>
                <button
                  onClick={() => setActiveTab('seats')}
                  className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'seats' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Armchair className="h-3.5 w-3.5" /> Seat Map
                </button>
                <button
                  onClick={() => setActiveTab('rooms')}
                  className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'rooms' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <DoorOpen className="h-3.5 w-3.5" /> Study & Meeting Rooms
                </button>
                <button
                  onClick={() => setActiveTab('reservations')}
                  className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 cursor-pointer ${
                    activeTab === 'reservations' ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <CalendarDays className="h-3.5 w-3.5" /> My Bookings
                </button>
              </>
            )}

            {(currentUser.role === 'LIBRARIAN' || currentUser.role === 'ADMIN') && (
              <button
                onClick={() => setActiveTab('frontdesk')}
                className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'frontdesk' ? 'bg-amber-600 text-slate-950 font-bold shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <UserCheck className="h-3.5 w-3.5" /> Front Desk Check-In
              </button>
            )}

            {currentUser.role === 'ADMIN' && (
              <button
                onClick={() => setActiveTab('admin')}
                className={`px-3.5 py-1.5 rounded-lg transition font-medium flex items-center gap-1.5 cursor-pointer ${
                  activeTab === 'admin' ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-white'
                }`}
              >
                <Shield className="h-3.5 w-3.5" /> Admin Control
              </button>
            )}
          </nav>

          {/* User Profile & Logout */}
          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <span className="text-xs font-bold text-white block leading-tight">{currentUser.name}</span>
              <span className="text-[10px] text-blue-400 font-mono">
                {currentUser.role} {studentProfile ? `• ${studentProfile.registration_number}` : ''}
              </span>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Real-time Occupancy Metrics Bar */}
        {occupancyStats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Total Usable</span>
              <div className="text-xl font-black text-white mt-0.5">{occupancyStats.total}</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[11px] font-semibold text-emerald-400 uppercase tracking-wider">Available</span>
              <div className="text-xl font-black text-emerald-400 mt-0.5">{occupancyStats.available}</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[11px] font-semibold text-amber-400 uppercase tracking-wider">Reserved</span>
              <div className="text-xl font-black text-amber-400 mt-0.5">{occupancyStats.reserved}</div>
            </div>
            <div className="bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[11px] font-semibold text-rose-400 uppercase tracking-wider">Occupied</span>
              <div className="text-xl font-black text-rose-400 mt-0.5">{occupancyStats.occupied}</div>
            </div>
            <div className="col-span-2 sm:col-span-1 bg-slate-900/80 border border-slate-800 p-3.5 rounded-2xl">
              <span className="text-[11px] font-semibold text-blue-400 uppercase tracking-wider">Occupancy Rate</span>
              <div className="text-xl font-black text-blue-400 mt-0.5">{occupancyStats.occupancyPercentage}%</div>
            </div>
          </div>
        )}

        {/* Active Session Component for Students */}
        {currentUser.role === 'STUDENT' && (
          <CurrentSessionView onSessionChange={refreshData} />
        )}

        {/* Tab 1: Seats with Floor Selection */}
        {activeTab === 'seats' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Layers className="h-5 w-5 text-slate-400" />
                <span className="text-sm font-semibold text-slate-300">Select Floor:</span>
                <div className="flex gap-1.5 ml-2">
                  <button
                    onClick={() => setSelectedFloor(1)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedFloor === 1 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Floor 1 (32 Seats)
                  </button>
                  <button
                    onClick={() => setSelectedFloor(2)}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition cursor-pointer ${
                      selectedFloor === 2 ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white'
                    }`}
                  >
                    Floor 2 (18 Seats)
                  </button>
                </div>
              </div>
            </div>

            <SeatMap
              resources={resources}
              selectedFloor={selectedFloor}
              onReservationSuccess={refreshData}
            />
          </div>
        )}

        {/* Tab 2: Rooms */}
        {activeTab === 'rooms' && (
          <RoomBooking resources={resources} onReservationSuccess={refreshData} />
        )}

        {/* Tab 3: My Reservations */}
        {activeTab === 'reservations' && (
          <MyReservationsList reservations={myReservations} onRefresh={refreshData} />
        )}

        {/* Tab 4: Front Desk */}
        {activeTab === 'frontdesk' && <FrontDeskCheckIn />}

        {/* Tab 5: Admin Center */}
        {activeTab === 'admin' && (
          <AdminDashboard resources={resources} onRefreshResources={refreshData} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-900 bg-slate-950 py-6 text-center text-xs text-slate-500">
        <p>SmartLib Seat & Occupancy System • Concurrency-Protected Transactions • Socket.IO Real-time Sync</p>
      </footer>
    </div>
  );
}
export default App;
