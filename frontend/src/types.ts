export interface User {
  id: number;
  email: string;
  name: string;
  role: 'STUDENT' | 'LIBRARIAN' | 'ADMIN';
}

export interface StudentProfile {
  id: number;
  user_id: number;
  registration_number: string;
  department: string;
  year_of_study: number;
  phone?: string;
}

export interface Resource {
  id: number;
  type: 'SEAT' | 'STUDY_ROOM' | 'MEETING_ROOM';
  identifier: string;
  name: string;
  floor: number;
  zone: string;
  capacity: number;
  amenities: Record<string, any>;
  layout_row?: number;
  layout_col?: number;
  status: 'AVAILABLE' | 'MAINTENANCE' | 'DISABLED';
  currentStatus: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'MAINTENANCE';
  activeReservation?: any;
}

export interface Reservation {
  id: number;
  student_id: number;
  resource_id: number;
  resource_name: string;
  resource_type: string;
  identifier: string;
  floor: number;
  zone: string;
  start_time: string;
  end_time: string;
  status: 'PENDING' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';
  session_id?: number;
  session_status?: string;
  check_in_time?: string;
  scheduled_end_time?: string;
}

export interface ActiveSession {
  id: number;
  reservation_id: number;
  student_id: number;
  resource_id: number;
  resource_name: string;
  resource_type: string;
  identifier: string;
  floor: number;
  zone: string;
  check_in_time: string;
  scheduled_end_time: string;
  extended_minutes: number;
}
