import { Request, Response, NextFunction } from 'express';
import { adminAuth } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { users, userModulePermissions, auditLogs } from '../db/schema.ts';
import { eq, and } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'buildpulse-construction-lms-super-secret-key-2026';

export interface AuthUser {
  id: string;
  uid?: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
}

export interface AuthenticatedRequest extends Request {
  user?: AuthUser;
}

export function generateToken(user: AuthUser): string {
  return jwt.sign(
    { id: user.id, uid: user.uid, email: user.email, fullName: user.fullName, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization token.' });
  }

  const token = authHeader.split('Bearer ')[1].trim();

  // 1. Try Firebase Admin token verification first
  try {
    const decodedToken = await adminAuth.verifyIdToken(token);
    const email = decodedToken.email || `${decodedToken.uid}@buildpulse.lms`;
    const name = decodedToken.name || email.split('@')[0];

    // Find or sync user in Cloud SQL
    let dbUser = await db.query.users.findFirst({
      where: eq(users.uid, decodedToken.uid),
    });

    if (!dbUser) {
      // Check if user exists by email
      dbUser = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
      });

      if (dbUser) {
        // Link Firebase UID to existing user
        await db.update(users)
          .set({ uid: decodedToken.uid, lastLoginAt: new Date().toISOString() })
          .where(eq(users.id, dbUser.id));
      } else {
        // First-time Firebase login auto-provision
        const isFirstAdmin = email.includes('admin') || decodedToken.admin === true || email === 'cedieboiebulos@gmail.com';
        const newUserId = `usr_${Date.now()}`;
        const role = isFirstAdmin ? 'admin' : 'user';

        const [created] = await db.insert(users).values({
          id: newUserId,
          uid: decodedToken.uid,
          email: email.toLowerCase(),
          fullName: name,
          role: role,
          accountStatus: 'active',
          createdAt: new Date().toISOString(),
          lastLoginAt: new Date().toISOString()
        }).returning();

        dbUser = created;

        // Populate initial permissions for new user
        const modules = [
          'dashboard', 'workers', 'attendance', 'assignments',
          'activities', 'accomplishments', 'reports', 'users', 'audit', 'settings'
        ];

        for (const m of modules) {
          await db.insert(userModulePermissions).values({
            id: `perm_${dbUser.id}_${m}`,
            userId: dbUser.id,
            moduleKey: m,
            canView: 1,
            canCreate: isFirstAdmin ? 1 : (['attendance', 'assignments', 'accomplishments'].includes(m) ? 1 : 0),
            canEdit: isFirstAdmin ? 1 : (['attendance', 'assignments', 'accomplishments'].includes(m) ? 1 : 0),
            canDelete: isFirstAdmin ? 1 : 0,
          }).onConflictDoNothing();
        }
      }
    }

    if (dbUser.accountStatus !== 'active') {
      return res.status(403).json({ error: 'Forbidden: Account has been deactivated.' });
    }

    req.user = {
      id: dbUser.id,
      uid: dbUser.uid || decodedToken.uid,
      email: dbUser.email,
      fullName: dbUser.fullName,
      role: dbUser.role as 'admin' | 'user'
    };

    return next();
  } catch (firebaseErr) {
    // If Firebase verify fails, fallback to internal session JWT
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as AuthUser;
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, decoded.id),
      });

      if (!dbUser || dbUser.accountStatus !== 'active') {
        return res.status(403).json({ error: 'Forbidden: Account has been deactivated or does not exist.' });
      }

      req.user = {
        id: dbUser.id,
        uid: dbUser.uid || undefined,
        email: dbUser.email,
        fullName: dbUser.fullName,
        role: dbUser.role as 'admin' | 'user'
      };

      return next();
    } catch {
      return res.status(401).json({ error: 'Unauthorized: Invalid authentication credentials.' });
    }
  }
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Administrator privileges required.' });
  }
  next();
}

export function requirePermission(moduleKey: string, action: 'view' | 'create' | 'edit' | 'delete') {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized: Authentication required.' });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    const perm = await db.query.userModulePermissions.findFirst({
      where: and(
        eq(userModulePermissions.userId, req.user.id),
        eq(userModulePermissions.moduleKey, moduleKey)
      ),
    });

    if (!perm) {
      return res.status(403).json({ error: `Forbidden: No permissions found for module ${moduleKey}.` });
    }

    const allowed =
      action === 'view' ? perm.canView :
      action === 'create' ? perm.canCreate :
      action === 'edit' ? perm.canEdit :
      action === 'delete' ? perm.canDelete : 0;

    if (!allowed) {
      return res.status(403).json({
        error: `Forbidden: You do not have permission to ${action} records in the ${moduleKey} module.`
      });
    }

    next();
  };
}

export async function logAudit(
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

    await db.insert(auditLogs).values({
      id,
      userId,
      userName,
      action,
      module,
      recordId,
      details,
      createdAt: now
    });
  } catch (err) {
    console.error('Failed to write audit log to Cloud SQL:', err);
  }
}
