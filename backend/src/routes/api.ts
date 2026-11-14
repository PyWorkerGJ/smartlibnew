import { Router } from 'express';
import { AuthController } from '../controllers/authController.js';
import { ResourceController } from '../controllers/resourceController.js';
import { ReservationController } from '../controllers/reservationController.js';
import { FrontDeskController } from '../controllers/frontDeskController.js';
import { AdminController } from '../controllers/adminController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
import { pool } from '../db/pool.js';

const router = Router();

// 1. Health check
router.get('/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    return res.json({ status: 'ok', timestamp: new Date().toISOString(), database: 'connected' });
  } catch (err) {
    return res.status(500).json({ status: 'error', database: 'disconnected' });
  }
});

// 2. Auth routes
router.post('/auth/login', AuthController.login);
router.post('/auth/logout', authenticate, AuthController.logout);
router.get('/auth/me', authenticate, AuthController.me);

// 3. Public / Student Resources & Occupancy
router.get('/resources', ResourceController.listResources);
router.get('/resources/stats', ResourceController.getOccupancyStats);

// 4. Student Reservations & Sessions
router.post('/reservations', authenticate, ReservationController.create);
router.get('/reservations/my', authenticate, ReservationController.getMyReservations);
router.post('/reservations/:id/cancel', authenticate, ReservationController.cancel);
router.get('/sessions/active', authenticate, ReservationController.getActiveSession);
router.post('/sessions/:sessionId/extend', authenticate, ReservationController.extendSession);
router.post('/sessions/:sessionId/release', authenticate, ReservationController.releaseSession);

// 5. Front Desk Check-in (Librarian & Admin)
router.get('/frontdesk/lookup', authenticate, requireRole('LIBRARIAN', 'ADMIN'), FrontDeskController.lookupStudent);
router.post('/frontdesk/checkin', authenticate, requireRole('LIBRARIAN', 'ADMIN'), FrontDeskController.checkIn);

// 6. Admin Portal
router.get('/admin/reservations', authenticate, requireRole('LIBRARIAN', 'ADMIN'), AdminController.listReservations);
router.post('/admin/sessions/force-release', authenticate, requireRole('LIBRARIAN', 'ADMIN'), AdminController.forceRelease);
router.patch('/admin/resources/:id', authenticate, requireRole('ADMIN'), ResourceController.updateResource);
router.get('/admin/rules', authenticate, requireRole('ADMIN'), AdminController.getRules);
router.post('/admin/rules', authenticate, requireRole('ADMIN'), AdminController.updateRule);
router.get('/admin/analytics', authenticate, requireRole('ADMIN'), AdminController.getAnalytics);
router.get('/admin/audit-logs', authenticate, requireRole('ADMIN'), AdminController.getAuditLogs);

export default router;
