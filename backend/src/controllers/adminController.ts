import { Response } from 'express';
import { pool } from '../db/pool.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { SessionService } from '../services/sessionService.js';
import { logAuditEvent } from '../services/auditService.js';

export class AdminController {
  /**
   * List all reservations with filters
   */
  static async listReservations(req: AuthenticatedRequest, res: Response) {
    try {
      const { status, type, reg, date } = req.query;

      let sql = `
        SELECT r.*, res.name as resource_name, res.type as resource_type,
               res.floor, res.zone, res.identifier,
               st.registration_number, u.name as student_name, u.email as student_email,
               s.id as session_id, s.status as session_status, s.check_in_time,
               s.scheduled_end_time, s.actual_end_time, s.release_reason
        FROM reservations r
        JOIN resources res ON r.resource_id = res.id
        JOIN students st ON r.student_id = st.id
        JOIN users u ON st.user_id = u.id
        LEFT JOIN sessions s ON s.reservation_id = r.id
        WHERE 1=1
      `;
      const params: any[] = [];

      if (status) {
        sql += ` AND r.status = ?`;
        params.push(status);
      }
      if (type) {
        sql += ` AND res.type = ?`;
        params.push(type);
      }
      if (reg) {
        sql += ` AND st.registration_number LIKE ?`;
        params.push(`%${reg}%`);
      }
      if (date) {
        sql += ` AND DATE(r.start_time) = ?`;
        params.push(date);
      }

      sql += ` ORDER BY r.created_at DESC LIMIT 200`;

      const [rows]: any = await pool.query(sql, params);
      return res.json(rows);
    } catch (err) {
      console.error('Admin list reservations error:', err);
      return res.status(500).json({ error: 'Failed to retrieve reservations.' });
    }
  }

  /**
   * Force release an active session
   */
  static async forceRelease(req: AuthenticatedRequest, res: Response) {
    try {
      const { sessionId, reason } = req.body;
      if (!sessionId) {
        return res.status(400).json({ error: 'Session ID is required.' });
      }

      const result = await SessionService.releaseSession(
        parseInt(sessionId, 10),
        req.user!.id,
        req.user!.role,
        undefined,
        reason || 'Administrative force release',
        req.ip
      );

      return res.json(result);
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({ error: err.message });
      }
      console.error('Admin force release error:', err);
      return res.status(500).json({ error: 'Failed to force release session.' });
    }
  }

  /**
   * Get and update booking rules
   */
  static async getRules(req: AuthenticatedRequest, res: Response) {
    try {
      const [rows]: any = await pool.query('SELECT * FROM booking_rules ORDER BY id ASC');
      return res.json(rows);
    } catch (err) {
      console.error('Get booking rules error:', err);
      return res.status(500).json({ error: 'Failed to retrieve booking rules.' });
    }
  }

  static async updateRule(req: AuthenticatedRequest, res: Response) {
    try {
      const { rule_key, rule_value } = req.body;
      if (!rule_key || rule_value === undefined) {
        return res.status(400).json({ error: 'rule_key and rule_value are required.' });
      }

      await pool.query(
        'UPDATE booking_rules SET rule_value = ? WHERE rule_key = ?',
        [String(rule_value), rule_key]
      );

      await logAuditEvent(
        req.user!.id,
        'UPDATE_BOOKING_RULE',
        'RULE',
        null,
        { rule_key, rule_value },
        req.ip
      );

      return res.json({ success: true, message: `Rule ${rule_key} updated.` });
    } catch (err) {
      console.error('Update rule error:', err);
      return res.status(500).json({ error: 'Failed to update rule.' });
    }
  }

  /**
   * Real database calculated analytics
   */
  static async getAnalytics(req: AuthenticatedRequest, res: Response) {
    try {
      // 1. Overall counts
      const [totalRes]: any = await pool.query('SELECT COUNT(*) as count FROM reservations');
      const [completedRes]: any = await pool.query("SELECT COUNT(*) as count FROM reservations WHERE status = 'COMPLETED'");
      const [cancelledRes]: any = await pool.query("SELECT COUNT(*) as count FROM reservations WHERE status = 'CANCELLED'");
      const [expiredRes]: any = await pool.query("SELECT COUNT(*) as count FROM reservations WHERE status = 'EXPIRED'");
      const [activeRes]: any = await pool.query("SELECT COUNT(*) as count FROM sessions WHERE status = 'ACTIVE'");

      const total = totalRes[0].count;
      const expired = expiredRes[0].count;
      const completed = completedRes[0].count;
      const cancelled = cancelledRes[0].count;
      const noShowRate = total > 0 ? ((expired / total) * 100).toFixed(1) : '0.0';

      // 2. Resource type utilization
      const [typeUsage]: any = await pool.query(
        `SELECT res.type, COUNT(r.id) as total_bookings
         FROM resources res
         LEFT JOIN reservations r ON r.resource_id = res.id
         GROUP BY res.type`
      );

      // 3. Peak booking hours
      const [peakHours]: any = await pool.query(
        `SELECT HOUR(start_time) as hour, COUNT(*) as bookings
         FROM reservations
         GROUP BY HOUR(start_time)
         ORDER BY hour ASC`
      );

      // 4. Floor utilization
      const [floorUsage]: any = await pool.query(
        `SELECT res.floor, COUNT(r.id) as bookings
         FROM resources res
         LEFT JOIN reservations r ON r.resource_id = res.id
         GROUP BY res.floor
         ORDER BY res.floor ASC`
      );

      // 5. Total extension minutes
      const [extRows]: any = await pool.query('SELECT SUM(extended_minutes) as total_ext FROM sessions');

      return res.json({
        summary: {
          totalReservations: total,
          completedReservations: completed,
          cancelledReservations: cancelled,
          noShows: expired,
          noShowRatePercent: noShowRate,
          activeOccupancy: activeRes[0].count,
          totalExtensionMinutesGranted: extRows[0].total_ext || 0
        },
        typeUsage,
        peakHours,
        floorUsage
      });
    } catch (err) {
      console.error('Analytics error:', err);
      return res.status(500).json({ error: 'Failed to calculate analytics.' });
    }
  }

  /**
   * System audit logs
   */
  static async getAuditLogs(req: AuthenticatedRequest, res: Response) {
    try {
      const [rows]: any = await pool.query(
        `SELECT a.*, u.name as user_name, u.email as user_email, u.role as user_role
         FROM audit_logs a
         LEFT JOIN users u ON a.user_id = u.id
         ORDER BY a.created_at DESC
         LIMIT 100`
      );

      const parsed = rows.map((r: any) => ({
        ...r,
        details: typeof r.details === 'string' ? JSON.parse(r.details) : r.details
      }));

      return res.json(parsed);
    } catch (err) {
      console.error('Audit logs error:', err);
      return res.status(500).json({ error: 'Failed to fetch audit logs.' });
    }
  }
}
