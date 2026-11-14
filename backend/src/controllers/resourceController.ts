import { Request, Response } from 'express';
import { pool } from '../db/pool.js';
import { AuthenticatedRequest } from '../middleware/auth.js';
import { logAuditEvent } from '../services/auditService.js';
import { emitRealtimeEvent } from '../services/socketService.js';

export class ResourceController {
  /**
   * Get all resources with current real-time occupancy status
   * Options: floor, zone, type, status, and interval [startTime, endTime)
   */
  static async listResources(req: Request, res: Response) {
    try {
      const { type, floor, zone, startTime, endTime } = req.query;

      let sql = `
        SELECT r.* 
        FROM resources r
        WHERE r.status != 'DISABLED'
      `;
      const params: any[] = [];

      if (type) {
        sql += ` AND r.type = ?`;
        params.push(type);
      }
      if (floor) {
        sql += ` AND r.floor = ?`;
        params.push(parseInt(floor as string, 10));
      }
      if (zone) {
        sql += ` AND r.zone = ?`;
        params.push(zone);
      }

      sql += ` ORDER BY r.floor ASC, r.layout_row ASC, r.layout_col ASC, r.identifier ASC`;

      const [resources]: any = await pool.query(sql, params);

      // Determine occupancy status for the requested window or right now
      const windowStart = startTime ? (startTime as string) : new Date().toISOString();
      const windowEnd = endTime ? (endTime as string) : new Date(Date.now() + 60 * 60 * 1000).toISOString();

      // Fetch all reservations intersecting [windowStart, windowEnd)
      const [resRows]: any = await pool.query(
        `SELECT r.resource_id, r.id as reservation_id, r.status as reservation_status,
                r.start_time, r.end_time, s.id as session_id, s.status as session_status,
                u.name as student_name, st.registration_number
         FROM reservations r
         LEFT JOIN sessions s ON s.reservation_id = r.id AND s.status = 'ACTIVE'
         JOIN students st ON r.student_id = st.id
         JOIN users u ON st.user_id = u.id
         WHERE r.status IN ('PENDING', 'CHECKED_IN')
           AND r.start_time < ? 
           AND r.end_time > ?`,
        [windowEnd, windowStart]
      );

      const reservationMap = new Map<number, any>();
      for (const row of resRows) {
        reservationMap.set(row.resource_id, row);
      }

      const formatted = resources.map((r: any) => {
        let computedStatus = r.status; // 'AVAILABLE' or 'MAINTENANCE'

        if (r.status === 'AVAILABLE') {
          const activeRes = reservationMap.get(r.id);
          if (activeRes) {
            if (activeRes.session_status === 'ACTIVE' || activeRes.reservation_status === 'CHECKED_IN') {
              computedStatus = 'OCCUPIED';
            } else {
              computedStatus = 'RESERVED';
            }
          }
        }

        return {
          ...r,
          amenities: typeof r.amenities === 'string' ? JSON.parse(r.amenities) : r.amenities,
          currentStatus: computedStatus,
          activeReservation: reservationMap.get(r.id) || null
        };
      });

      return res.json(formatted);
    } catch (err) {
      console.error('List resources error:', err);
      return res.status(500).json({ error: 'Failed to load resources.' });
    }
  }

  /**
   * Get occupancy statistics (Total, Available, Reserved, Occupied, Maintenance, by floor)
   */
  static async getOccupancyStats(req: Request, res: Response) {
    try {
      const [totalUsable]: any = await pool.query(
        "SELECT COUNT(*) as count FROM resources WHERE status != 'DISABLED'"
      );
      const [maintenance]: any = await pool.query(
        "SELECT COUNT(*) as count FROM resources WHERE status = 'MAINTENANCE'"
      );
      const [activeSessions]: any = await pool.query(
        "SELECT COUNT(*) as count FROM sessions WHERE status = 'ACTIVE'"
      );
      const [pendingReservations]: any = await pool.query(
        `SELECT COUNT(DISTINCT resource_id) as count 
         FROM reservations 
         WHERE status = 'PENDING' AND start_time <= NOW() AND end_time > NOW()`
      );

      const total = totalUsable[0].count;
      const occupied = activeSessions[0].count;
      const reserved = pendingReservations[0].count;
      const inMaintenance = maintenance[0].count;
      const available = Math.max(0, total - occupied - reserved - inMaintenance);
      const occupancyPercentage = total > 0 ? Math.round(((occupied + reserved) / total) * 100) : 0;

      // Floor-wise breakdown
      const [floorStats]: any = await pool.query(
        `SELECT floor, COUNT(*) as total_seats,
                SUM(CASE WHEN status = 'MAINTENANCE' THEN 1 ELSE 0 END) as maintenance_seats
         FROM resources
         WHERE status != 'DISABLED'
         GROUP BY floor
         ORDER BY floor ASC`
      );

      return res.json({
        total,
        available,
        reserved,
        occupied,
        maintenance: inMaintenance,
        occupancyPercentage,
        floors: floorStats
      });
    } catch (err) {
      console.error('Get occupancy stats error:', err);
      return res.status(500).json({ error: 'Failed to load occupancy statistics.' });
    }
  }

  /**
   * Admin: Update resource status or details
   */
  static async updateResource(req: AuthenticatedRequest, res: Response) {
    try {
      const { id } = req.params;
      const { status, name, zone, floor, amenities, capacity } = req.body;

      const [existing]: any = await pool.query('SELECT * FROM resources WHERE id = ?', [id]);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Resource not found.' });
      }

      await pool.query(
        `UPDATE resources 
         SET status = COALESCE(?, status),
             name = COALESCE(?, name),
             zone = COALESCE(?, zone),
             floor = COALESCE(?, floor),
             amenities = COALESCE(?, amenities),
             capacity = COALESCE(?, capacity)
         WHERE id = ?`,
        [
          status,
          name,
          zone,
          floor,
          amenities ? JSON.stringify(amenities) : null,
          capacity,
          id
        ]
      );

      await logAuditEvent(
        req.user?.id || null,
        'UPDATE_RESOURCE',
        'RESOURCE',
        parseInt(String(id), 10),
        { status, name, zone, floor },
        req.ip
      );

      emitRealtimeEvent('RESOURCE_UPDATED', { id: parseInt(String(id), 10), status });

      return res.json({ success: true, message: 'Resource updated successfully.' });
    } catch (err) {
      console.error('Update resource error:', err);
      return res.status(500).json({ error: 'Failed to update resource.' });
    }
  }
}

