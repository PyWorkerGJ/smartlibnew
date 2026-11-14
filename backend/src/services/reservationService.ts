import { pool, withTransaction } from '../db/pool.js';
import { getRuleNumber } from './rulesService.js';
import { logAuditEvent } from './auditService.js';
import { emitRealtimeEvent } from './socketService.js';

export interface CreateReservationParams {
  studentId: number;
  resourceId: number;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  userId: number;
  ipAddress?: string;
}

export class ReservationService {
  static async checkAvailability(
    resourceId: number,
    startTime: string,
    endTime: string,
    excludeReservationId?: number
  ): Promise<boolean> {
    const startIso = new Date(startTime).toISOString().slice(0, 19).replace('T', ' ');
    const endIso = new Date(endTime).toISOString().slice(0, 19).replace('T', ' ');

    let sql = `
      SELECT id FROM reservations 
      WHERE resource_id = ? 
        AND status IN ('PENDING', 'CHECKED_IN')
        AND start_time < ? 
        AND end_time > ?
    `;
    const params: any[] = [resourceId, endIso, startIso];
    if (excludeReservationId) {
      sql += ` AND id != ?`;
      params.push(excludeReservationId);
    }

    const [rows]: any = await pool.query(sql, params);
    return rows.length === 0;
  }

  static async createReservation(params: CreateReservationParams) {
    const { studentId, resourceId, startTime, endTime, userId, ipAddress } = params;

    const start = new Date(startTime);
    const end = new Date(endTime);
    const now = new Date();

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      throw { status: 400, message: 'Invalid start or end datetime format.' };
    }

    // Allow small 5-minute buffer for client clock skew
    if (start.getTime() < now.getTime() - 5 * 60 * 1000) {
      throw { status: 400, message: 'Reservation cannot start in the past.' };
    }

    if (end <= start) {
      throw { status: 400, message: 'End time must be strictly after start time.' };
    }

    const durationMinutes = Math.round((end.getTime() - start.getTime()) / (60 * 1000));
    const advanceDays = await getRuleNumber('advance_booking_days', 3);
    const maxAdvanceMs = advanceDays * 24 * 60 * 60 * 1000;
    if (start.getTime() - now.getTime() > maxAdvanceMs) {
      throw { status: 400, message: `Reservations can only be made up to ${advanceDays} days in advance.` };
    }

    // Store in consistent UTC formatted SQL datetime
    const startSql = start.toISOString().slice(0, 19).replace('T', ' ');
    const endSql = end.toISOString().slice(0, 19).replace('T', ' ');

    return await withTransaction(async (conn) => {
      // 1. Lock resource
      const [rRows]: any = await conn.query(
        'SELECT id, type, name, status FROM resources WHERE id = ? FOR UPDATE',
        [resourceId]
      );

      if (rRows.length === 0) {
        throw { status: 404, message: 'Selected resource does not exist.' };
      }
      const resource = rRows[0];

      if (resource.status !== 'AVAILABLE') {
        throw { status: 400, message: `Resource is currently ${resource.status.toLowerCase()} and cannot be booked.` };
      }

      // 2. Validate max duration per resource type
      if (resource.type === 'SEAT') {
        const maxSeatDuration = await getRuleNumber('max_seat_duration_minutes', 180);
        if (durationMinutes > maxSeatDuration) {
          throw { status: 400, message: `Seat reservation exceeds maximum allowed duration of ${maxSeatDuration} minutes.` };
        }
      } else {
        const maxRoomDuration = await getRuleNumber('max_room_duration_minutes', 120);
        if (durationMinutes > maxRoomDuration) {
          throw { status: 400, message: `Room reservation exceeds maximum allowed duration of ${maxRoomDuration} minutes.` };
        }
      }

      // 3. Check active/pending reservation limits for student
      const maxActiveKey = resource.type === 'SEAT' ? 'max_active_seat_reservations' : 'max_active_room_reservations';
      const maxActive = await getRuleNumber(maxActiveKey, 1);

      const [countRows]: any = await conn.query(
        `SELECT COUNT(*) as count 
         FROM reservations r
         JOIN resources res ON r.resource_id = res.id
         WHERE r.student_id = ? 
           AND res.type = ?
           AND r.status IN ('PENDING', 'CHECKED_IN')
           AND r.end_time > UTC_TIMESTAMP()`,
        [studentId, resource.type]
      );

      if (countRows[0].count >= maxActive) {
        throw { status: 400, message: `You have reached the maximum allowed active ${resource.type.toLowerCase().replace('_', ' ')} reservations (${maxActive}).` };
      }

      // 4. Overlap check with locking
      const [conflicts]: any = await conn.query(
        `SELECT id, start_time, end_time FROM reservations 
         WHERE resource_id = ? 
           AND status IN ('PENDING', 'CHECKED_IN')
           AND start_time < ? 
           AND end_time > ? 
         FOR UPDATE`,
        [resourceId, endSql, startSql]
      );

      if (conflicts.length > 0) {
        throw { 
          status: 409, 
          message: 'The requested time slot has just been reserved by another student. Please select an available slot.' 
        };
      }

      // 5. Insert reservation
      const [resResult]: any = await conn.execute(
        `INSERT INTO reservations (student_id, resource_id, start_time, end_time, status)
         VALUES (?, ?, ?, ?, 'PENDING')`,
        [studentId, resourceId, startSql, endSql]
      );

      const reservationId = resResult.insertId;

      await logAuditEvent(
        userId,
        'CREATE_RESERVATION',
        'RESERVATION',
        reservationId,
        { resourceId, startTime: startSql, endTime: endSql, resourceType: resource.type, resourceName: resource.name },
        ipAddress
      );

      emitRealtimeEvent('RESERVATION_CREATED', {
        reservationId,
        resourceId,
        startTime: startSql,
        endTime: endSql
      });

      return {
        id: reservationId,
        studentId,
        resourceId,
        startTime: startSql,
        endTime: endSql,
        status: 'PENDING',
        resourceName: resource.name,
        resourceType: resource.type
      };
    });
  }

  static async cancelReservation(reservationId: number, studentId: number, userId: number, ipAddress?: string) {
    return await withTransaction(async (conn) => {
      const [rows]: any = await conn.query(
        'SELECT * FROM reservations WHERE id = ? FOR UPDATE',
        [reservationId]
      );

      if (rows.length === 0) {
        throw { status: 404, message: 'Reservation not found.' };
      }

      const res = rows[0];
      if (res.student_id !== studentId) {
        throw { status: 403, message: 'Access denied. You do not own this reservation.' };
      }

      if (res.status !== 'PENDING') {
        throw { status: 400, message: `Cannot cancel reservation in '${res.status}' status.` };
      }

      await conn.execute(
        `UPDATE reservations 
         SET status = 'CANCELLED', cancelled_at = UTC_TIMESTAMP() 
         WHERE id = ?`,
        [reservationId]
      );

      await logAuditEvent(
        userId,
        'CANCEL_RESERVATION',
        'RESERVATION',
        reservationId,
        { resourceId: res.resource_id },
        ipAddress
      );

      emitRealtimeEvent('RESERVATION_CANCELLED', {
        reservationId,
        resourceId: res.resource_id
      });

      return { success: true, message: 'Reservation successfully cancelled.' };
    });
  }
}
