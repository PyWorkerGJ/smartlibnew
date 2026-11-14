export type UserRole = 'STUDENT' | 'LIBRARIAN' | 'ADMIN';

export interface User {
  id: number;
  email: string;
  name: string;
  role: UserRole;
  created_at: string;
}

export interface StudentProfile {
  id: number;
  user_id: number;
  registration_number: string;
  department: string;
  year_of_study: number;
  phone?: string;
  name?: string;
  email?: string;
}

export type ResourceType = 'SEAT' | 'STUDY_ROOM' | 'MEETING_ROOM';
export type ResourceStatus = 'AVAILABLE' | 'MAINTENANCE' | 'DISABLED';

export interface Resource {
  id: number;
  type: ResourceType;
  identifier: string;
  name: string;
  floor: number;
  zone: string;
  capacity: number;
  amenities: any;
  layout_row?: number;
  layout_col?: number;
  status: ResourceStatus;
}

export type ReservationStatus = 'PENDING' | 'CHECKED_IN' | 'COMPLETED' | 'CANCELLED' | 'EXPIRED';

export interface Reservation {
  id: number;
  student_id: number;
  resource_id: number;
  start_time: string;
  end_time: string;
  status: ReservationStatus;
  cancelled_at?: string;
  expired_at?: string;
  created_at: string;
}

export type SessionStatus = 'ACTIVE' | 'RELEASED_MANUAL' | 'RELEASED_AUTO' | 'RELEASED_FORCE';

export interface Session {
  id: number;
  reservation_id: number;
  student_id: number;
  resource_id: number;
  check_in_time: string;
  scheduled_end_time: string;
  actual_end_time?: string;
  status: SessionStatus;
  extended_minutes: number;
  checked_in_by_user_id?: number;
  released_by_user_id?: number;
  release_reason?: string;
}
