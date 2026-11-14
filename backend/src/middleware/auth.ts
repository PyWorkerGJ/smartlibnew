import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config/index.js';
import { pool } from '../db/pool.js';
import { User, StudentProfile } from '../types/index.js';

export interface AuthenticatedRequest extends Request {
  user?: User;
  student?: StudentProfile;
}

export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') 
    ? authHeader.substring(7) 
    : req.cookies?.token;

  if (!token) {
    return res.status(401).json({ error: 'Authentication required. No token provided.' });
  }

  try {
    const payload = jwt.verify(token, config.jwtSecret) as { id: number; role: string };
    
    // Fetch full user record
    pool.query('SELECT id, email, name, role, created_at FROM users WHERE id = ?', [payload.id])
      .then(async ([rows]: any) => {
        if (!rows || rows.length === 0) {
          return res.status(401).json({ error: 'User account not found.' });
        }
        req.user = rows[0] as User;

        if (req.user.role === 'STUDENT') {
          const [sRows]: any = await pool.query(
            'SELECT s.*, u.name, u.email FROM students s JOIN users u ON s.user_id = u.id WHERE s.user_id = ?', 
            [req.user.id]
          );
          if (sRows.length > 0) {
            req.student = sRows[0] as StudentProfile;
          }
        }
        next();
      })
      .catch((err) => {
        console.error('Error fetching user during auth:', err);
        res.status(500).json({ error: 'Internal server authentication error' });
      });
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token.' });
  }
}

export function requireRole(...roles: string[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: `Forbidden. Requires one of roles: [${roles.join(', ')}]` });
    }
    next();
  };
}
