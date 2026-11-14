import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { SessionService } from '../services/sessionService.js';
import { pool } from '../db/pool.js';
import { logAuditEvent } from '../services/auditService.js';

const checkInSchema = z.object({
  registrationNumber: z.string().min(1)
});

export class FrontDeskController {
  /**
   * Check in a student via registration number
   */
  static async checkIn(req: AuthenticatedRequest, res: Response) {
    try {
      const { registrationNumber } = checkInSchema.parse(req.body);

      const result = await SessionService.checkInByRegNumber(
        registrationNumber,
        req.user!.id,
        req.ip
      );

      return res.json({
        success: true,
        message: `Successfully checked in ${result.studentName} to ${result.resourceName}.`,
        data: result
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (err as any).issues || (err as any).errors });
      }
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Front desk check-in error:', err);
      return res.status(500).json({ error: 'Check-in processing error.' });
    }
  }

  /**
   * Preview eligible reservation before confirming check-in
   */
  static async lookupStudent(req: AuthenticatedRequest, res: Response) {
    try {
      const regNumber = req.query.reg as string;
      if (!regNumber) {
        return res.status(400).json({ error: 'Registration number is required.' });
      }

      const [students]: any = await pool.query(
        `SELECT s.id as student_id, s.registration_number, s.department, s.year_of_study,
                u.name, u.email
         FROM students s
         JOIN users u ON s.user_id = u.id
         WHERE s.registration_number = ?`,
        [regNumber.trim()]
      );

      if (students.length === 0) {
        return res.status(404).json({ error: 'Student registration number not found.' });
      }

      const student = students[0];

      const pad = (n: number) => String(n).padStart(2, '0');
      const istOffset = 5.5 * 60 * 60 * 1000;
      const d = new Date();
      const istDate = new Date(d.getTime() + (d.getTimezoneOffset() * 60 * 1000) + istOffset);
      const nowIst = `${istDate.getFullYear()}-${pad(istDate.getMonth() + 1)}-${pad(istDate.getDate())} ${pad(istDate.getHours())}:${pad(istDate.getMinutes())}:${pad(istDate.getSeconds())}`;

      // Fetch pending or active reservations today
      const [reservations]: any = await pool.query(
        `SELECT r.*, res.name as resource_name, res.type as resource_type, res.identifier,
                s.id as session_id, s.status as session_status, s.check_in_time
         FROM reservations r
         JOIN resources res ON r.resource_id = res.id
         LEFT JOIN sessions s ON s.reservation_id = r.id AND s.status = 'ACTIVE'
         WHERE r.student_id = ?
           AND r.status IN ('PENDING', 'CHECKED_IN')
           AND r.end_time > ?
         ORDER BY r.start_time ASC`,
        [student.student_id, nowIst]
      );

      return res.json({
        student,
        reservations
      });
    } catch (err) {
      console.error('Student lookup error:', err);
      return res.status(500).json({ error: 'Error querying student record.' });
    }
  }
}


