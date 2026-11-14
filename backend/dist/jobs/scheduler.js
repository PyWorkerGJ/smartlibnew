import { withTransaction } from '../db/pool.js';
import { getRuleNumber } from '../services/rulesService.js';
import { logAuditEvent } from '../services/auditService.js';
import { emitRealtimeEvent } from '../services/socketService.js';
export class SchedulerJob {
    static timer = null;
    static isRunning = false;
    static start() {
        console.log('[Scheduler] Background job service started (1-minute interval)');
        this.runCycle();
        this.timer = setInterval(() => {
            this.runCycle();
        }, 60 * 1000);
    }
    static stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
    }
    static async runCycle() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        try {
            await this.expireNoShows();
            await this.autoCompleteElapsedSessions();
        }
        catch (err) {
            console.error('[Scheduler] Error running background maintenance cycle:', err);
        }
        finally {
            this.isRunning = false;
        }
    }
    static async expireNoShows() {
        const graceMinutes = await getRuleNumber('grace_period_minutes', 15);
        await withTransaction(async (conn) => {
            const [expiredRows] = await conn.query(`SELECT r.id, r.resource_id, r.student_id, res.name as resource_name 
         FROM reservations r
         JOIN resources res ON r.resource_id = res.id
         WHERE r.status = 'PENDING'
           AND DATE_ADD(r.start_time, INTERVAL ? MINUTE) < NOW()
         FOR UPDATE`, [graceMinutes]);
            if (expiredRows.length === 0)
                return;
            for (const row of expiredRows) {
                await conn.execute(`UPDATE reservations 
           SET status = 'EXPIRED', expired_at = NOW() 
           WHERE id = ?`, [row.id]);
                await logAuditEvent(null, 'NO_SHOW_EXPIRY', 'RESERVATION', row.id, { resourceId: row.resource_id, studentId: row.student_id, resourceName: row.resource_name });
                emitRealtimeEvent('RESERVATION_EXPIRED', {
                    reservationId: row.id,
                    resourceId: row.resource_id
                });
            }
            console.log(`[Scheduler] Expired ${expiredRows.length} no-show reservations.`);
        });
    }
    static async autoCompleteElapsedSessions() {
        await withTransaction(async (conn) => {
            const [elapsedRows] = await conn.query(`SELECT s.id, s.reservation_id, s.resource_id, s.student_id, res.name as resource_name
         FROM sessions s
         JOIN resources res ON s.resource_id = res.id
         WHERE s.status = 'ACTIVE'
           AND s.scheduled_end_time <= NOW()
         FOR UPDATE`, []);
            if (elapsedRows.length === 0)
                return;
            for (const row of elapsedRows) {
                await conn.execute(`UPDATE sessions 
           SET status = 'RELEASED_AUTO', actual_end_time = NOW(), release_reason = 'Scheduled duration completed'
           WHERE id = ?`, [row.id]);
                await conn.execute(`UPDATE reservations 
           SET status = 'COMPLETED'
           WHERE id = ?`, [row.reservation_id]);
                await logAuditEvent(null, 'SESSION_AUTO_COMPLETE', 'SESSION', row.id, { resourceId: row.resource_id, studentId: row.student_id, resourceName: row.resource_name });
                emitRealtimeEvent('RESOURCE_RELEASED', {
                    resourceId: row.resource_id,
                    sessionId: row.id,
                    status: 'AVAILABLE'
                });
            }
            console.log(`[Scheduler] Auto-completed ${elapsedRows.length} elapsed sessions.`);
        });
    }
}
