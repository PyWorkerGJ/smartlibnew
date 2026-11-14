import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { ReservationService } from '../services/reservationService.js';
import { SessionService } from '../services/sessionService.js';
import { pool } from '../db/pool.js';

const createReservationSchema = z.object({
  resourceId: z.number().int().positive(),
  startTime: z.string(),
  endTime: z.string()
});

export class ReservationController {
  /**
   * Create a reservation
   */
  static async create(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.student) {
        return res.status(403).json({ error: 'Only registered students can reserve library resources.' });
      }

      const { resourceId, startTime, endTime } = createReservationSchema.parse(req.body);

      const reservation = await ReservationService.createReservation({
        studentId: req.student.id,
        resourceId,
        startTime,
        endTime,
        userId: req.user!.id,
        ipAddress: req.ip
      });

      return res.status(201).json(reservation);
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (err as any).issues || (err as any).errors });
      }
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Create reservation error:', err);
      return res.status(500).json({ error: 'Internal server error while creating reservation.' });
    }
  }

  /**
   * Get student reservations (current, upcoming, history)
   */
  static async getMyReservations(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.student) {
        return res.status(403).json({ error: 'Only students have student reservations.' });
      }

      const [rows]: any = await pool.query(
        `SELECT r.*, res.name as resource_name, res.type as resource_type,
                res.floor, res.zone, res.identifier,
                s.id as session_id, s.status as session_status, s.check_in_time,
                s.scheduled_end_time, s.actual_end_time
         FROM reservations r
         JOIN resources res ON r.resource_id = res.id
         LEFT JOIN sessions s ON s.reservation_id = r.id
         WHERE r.student_id = ?
         ORDER BY r.start_time DESC`,
        [req.student.id]
      );

      return res.json(rows);
    } catch (err) {
      console.error('Get my reservations error:', err);
      return res.status(500).json({ error: 'Failed to fetch reservations.' });
    }
  }

  /**
   * Cancel reservation
   */
  static async cancel(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.student) {
        return res.status(403).json({ error: 'Unauthorized.' });
      }

      const reservationId = parseInt(String(req.params.id), 10);
      const result = await ReservationService.cancelReservation(
        reservationId,
        req.student.id,
        req.user!.id,
        req.ip
      );

      return res.json(result);
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Cancel reservation error:', err);
      return res.status(500).json({ error: 'Failed to cancel reservation.' });
    }
  }

  /**
   * Get active session
   */
  static async getActiveSession(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.student) {
        return res.status(403).json({ error: 'Only students have active sessions.' });
      }

      const session = await SessionService.getStudentActiveSession(req.student.id);
      return res.json(session);
    } catch (err) {
      console.error('Get active session error:', err);
      return res.status(500).json({ error: 'Failed to retrieve active session.' });
    }
  }

  /**
   * Extend active session
   */
  static async extendSession(req: AuthenticatedRequest, res: Response) {
    try {
      if (!req.student) {
        return res.status(403).json({ error: 'Only students can extend their session.' });
      }

      const sessionId = parseInt(String(req.params.sessionId), 10);
      const minutes = parseInt(req.body.minutes || '30', 10);

      const result = await SessionService.extendSession(
        sessionId,
        minutes,
        req.student.id,
        req.user!.id,
        req.ip
      );

      return res.json(result);
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Extend session error:', err);
      return res.status(500).json({ error: 'Failed to extend session.' });
    }
  }

  /**
   * Manual release by student
   */
  static async releaseSession(req: AuthenticatedRequest, res: Response) {
    try {
      const sessionId = parseInt(String(req.params.sessionId), 10);
      const result = await SessionService.releaseSession(
        sessionId,
        req.user!.id,
        req.user!.role,
        req.student?.id,
        'Manual checkout by student',
        req.ip
      );

      return res.json(result);
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Release session error:', err);
      return res.status(500).json({ error: 'Failed to release session.' });
    }
  }
}

