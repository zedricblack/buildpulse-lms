import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import { db } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'buildpulse-construction-lms-super-secret-key-2026';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, email: user.email, fullName: user.fullName, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export function verifyToken(token: string): AuthUser | null {
  try {
    return jwt.verify(token, JWT_SECRET) as AuthUser;
  } catch {
    return null;
  }
}

export function requireAuth(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Authentication token is required.' });
  }

  const token = authHeader.split(' ')[1];
  const user = verifyToken(token);
  if (!user) {
    return res.status(401).json({ error: 'Unauthorized: Invalid or expired session token.' });
  }

  // Verify user still exists and is active in database
  const dbUser = db.prepare('SELECT id, email, full_name, role, account_status FROM users WHERE id = ?').get(user.id) as {
    id: string;
    email: string;
    full_name: string;
    role: 'admin' | 'user';
    account_status: string;
  } | undefined;

  if (!dbUser || dbUser.account_status !== 'active') {
    return res.status(403).json({ error: 'Forbidden: Account has been deactivated or does not exist.' });
  }

  req.user = {
    id: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.full_name,
    role: dbUser.role
  };

  next();
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  }
  next();
}

export function requirePermission(moduleKey: string, action: 'view' | 'create' | 'edit' | 'delete') {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    // Admins bypass module permission restrictions
    if (req.user.role === 'admin') {
      return next();
    }

    const actionColumnMap = {
      view: 'can_view',
      create: 'can_create',
      edit: 'can_edit',
      delete: 'can_delete'
    };

    const col = actionColumnMap[action];
    const perm = db.prepare(`
      SELECT ${col} as allowed FROM user_module_permissions
      WHERE user_id = ? AND module_key = ?
    `).get(req.user.id, moduleKey) as { allowed: number } | undefined;

    if (!perm || perm.allowed !== 1) {
      return res.status(403).json({
        error: `Forbidden: You do not have permission to ${action} records in the ${moduleKey} module.`
      });
    }

    next();
  };
}

export function logAudit(
  req: AuthenticatedRequest,
  action: string,
  module: string,
  recordId: string | null,
  details: string
) {
  try {
    const userId = req.user?.id || 'system';
    const userName = req.user?.fullName || 'System Event';
    const now = new Date().toISOString();
    const id = `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    db.prepare(`
      INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, userId, userName, action, module, recordId, details, now);
  } catch (err) {
    console.error('Failed to write audit log:', err);
  }
}
