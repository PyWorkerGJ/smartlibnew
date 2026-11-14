import { pool, withTransaction } from '../db/pool.js';
import { getRuleNumber } from './rulesService.js';
import { logAuditEvent } from './auditService.js';
import { emitRealtimeEvent } from './socketService.js';

function toIstSqlString(d: Date | string): string {
  if (typeof d === 'string' && /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(d)) {
    return d.slice(0, 19);
  }
  const date = typeof d === 'string' ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, '0');
  const istOffset = 5.5 * 60 * 60 * 1000;
  const istDate = new Date(date.getTime() + (date.getTimezoneOffset() * 60 * 1000) + istOffset);
  return `${istDate.getFullYear()}-${pad(istDate.getMonth() + 1)}-${pad(istDate.getDate())} ${pad(istDate.getHours())}:${pad(istDate.getMinutes())}:${pad(istDate.getSeconds())}`;
}

export class SessionService {
  static async checkInByRegNumber(registrationNumber: string, operatorUserId: number, ipAddress?: string) {
    return await withTransaction(async (conn) => {
      // 1. Verify student exists
      const [students]: any = await conn.query(
        `SELECT s.id as student_id, s.registration_number, u.name, u.email
         FROM students s
         JOIN users u ON s.user_id = u.id
         WHERE s.registration_number = ?`,
        [registrationNumber.trim()]
      );

      if (students.length === 0) {
        throw { status: 404, message: `No student found with registration number "${registrationNumber}".` };
      }
      const student = students[0];

      // 2. Find eligible reservation
      // Permitted window: from 15 minutes before start_time up to grace_period_minutes after start_time
      const gracePeriod = await getRuleNumber('grace_period_minutes', 15);

      const [resRows]: any = await conn.query(
        `SELECT r.*, res.name as resource_name, res.type as resource_type, res.identifier
         FROM reservations r
         JOIN resources res ON r.resource_id = res.id
         WHERE r.student_id = ?
           AND r.status = 'PENDING'
           AND r.start_time <= DATE_ADD(NOW(), INTERVAL 15 MINUTE)
           AND r.start_time >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
           AND r.end_time > NOW()
         ORDER BY r.start_time ASC
         LIMIT 1
         FOR UPDATE`,
        [student.student_id, gracePeriod]
      );

      if (resRows.length === 0) {
        const [anyRows]: any = await conn.query(
          `SELECT r.*, res.name as resource_name
           FROM reservations r
           JOIN resources res ON r.resource_id = res.id
           WHERE r.student_id = ? AND r.status IN ('PENDING', 'CHECKED_IN')
           ORDER BY r.start_time ASC LIMIT 1`,
          [student.student_id]
        );

        if (anyRows.length > 0) {
          const r = anyRows[0];
          if (r.status === 'CHECKED_IN') {
            throw { status: 400, message: `Student is already checked into ${r.resource_name}.` };
          }
          throw { 
            status: 400, 
            message: `No active check-in window. Found reservation for ${r.resource_name} scheduled at ${r.start_time}. Allowed window is ±15 mins from start time.` 
          };
        }

        throw { status: 404, message: `No eligible pending reservation found for student ${student.name} within the check-in window.` };
      }

      const reservation = resRows[0];

      // 3. Update reservation status
      await conn.execute(
        `UPDATE reservations SET status = 'CHECKED_IN' WHERE id = ?`,
        [reservation.id]
      );

      // 4. Create active session record
      const [sessResult]: any = await conn.execute(
        `INSERT INTO sessions (
          reservation_id, student_id, resource_id, check_in_time, scheduled_end_time, 
          status, checked_in_by_user_id
        ) VALUES (?, ?, ?, NOW(), ?, 'ACTIVE', ?)`,
        [reservation.id, student.student_id, reservation.resource_id, reservation.end_time, operatorUserId]
      );

      const sessionId = sessResult.insertId;

      // 5. Create library check-in audit entry
      await conn.execute(
        `INSERT INTO library_checkins (
          session_id, reservation_id, student_id, registration_number, operator_id, check_in_time
        ) VALUES (?, ?, ?, ?, ?, NOW())`,
        [sessionId, reservation.id, student.student_id, student.registration_number, operatorUserId]
      );


      await logAuditEvent(
        operatorUserId,
        'PHYSICAL_CHECKIN',
        'SESSION',
        sessionId,
        {
          studentId: student.student_id,
          registrationNumber: student.registration_number,
          reservationId: reservation.id,
          resourceId: reservation.resource_id,
          resourceName: reservation.resource_name
        },
        ipAddress
      );

      emitRealtimeEvent('RESOURCE_OCCUPIED', {
        resourceId: reservation.resource_id,
        sessionId,
        reservationId: reservation.id,
        status: 'OCCUPIED'
      });

      return {
        sessionId,
        reservationId: reservation.id,
        studentName: student.name,
        registrationNumber: student.registration_number,
        resourceName: reservation.resource_name,
        resourceType: reservation.resource_type,
        checkInTime: new Date().toISOString(),
        scheduledEndTime: reservation.end_time
      };
    });
  }

  static async releaseSession(
    sessionId: number,
    userId: number,
    userRole: string,
    studentId?: number,
    reason?: string,
    ipAddress?: string
  ) {
    return await withTransaction(async (conn) => {
      const [rows]: any = await conn.query(
        `SELECT s.*, r.student_id as owner_student_id, res.name as resource_name 
         FROM sessions s
         JOIN reservations r ON s.reservation_id = r.id
         JOIN resources res ON s.resource_id = res.id
         WHERE s.id = ? FOR UPDATE`,
        [sessionId]
      );

      if (rows.length === 0) {
        throw { status: 404, message: 'Session not found.' };
      }

      const session = rows[0];

      if (session.status !== 'ACTIVE') {
        throw { status: 400, message: `Session is already in '${session.status}' state.` };
      }

      if (userRole === 'STUDENT') {
        if (!studentId || session.student_id !== studentId) {
          throw { status: 403, message: 'Forbidden. You can only release your own active session.' };
        }
      }

      const releaseStatus = userRole === 'STUDENT' ? 'RELEASED_MANUAL' : 'RELEASED_FORCE';

      await conn.execute(
        `UPDATE sessions 
         SET status = ?, actual_end_time = NOW(), released_by_user_id = ?, release_reason = ?
         WHERE id = ?`,
        [releaseStatus, userId, reason || (userRole === 'STUDENT' ? 'Student checkout' : 'Admin override'), sessionId]
      );

      await conn.execute(
        `UPDATE reservations 
         SET status = 'COMPLETED', end_time = LEAST(end_time, NOW())
         WHERE id = ?`,
        [session.reservation_id]
      );

      await logAuditEvent(
        userId,
        releaseStatus,
        'SESSION',
        sessionId,
        { resourceId: session.resource_id, reason },
        ipAddress
      );

      emitRealtimeEvent('RESOURCE_RELEASED', {
        resourceId: session.resource_id,
        sessionId,
        status: 'AVAILABLE'
      });

      return {
        success: true,
        message: `${session.resource_name} successfully released.`,
        sessionId,
        resourceId: session.resource_id
      };
    });
  }

  static async extendSession(
    sessionId: number,
    extensionMinutes: number,
    studentId: number,
    userId: number,
    ipAddress?: string
  ) {
    if (extensionMinutes <= 0 || extensionMinutes > 60) {
      throw { status: 400, message: 'Extension duration must be between 1 and 60 minutes.' };
    }

    return await withTransaction(async (conn) => {
      const [rows]: any = await conn.query(
        `SELECT s.*, r.start_time, r.end_time as res_end_time, res.name as resource_name, res.type as resource_type
         FROM sessions s
         JOIN reservations r ON s.reservation_id = r.id
         JOIN resources res ON s.resource_id = res.id
         WHERE s.id = ? FOR UPDATE`,
        [sessionId]
      );

      if (rows.length === 0) {
        throw { status: 404, message: 'Session not found.' };
      }

      const session = rows[0];

      if (session.student_id !== studentId) {
        throw { status: 403, message: 'Forbidden. You do not own this session.' };
      }

      if (session.status !== 'ACTIVE') {
        throw { status: 400, message: `Cannot extend session in '${session.status}' state.` };
      }

      const maxExtensionRule = await getRuleNumber('max_extension_minutes', 60);
      const totalExtended = session.extended_minutes + extensionMinutes;
      if (totalExtended > maxExtensionRule) {
        throw { status: 400, message: `Extension limit of ${maxExtensionRule} minutes exceeded.` };
      }

      const currentStart = new Date(session.start_time);
      const currentScheduledEnd = new Date(session.scheduled_end_time);
      const newEndTime = new Date(currentScheduledEnd.getTime() + extensionMinutes * 60 * 1000);

      const maxDuration = session.resource_type === 'SEAT' 
        ? await getRuleNumber('max_seat_duration_minutes', 180)
        : await getRuleNumber('max_room_duration_minutes', 120);

      const totalDuration = Math.round((newEndTime.getTime() - currentStart.getTime()) / (60 * 1000));
      if (totalDuration > maxDuration) {
        throw { status: 400, message: `Extension would exceed maximum total duration of ${maxDuration} minutes.` };
      }

      const newEndSql = toIstSqlString(newEndTime);
      const currentEndSql = toIstSqlString(currentScheduledEnd);

      const [conflicts]: any = await conn.query(
        `SELECT id FROM reservations
         WHERE resource_id = ?
           AND id != ?
           AND status IN ('PENDING', 'CHECKED_IN')
           AND start_time < ?
           AND end_time > ?
         FOR UPDATE`,
        [session.resource_id, session.reservation_id, newEndSql, currentEndSql]
      );

      if (conflicts.length > 0) {
        throw { 
          status: 409, 
          message: 'Cannot extend session: Another student has a reservation immediately following your scheduled slot.' 
        };
      }

      await conn.execute(
        `UPDATE sessions 
         SET scheduled_end_time = ?, extended_minutes = extended_minutes + ?
         WHERE id = ?`,
        [newEndSql, extensionMinutes, sessionId]
      );

      await conn.execute(
        `UPDATE reservations 
         SET end_time = ?
         WHERE id = ?`,
        [newEndSql, session.reservation_id]
      );

      await logAuditEvent(
        userId,
        'EXTEND_SESSION',
        'SESSION',
        sessionId,
        {
          extensionMinutes,
          newEndTime: newEndTime.toISOString(),
          resourceId: session.resource_id
        },
        ipAddress
      );

      emitRealtimeEvent('SESSION_EXTENDED', {
        sessionId,
        resourceId: session.resource_id,
        newEndTime: newEndTime.toISOString()
      });

      return {
        success: true,
        message: `Session successfully extended by ${extensionMinutes} minutes.`,
        sessionId,
        newScheduledEndTime: newEndTime.toISOString(),
        extendedMinutes: totalExtended
      };
    });
  }

  static async getStudentActiveSession(studentId: number) {
    const [rows]: any = await pool.query(
      `SELECT s.*, res.name as resource_name, res.type as resource_type, res.identifier,
              res.floor, res.zone, r.start_time, r.end_time as initial_end_time
       FROM sessions s
       JOIN reservations r ON s.reservation_id = r.id
       JOIN resources res ON s.resource_id = res.id
       WHERE s.student_id = ? AND s.status = 'ACTIVE'
       LIMIT 1`,
      [studentId]
    );

    return rows.length > 0 ? rows[0] : null;
  }
}
