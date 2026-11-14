import { pool } from '../db/pool.js';
export async function logAuditEvent(userId, action, entityType, entityId, details = null, ipAddress = null) {
    try {
        await pool.query(`INSERT INTO audit_logs (user_id, action, entity_type, entity_id, details, ip_address)
       VALUES (?, ?, ?, ?, ?, ?)`, [userId, action, entityType, entityId, details ? JSON.stringify(details) : null, ipAddress]);
    }
    catch (error) {
        console.error('Failed to log audit event:', error);
    }
}
