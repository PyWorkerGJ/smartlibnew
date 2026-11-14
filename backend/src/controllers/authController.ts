import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { pool } from '../db/pool.js';
import { config } from '../config/index.js';
import { logAuditEvent } from '../services/auditService.js';
import { AuthenticatedRequest } from '../middleware/auth.js';

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

export class AuthController {
  static async login(req: Request, res: Response) {
    try {
      const { email, password } = loginSchema.parse(req.body);
      const ip = req.ip || req.socket.remoteAddress || 'unknown';

      const [users]: any = await pool.query(
        'SELECT * FROM users WHERE email = ?',
        [email.toLowerCase().trim()]
      );

      if (users.length === 0) {
        await logAuditEvent(null, 'LOGIN_FAILED', 'USER', null, { email, reason: 'User not found' }, ip);
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      const user = users[0];
      const isMatch = await bcrypt.compare(password, user.password_hash);
      if (!isMatch) {
        await logAuditEvent(user.id, 'LOGIN_FAILED', 'USER', user.id, { email, reason: 'Invalid password' }, ip);
        return res.status(401).json({ error: 'Invalid email or password.' });
      }

      // Fetch student profile if applicable
      let student = null;
      if (user.role === 'STUDENT') {
        const [students]: any = await pool.query(
          'SELECT * FROM students WHERE user_id = ?',
          [user.id]
        );
        if (students.length > 0) {
          student = students[0];
        }
      }

      // Generate JWT
      const token = jwt.sign(
        { id: user.id, email: user.email, role: user.role },
        config.jwtSecret,
        { expiresIn: '24h' }
      );

      // Set HTTP-only cookie
      res.cookie('token', token, {
        httpOnly: true,
        secure: config.nodeEnv === 'production',
        sameSite: 'lax',
        maxAge: 24 * 60 * 60 * 1000
      });

      await logAuditEvent(user.id, 'LOGIN_SUCCESS', 'USER', user.id, { role: user.role }, ip);

      return res.json({
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role
        },
        student
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation failed', details: (err as any).issues || (err as any).errors });
      }
      console.error('Login error:', err);
      return res.status(500).json({ error: 'Internal server error during login.' });
    }
  }

  static async logout(req: AuthenticatedRequest, res: Response) {
    if (req.user) {
      await logAuditEvent(req.user.id, 'LOGOUT', 'USER', req.user.id, null, req.ip);
    }
    res.clearCookie('token');
    return res.json({ success: true, message: 'Logged out successfully.' });
  }

  static async me(req: AuthenticatedRequest, res: Response) {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthenticated.' });
    }
    return res.json({
      user: req.user,
      student: req.student || null
    });
  }
}

