import express, { Response } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../src/db/index.ts';
import {
  users,
  userModulePermissions,
  workers,
  supervisors,
  workAreas,
  workActivities,
  attendance,
  dailyLaborAssignments,
  dailyAccomplishments,
  accomplishmentParticipants,
  systemSettings,
  auditLogs
} from '../src/db/schema.ts';
import {
  AuthenticatedRequest,
  generateToken,
  requireAuth,
  requireAdmin,
  requirePermission,
  logAudit
} from '../src/middleware/auth.ts';
import { seedDatabase, SAMPLE_DAYS } from '../src/db/seed.ts';
import { eq, and, sql, desc, asc, like, or, inArray, count } from 'drizzle-orm';
import { syncDocToFirestore, deleteDocFromFirestore, syncAllWorkersFromSqlToFirestore, syncAllFromSqlToFirestore } from '../src/lib/firestore-sync.ts';

export const router = express.Router();

// Manual trigger for full Cloud SQL to Firestore synchronization
router.post('/sync/all', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await syncAllFromSqlToFirestore();
    return res.json({ success: true, message: "All modules synchronized with Firestore.", result });
  } catch (err: any) {
    console.error("Manual Firestore sync error:", err);
    return res.status(500).json({ error: "Failed to synchronize with Firestore." });
  }
});


// Helper to get system settings from Cloud SQL
async function getSettings() {
  try {
    const settingRow = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.id, 'global')
    });
    if (settingRow) {
      return settingRow;
    }
  } catch (err) {
    console.warn('Failed to fetch settings, using fallback default:', err);
  }

  return {
    id: 'global',
    standardDailyHours: 8.0,
    normalShiftStartTime: '08:00',
    unpaidBreakDurationMinutes: 60,
    overtimeMultiplier: 1.25,
    halfDayThresholdHours: 4.0,
    currencySymbol: '₱',
    companyName: 'BuildPulse Infrastructure & Engineering Corp.',
    projectName: 'Metro Heights Commercial Complex Phase 2',
    samplePeriodStart: '2026-10-20',
    samplePeriodEnd: '2026-10-24'
  };
}

// Helper to sanitize query string parameters against null/undefined/all/empty string
function cleanQueryParam(val: any): string | null {
  if (val === undefined || val === null) return null;
  const str = String(val).trim();
  if (str === '' || str === 'undefined' || str === 'null' || str === 'all') return null;
  return str;
}

// -----------------------------------------------------------------------------
// 1. AUTHENTICATION ROUTES
// -----------------------------------------------------------------------------
router.post('/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = await db.query.users.findFirst({
      where: eq(users.email, cleanEmail)
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    if (user.accountStatus !== 'active') {
      return res.status(403).json({ error: 'Account has been deactivated. Please contact an administrator.' });
    }

    if (user.passwordHash) {
      const passwordMatch = await bcrypt.compare(password, user.passwordHash);
      if (!passwordMatch) {
        return res.status(401).json({ error: 'Invalid email or password.' });
      }
    }

    const now = new Date().toISOString();
    await db.update(users)
      .set({ lastLoginAt: now })
      .where(eq(users.id, user.id));

    const token = generateToken({
      id: user.id,
      uid: user.uid || undefined,
      email: user.email,
      fullName: user.fullName,
      role: user.role as 'admin' | 'user'
    });

    const permissions = await db.select().from(userModulePermissions).where(eq(userModulePermissions.userId, user.id));

    const authReq: AuthenticatedRequest = req;
    authReq.user = { id: user.id, email: user.email, fullName: user.fullName, role: user.role as 'admin' | 'user' };
    await logAudit(authReq, 'LOGIN', 'Authentication', user.id, `User ${user.email} signed in successfully via Cloud SQL`);

    return res.json({
      token,
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        lastLoginAt: now
      },
      permissions: permissions.map(p => ({
        moduleKey: p.moduleKey,
        canView: Boolean(p.canView),
        canCreate: Boolean(p.canCreate),
        canEdit: Boolean(p.canEdit),
        canDelete: Boolean(p.canDelete)
      }))
    });
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Authentication failed. Please check connection and credentials.' });
  }
});

router.get('/auth/me', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const user = await db.query.users.findFirst({
      where: eq(users.id, req.user!.id)
    });

    if (!user) {
      return res.status(404).json({ error: 'User profile not found in database.' });
    }

    const perms = await db.select().from(userModulePermissions).where(eq(userModulePermissions.userId, user.id));

    return res.json({
      user: {
        id: user.id,
        uid: user.uid,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        lastLoginAt: user.lastLoginAt
      },
      permissions: perms.map(p => ({
        moduleKey: p.moduleKey,
        canView: Boolean(p.canView),
        canCreate: Boolean(p.canCreate),
        canEdit: Boolean(p.canEdit),
        canDelete: Boolean(p.canDelete)
      }))
    });
  } catch (err: any) {
    console.error('Auth verification error:', err);
    return res.status(500).json({ error: 'Failed to verify session profile.' });
  }
});

router.post('/auth/logout', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  await logAudit(req, 'LOGOUT', 'Authentication', req.user!.id, `User ${req.user!.email} logged out`);
  return res.json({ success: true, message: 'Signed out successfully.' });
});

router.post('/auth/reset-password-request', async (req, res) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({ error: 'Email address is required.' });
  }

  const user = await db.query.users.findFirst({
    where: eq(users.email, email.trim().toLowerCase())
  });

  if (user) {
    const authReq: AuthenticatedRequest = req;
    authReq.user = { id: user.id, email: user.email, fullName: 'Self Service', role: 'user' };
    await logAudit(authReq, 'RESET_REQUEST', 'Authentication', user.id, `Password recovery requested for ${email}`);
  }

  return res.json({
    success: true,
    message: 'If the email exists in the system, password reset instructions have been logged to the system audit records for administrator review.'
  });
});

// -----------------------------------------------------------------------------
// 2. USER MANAGEMENT & MODULE PERMISSIONS (Admin only)
// -----------------------------------------------------------------------------
router.get('/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const allUsers = await db.select().from(users).orderBy(asc(users.createdAt));
    const allPerms = await db.select().from(userModulePermissions);

    const permsByUser = new Map<string, any[]>();
    for (const p of allPerms) {
      if (!permsByUser.has(p.userId)) {
        permsByUser.set(p.userId, []);
      }
      permsByUser.get(p.userId)!.push({
        moduleKey: p.moduleKey,
        canView: Boolean(p.canView),
        canCreate: Boolean(p.canCreate),
        canEdit: Boolean(p.canEdit),
        canDelete: Boolean(p.canDelete)
      });
    }

    const result = allUsers.map(u => ({
      id: u.id,
      uid: u.uid,
      email: u.email,
      fullName: u.fullName,
      role: u.role,
      accountStatus: u.accountStatus,
      createdAt: u.createdAt,
      lastLoginAt: u.lastLoginAt,
      permissions: permsByUser.get(u.id) || []
    }));

    return res.json(result);
  } catch (err: any) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ error: 'Failed to retrieve user accounts.' });
  }
});

router.post('/users', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { email, password, fullName, role, permissions } = req.body;
    if (!email || !password || !fullName || !role) {
      return res.status(400).json({ error: 'Full name, email, password, and role are required.' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const existing = await db.query.users.findFirst({
      where: eq(users.email, cleanEmail)
    });
    if (existing) {
      return res.status(400).json({ error: 'A user with this email address already exists.' });
    }

    const hash = await bcrypt.hash(password, 10);
    const userId = `usr_${Date.now()}`;
    const now = new Date().toISOString();

    await db.insert(users).values({
      id: userId,
      email: cleanEmail,
      passwordHash: hash,
      fullName: fullName.trim(),
      role: role,
      accountStatus: 'active',
      createdAt: now
    });

    const modules = [
      'dashboard', 'workers', 'attendance', 'assignments',
      'activities', 'accomplishments', 'reports', 'users', 'audit', 'settings'
    ];

    for (const m of modules) {
      const p = permissions?.[m] || (role === 'admin'
        ? { canView: 1, canCreate: 1, canEdit: 1, canDelete: 1 }
        : { canView: 1, canCreate: 0, canEdit: 0, canDelete: 0 });

      await db.insert(userModulePermissions).values({
        id: `perm_${userId}_${m}`,
        userId,
        moduleKey: m,
        canView: p.canView ? 1 : 0,
        canCreate: p.canCreate ? 1 : 0,
        canEdit: p.canEdit ? 1 : 0,
        canDelete: p.canDelete ? 1 : 0
      });
    }

    // Sync to Firestore
    await syncDocToFirestore('users', userId, {
      id: userId,
      email: cleanEmail,
      fullName: fullName.trim(),
      full_name: fullName.trim(),
      role: role,
      accountStatus: 'active',
      account_status: 'active',
      createdAt: now,
      permissions: (Object.entries(permissions || {}) as [string, any][]).map(([m, p]) => ({
        moduleKey: m,
        canView: Boolean(p.canView),
        canCreate: Boolean(p.canCreate),
        canEdit: Boolean(p.canEdit),
        canDelete: Boolean(p.canDelete)
      }))
    });

    await logAudit(req, 'CREATE', 'User Management', userId, `Created user account: ${fullName} (${email}) as ${role}`);
    return res.status(201).json({ success: true, userId, message: 'User created successfully.' });
  } catch (err: any) {
    console.error('Create user error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create user.' });
  }
});

router.put('/users/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const fullName = req.body.fullName || req.body.full_name;
    const role = req.body.role;
    const email = req.body.email;
    const accountStatus = req.body.accountStatus || req.body.status;
    const permissions = req.body.permissions;

    const user = await db.query.users.findFirst({
      where: eq(users.id, id)
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const updatedRole = role || user.role;
    if (user.role === 'admin' && updatedRole === 'user') {
      const [{ value: adminCount }] = await db.select({ value: count() }).from(users)
        .where(and(eq(users.role, 'admin'), eq(users.accountStatus, 'active')));
      if (Number(adminCount) <= 1) {
        return res.status(400).json({ error: 'Cannot demote the sole active administrator account.' });
      }
    }

    const updatedFullName = fullName !== undefined ? String(fullName).trim() : user.fullName;
    const updatedStatus = accountStatus || user.accountStatus;
    const updatedEmail = email ? String(email).trim().toLowerCase() : user.email;

    await db.update(users)
      .set({
        fullName: updatedFullName,
        role: updatedRole,
        accountStatus: updatedStatus,
        email: updatedEmail
      })
      .where(eq(users.id, id));

    let formattedPerms: any[] = [];
    if (permissions && typeof permissions === 'object') {
      // First cleanly remove prior permissions to ensure no primary key conflict or ON CONFLICT error
      await db.delete(userModulePermissions).where(eq(userModulePermissions.userId, id));
      for (const [m, p] of Object.entries(permissions) as [string, any][]) {
        await db.insert(userModulePermissions).values({
          id: `perm_${id}_${m}`,
          userId: id,
          moduleKey: m,
          canView: p.canView ? 1 : 0,
          canCreate: p.canCreate ? 1 : 0,
          canEdit: p.canEdit ? 1 : 0,
          canDelete: p.canDelete ? 1 : 0
        });
        formattedPerms.push({
          moduleKey: m,
          canView: Boolean(p.canView),
          canCreate: Boolean(p.canCreate),
          canEdit: Boolean(p.canEdit),
          canDelete: Boolean(p.canDelete)
        });
      }
    } else {
      const currentPerms = await db.select().from(userModulePermissions).where(eq(userModulePermissions.userId, id));
      formattedPerms = currentPerms.map(p => ({
        moduleKey: p.moduleKey,
        canView: Boolean(p.canView),
        canCreate: Boolean(p.canCreate),
        canEdit: Boolean(p.canEdit),
        canDelete: Boolean(p.canDelete)
      }));
    }

    // Sync to Firestore
    await syncDocToFirestore('users', id, {
      id,
      email: updatedEmail,
      fullName: updatedFullName,
      full_name: updatedFullName,
      role: updatedRole,
      accountStatus: updatedStatus,
      account_status: updatedStatus,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt || null,
      permissions: formattedPerms
    });

    await logAudit(req, 'UPDATE', 'User Management', id, `Updated user profile and permissions for ${updatedFullName} (${updatedEmail})`);
    return res.json({
      success: true,
      message: 'User updated successfully in Cloud SQL and Firestore.',
      user: {
        id,
        email: updatedEmail,
        fullName: updatedFullName,
        role: updatedRole,
        accountStatus: updatedStatus,
        permissions: formattedPerms
      }
    });
  } catch (err: any) {
    console.error('Update user error:', err);
    return res.status(500).json({ error: 'Failed to update user profile: ' + (err.message || 'Server error') });
  }
});

router.patch('/users/:id/status', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== 'active' && status !== 'inactive') {
      return res.status(400).json({ error: 'Status must be active or inactive.' });
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, id)
    });
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    if (user.id === req.user!.id && status === 'inactive') {
      return res.status(400).json({ error: 'You cannot deactivate your own logged-in account.' });
    }

    await db.update(users).set({ accountStatus: status }).where(eq(users.id, id));
    await syncDocToFirestore('users', id, { id, accountStatus: status, account_status: status });
    await logAudit(req, status === 'active' ? 'ACTIVATE' : 'DEACTIVATE', 'User Management', id, `Changed account status for ${user.email} to ${status}`);

    return res.json({ success: true, message: `User marked as ${status}.` });
  } catch (err: any) {
    console.error('User status update error:', err);
    return res.status(500).json({ error: 'Failed to change user status.' });
  }
});

router.post('/users/:id/reset-password', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const hash = await bcrypt.hash(newPassword, 10);
    await db.update(users).set({ passwordHash: hash }).where(eq(users.id, id));
    await logAudit(req, 'RESET_PASSWORD', 'User Management', id, `Administrator reset password for user ${id}`);

    return res.json({ success: true, message: 'Password has been updated.' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Failed to reset user password.' });
  }
});

// -----------------------------------------------------------------------------
// 3. WORKER MASTER DATA
// -----------------------------------------------------------------------------
router.get('/workers', requireAuth, requirePermission('workers', 'view'), async (req, res) => {
  try {
    const search = cleanQueryParam(req.query.search);
    const trade = cleanQueryParam(req.query.trade);
    const type = cleanQueryParam(req.query.type);
    const status = cleanQueryParam(req.query.status);

    const conditions: any[] = [];
    if (search) {
      const term = `%${search}%`;
      conditions.push(or(like(workers.id, term), like(workers.completeName, term)));
    }
    if (trade) {
      conditions.push(eq(workers.trade, trade));
    }
    if (type) {
      conditions.push(eq(workers.employmentType, type));
    }
    if (status) {
      conditions.push(eq(workers.employmentStatus, status));
    }

    const workerList = await db.select().from(workers)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(asc(workers.id));

    // Map to camelCase for frontend
    const mapped = workerList.map(w => ({
      id: w.id,
      complete_name: w.completeName,
      completeName: w.completeName,
      age: w.age,
      contact_number: w.contactNumber,
      contactNumber: w.contactNumber,
      trade: w.trade,
      employment_type: w.employmentType,
      employmentType: w.employmentType,
      daily_wage_rate: w.dailyWageRate,
      dailyWageRate: w.dailyWageRate,
      employment_status: w.employmentStatus,
      employmentStatus: w.employmentStatus,
      date_hired: w.dateHired,
      dateHired: w.dateHired,
      created_at: w.createdAt
    }));

    return res.json(mapped);
  } catch (err: any) {
    console.error('Error fetching workers:', err);
    return res.status(500).json({ error: 'Failed to retrieve workers from Cloud SQL database.' });
  }
});

router.get('/workers/:id', requireAuth, requirePermission('workers', 'view'), async (req, res) => {
  try {
    const worker = await db.query.workers.findFirst({
      where: eq(workers.id, req.params.id)
    });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found.' });
    }
    return res.json({
      ...worker,
      complete_name: worker.completeName,
      contact_number: worker.contactNumber,
      employment_type: worker.employmentType,
      daily_wage_rate: worker.dailyWageRate,
      employment_status: worker.employmentStatus,
      date_hired: worker.dateHired
    });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to retrieve worker.' });
  }
});

router.post('/workers', requireAuth, requirePermission('workers', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.body.id;
    const completeName = req.body.completeName || req.body.complete_name;
    const age = req.body.age;
    const contactNumber = req.body.contactNumber || req.body.contact_number;
    const trade = req.body.trade;
    const employmentType = req.body.employmentType || req.body.employment_type;
    const dailyWageRate = req.body.dailyWageRate !== undefined ? req.body.dailyWageRate : req.body.daily_wage_rate;
    const dateHired = req.body.dateHired || req.body.date_hired;
    const employmentStatus = req.body.employmentStatus || req.body.employment_status || 'Active';

    if (!id || !completeName || !age || !contactNumber || !trade || !employmentType || dailyWageRate === undefined || !dateHired) {
      return res.status(400).json({ error: 'All fields (ID, Name, Age, Contact, Trade, Type, Wage, Date Hired) are required.' });
    }

    if (Number(age) < 18 || Number(age) > 70) {
      return res.status(400).json({ error: 'Worker age must be between 18 and 70.' });
    }

    if (Number(dailyWageRate) <= 0) {
      return res.status(400).json({ error: 'Daily wage rate must be greater than zero.' });
    }

    const cleanId = String(id).trim();
    const existing = await db.query.workers.findFirst({
      where: eq(workers.id, cleanId)
    });
    if (existing) {
      return res.status(400).json({ error: `A worker with ID "${cleanId}" already exists.` });
    }

    const now = new Date().toISOString();
    await db.insert(workers).values({
      id: cleanId,
      completeName: String(completeName).trim(),
      age: Number(age),
      contactNumber: String(contactNumber).trim(),
      trade: String(trade).trim(),
      employmentType,
      dailyWageRate: Number(dailyWageRate),
      employmentStatus: employmentStatus || 'Active',
      dateHired: String(dateHired),
      createdAt: now
    });

    // Real-time synchronization to Firebase Firestore
    await syncDocToFirestore('workers', cleanId, {
      id: cleanId,
      completeName: String(completeName).trim(),
      complete_name: String(completeName).trim(),
      age: Number(age),
      contactNumber: String(contactNumber).trim(),
      contact_number: String(contactNumber).trim(),
      trade: String(trade).trim(),
      employmentType,
      employment_type: employmentType,
      dailyWageRate: Number(dailyWageRate),
      daily_wage_rate: Number(dailyWageRate),
      employmentStatus: employmentStatus || 'Active',
      employment_status: employmentStatus || 'Active',
      dateHired: String(dateHired),
      date_hired: String(dateHired),
      createdAt: now,
      created_at: now
    });

    await logAudit(req, 'CREATE', 'Worker Master Data', cleanId, `Added worker: ${completeName} (${trade}, ₱${dailyWageRate}/day)`);
    return res.status(201).json({ success: true, message: 'Worker record created successfully in Cloud SQL and Firebase Firestore.' });
  } catch (err: any) {
    console.error('Create worker error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create worker.' });
  }
});

router.put('/workers/:id', requireAuth, requirePermission('workers', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const completeName = req.body.completeName || req.body.complete_name;
    const age = req.body.age;
    const contactNumber = req.body.contactNumber || req.body.contact_number;
    const trade = req.body.trade;
    const employmentType = req.body.employmentType || req.body.employment_type;
    const dailyWageRate = req.body.dailyWageRate !== undefined ? req.body.dailyWageRate : req.body.daily_wage_rate;
    const dateHired = req.body.dateHired || req.body.date_hired;
    const employmentStatus = req.body.employmentStatus || req.body.employment_status;

    const worker = await db.query.workers.findFirst({
      where: eq(workers.id, id)
    });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found.' });
    }

    if (age !== undefined && (Number(age) < 18 || Number(age) > 70)) {
      return res.status(400).json({ error: 'Worker age must be between 18 and 70.' });
    }

    if (dailyWageRate !== undefined && Number(dailyWageRate) <= 0) {
      return res.status(400).json({ error: 'Daily wage rate must be greater than zero.' });
    }

    const updatedWorkerData = {
      completeName: completeName ? String(completeName).trim() : worker.completeName,
      age: age !== undefined ? Number(age) : worker.age,
      contactNumber: contactNumber ? String(contactNumber).trim() : worker.contactNumber,
      trade: trade ? String(trade).trim() : worker.trade,
      employmentType: employmentType || worker.employmentType,
      dailyWageRate: dailyWageRate !== undefined ? Number(dailyWageRate) : worker.dailyWageRate,
      employmentStatus: employmentStatus || worker.employmentStatus,
      dateHired: dateHired || worker.dateHired
    };

    await db.update(workers)
      .set(updatedWorkerData)
      .where(eq(workers.id, id));

    // Real-time synchronization to Firebase Firestore
    await syncDocToFirestore('workers', id, {
      id,
      ...updatedWorkerData,
      complete_name: updatedWorkerData.completeName,
      contact_number: updatedWorkerData.contactNumber,
      employment_type: updatedWorkerData.employmentType,
      daily_wage_rate: updatedWorkerData.dailyWageRate,
      employment_status: updatedWorkerData.employmentStatus,
      date_hired: updatedWorkerData.dateHired,
      updatedAt: new Date().toISOString()
    });

    await logAudit(req, 'UPDATE', 'Worker Master Data', id, `Updated worker ${id} (${completeName || worker.completeName})`);
    return res.json({ success: true, message: 'Worker updated successfully.' });
  } catch (err: any) {
    console.error('Update worker error:', err);
    return res.status(500).json({ error: 'Failed to update worker.' });
  }
});

router.patch('/workers/:id/status', requireAuth, requirePermission('workers', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (status !== 'Active' && status !== 'Inactive') {
      return res.status(400).json({ error: 'Status must be Active or Inactive.' });
    }

    await db.update(workers).set({ employmentStatus: status }).where(eq(workers.id, id));

    // Real-time synchronization to Firebase Firestore
    await syncDocToFirestore('workers', id, {
      employmentStatus: status,
      employment_status: status,
      updatedAt: new Date().toISOString()
    });

    await logAudit(req, status === 'Active' ? 'ACTIVATE' : 'DEACTIVATE', 'Worker Master Data', id, `Worker ${id} status set to ${status}`);

    return res.json({ success: true, message: `Worker status changed to ${status}.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update worker status.' });
  }
});

router.delete('/workers/:id', requireAuth, requirePermission('workers', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;

    // Referential integrity check
    const [{ value: attCount }] = await db.select({ value: count() }).from(attendance).where(eq(attendance.workerId, id));
    const [{ value: asnCount }] = await db.select({ value: count() }).from(dailyLaborAssignments).where(eq(dailyLaborAssignments.workerId, id));
    const [{ value: partCount }] = await db.select({ value: count() }).from(accomplishmentParticipants).where(eq(accomplishmentParticipants.workerId, id));

    if (Number(attCount) > 0 || Number(asnCount) > 0 || Number(partCount) > 0) {
      return res.status(400).json({
        error: `Cannot delete worker "${id}" because they have ${attCount} attendance records, ${asnCount} labor assignments, and ${partCount} accomplishment links. Deactivate the worker instead to preserve historical records.`
      });
    }

    await db.delete(workers).where(eq(workers.id, id));

    // Real-time synchronization to Firebase Firestore
    await deleteDocFromFirestore('workers', id);

    await logAudit(req, 'DELETE', 'Worker Master Data', id, `Deleted worker record ${id}`);

    return res.json({ success: true, message: 'Worker deleted successfully.' });
  } catch (err: any) {
    console.error('Delete worker error:', err);
    return res.status(500).json({ error: 'Failed to delete worker record.' });
  }
});

// -----------------------------------------------------------------------------
// 4. SUPERVISORS & WORK AREAS
// -----------------------------------------------------------------------------
router.get('/supervisors', requireAuth, async (req, res) => {
  try {
    const sups = await db.select().from(supervisors).orderBy(asc(supervisors.fullName));
    const mapped = sups.map(s => ({
      id: s.id,
      full_name: s.fullName,
      fullName: s.fullName,
      contact_number: s.contactNumber,
      contactNumber: s.contactNumber,
      email: s.email,
      role_title: s.roleTitle,
      roleTitle: s.roleTitle,
      created_at: s.createdAt
    }));
    return res.json(mapped);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch supervisors.' });
  }
});

router.post('/supervisors', requireAuth, requirePermission('settings', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.body.id;
    const fullName = req.body.fullName || req.body.full_name;
    const contactNumber = req.body.contactNumber || req.body.contact_number;
    const email = req.body.email;
    const roleTitle = req.body.roleTitle || req.body.role_title;

    if (!id || !fullName || !roleTitle) {
      return res.status(400).json({ error: 'Supervisor ID, Full Name, and Role Title are required.' });
    }
    const now = new Date().toISOString();
    await db.insert(supervisors).values({
      id: String(id).trim(),
      fullName: String(fullName).trim(),
      contactNumber: contactNumber ? String(contactNumber).trim() : '',
      email: email ? String(email).trim() : '',
      roleTitle: String(roleTitle).trim(),
      createdAt: now
    });

    await logAudit(req, 'CREATE', 'Supervisors', id, `Added supervisor ${fullName} (${roleTitle})`);
    return res.status(201).json({ success: true, message: 'Supervisor added.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to add supervisor.' });
  }
});

router.get('/work-areas', requireAuth, async (req, res) => {
  try {
    const areas = await db.select().from(workAreas).orderBy(asc(workAreas.areaName));
    const mapped = areas.map(a => ({
      id: a.id,
      area_name: a.areaName,
      areaName: a.areaName,
      description: a.description,
      status: a.status,
      created_at: a.createdAt
    }));
    return res.json(mapped);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch work areas.' });
  }
});

router.post('/work-areas', requireAuth, requirePermission('settings', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.body.id;
    const areaName = req.body.areaName || req.body.area_name;
    const description = req.body.description;

    if (!id || !areaName) {
      return res.status(400).json({ error: 'Area ID and Name are required.' });
    }
    const now = new Date().toISOString();
    await db.insert(workAreas).values({
      id: String(id).trim(),
      areaName: String(areaName).trim(),
      description: description ? String(description).trim() : '',
      status: 'Active',
      createdAt: now
    });

    await logAudit(req, 'CREATE', 'Work Areas', id, `Added work area ${areaName}`);
    return res.status(201).json({ success: true, message: 'Work area created.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to add work area.' });
  }
});

// -----------------------------------------------------------------------------
// 5. WORK ACTIVITY MASTER DATA
// -----------------------------------------------------------------------------
router.get('/activities', requireAuth, requirePermission('activities', 'view'), async (req, res) => {
  try {
    const acts = await db.select().from(workActivities).orderBy(asc(workActivities.id));
    const asns = await db.select({ activityId: dailyLaborAssignments.activityId }).from(dailyLaborAssignments);
    const accs = await db.select({ activityId: dailyAccomplishments.activityId }).from(dailyAccomplishments);

    const asnCountMap = new Map<string, number>();
    for (const a of asns) {
      asnCountMap.set(a.activityId, (asnCountMap.get(a.activityId) || 0) + 1);
    }
    const accCountMap = new Map<string, number>();
    for (const a of accs) {
      accCountMap.set(a.activityId, (accCountMap.get(a.activityId) || 0) + 1);
    }

    const mapped = acts.map(a => ({
      id: a.id,
      activity_name: a.activityName,
      activityName: a.activityName,
      description_of_work: a.descriptionOfWork,
      descriptionOfWork: a.descriptionOfWork,
      unit_of_measurement: a.unitOfMeasurement,
      unitOfMeasurement: a.unitOfMeasurement,
      target_productivity_rate: a.targetProductivityRate,
      targetProductivityRate: a.targetProductivityRate,
      activity_status: a.activityStatus,
      activityStatus: a.activityStatus,
      created_at: a.createdAt,
      assignment_count: asnCountMap.get(a.id) || 0,
      accomplishment_count: accCountMap.get(a.id) || 0
    }));

    return res.json(mapped);
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to fetch work activities.' });
  }
});

router.post('/activities', requireAuth, requirePermission('activities', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const id = req.body.id;
    const activityName = req.body.activityName || req.body.activity_name;
    const descriptionOfWork = req.body.descriptionOfWork || req.body.description_of_work;
    const unitOfMeasurement = req.body.unitOfMeasurement || req.body.unit_of_measurement;
    const targetProductivityRate = req.body.targetProductivityRate !== undefined ? req.body.targetProductivityRate : req.body.target_productivity_rate;

    if (!id || !activityName || !unitOfMeasurement || targetProductivityRate === undefined) {
      return res.status(400).json({ error: 'Activity ID, Name, Unit, and Target Rate are required.' });
    }

    if (Number(targetProductivityRate) <= 0) {
      return res.status(400).json({ error: 'Target productivity rate must be positive.' });
    }

    const cleanId = String(id).trim();
    const existing = await db.query.workActivities.findFirst({
      where: eq(workActivities.id, cleanId)
    });
    if (existing) {
      return res.status(400).json({ error: `Activity ID "${cleanId}" already exists.` });
    }

    const now = new Date().toISOString();
    await db.insert(workActivities).values({
      id: cleanId,
      activityName: String(activityName).trim(),
      descriptionOfWork: descriptionOfWork ? String(descriptionOfWork).trim() : '',
      unitOfMeasurement: String(unitOfMeasurement).trim(),
      targetProductivityRate: Number(targetProductivityRate),
      activityStatus: 'Active',
      createdAt: now
    });

    await syncDocToFirestore('activities', cleanId, {
      id: cleanId,
      activityName: String(activityName).trim(),
      activity_name: String(activityName).trim(),
      descriptionOfWork: descriptionOfWork ? String(descriptionOfWork).trim() : '',
      description_of_work: descriptionOfWork ? String(descriptionOfWork).trim() : '',
      unitOfMeasurement: String(unitOfMeasurement).trim(),
      unit_of_measurement: String(unitOfMeasurement).trim(),
      targetProductivityRate: Number(targetProductivityRate),
      target_productivity_rate: Number(targetProductivityRate),
      activityStatus: 'Active',
      activity_status: 'Active',
      createdAt: now
    });

    await logAudit(req, 'CREATE', 'Work Activity Master Data', cleanId, `Added work activity ${activityName} (${targetProductivityRate} ${unitOfMeasurement}/hr)`);
    return res.status(201).json({ success: true, message: 'Activity created successfully in Cloud SQL and Firestore.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to create work activity.' });
  }
});

router.put('/activities/:id', requireAuth, requirePermission('activities', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const activityName = req.body.activityName || req.body.activity_name;
    const descriptionOfWork = req.body.descriptionOfWork || req.body.description_of_work;
    const unitOfMeasurement = req.body.unitOfMeasurement || req.body.unit_of_measurement;
    const targetProductivityRate = req.body.targetProductivityRate !== undefined ? req.body.targetProductivityRate : req.body.target_productivity_rate;
    const activityStatus = req.body.activityStatus || req.body.activity_status;

    const activity = await db.query.workActivities.findFirst({
      where: eq(workActivities.id, id)
    });
    if (!activity) {
      return res.status(404).json({ error: 'Activity not found.' });
    }

    if (targetProductivityRate !== undefined && Number(targetProductivityRate) <= 0) {
      return res.status(400).json({ error: 'Target productivity rate must be positive.' });
    }

    await db.update(workActivities)
      .set({
        activityName: activityName ? String(activityName).trim() : activity.activityName,
        descriptionOfWork: descriptionOfWork !== undefined ? String(descriptionOfWork).trim() : activity.descriptionOfWork,
        unitOfMeasurement: unitOfMeasurement ? String(unitOfMeasurement).trim() : activity.unitOfMeasurement,
        targetProductivityRate: targetProductivityRate !== undefined ? Number(targetProductivityRate) : activity.targetProductivityRate,
        activityStatus: activityStatus || activity.activityStatus
      })
      .where(eq(workActivities.id, id));

    await logAudit(req, 'UPDATE', 'Work Activity Master Data', id, `Updated activity ${activityName || activity.activityName}`);
    return res.json({ success: true, message: 'Activity updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update activity.' });
  }
});

router.patch('/activities/:id/status', requireAuth, requirePermission('activities', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await db.update(workActivities).set({ activityStatus: status }).where(eq(workActivities.id, id));
    await logAudit(req, status === 'Active' ? 'ACTIVATE' : 'DEACTIVATE', 'Work Activity Master Data', id, `Activity ${id} set to ${status}`);

    return res.json({ success: true, message: `Activity status updated to ${status}.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update activity status.' });
  }
});

// -----------------------------------------------------------------------------
// 6. ATTENDANCE MANAGEMENT & AUTOMATED CALCULATIONS
// -----------------------------------------------------------------------------
async function computeAttendanceHoursAndPay(
  workerId: string,
  timeIn: string | null,
  timeOut: string | null,
  status: string,
  settings: any
) {
  const worker = await db.query.workers.findFirst({
    where: eq(workers.id, workerId)
  });
  const dailyWage = worker ? worker.dailyWageRate : 650.0;
  const standardHours = Number(settings.standardDailyHours || settings.standard_daily_hours) || 8.0;
  const hourlyRate = dailyWage / standardHours;
  const otMultiplier = Number(settings.overtimeMultiplier || settings.overtime_multiplier) || 1.25;
  const breakMinutes = Number(settings.unpaidBreakDurationMinutes || settings.unpaid_break_duration_minutes) || 60;

  if (status === 'Absent' || !timeIn || !timeOut) {
    return {
      totalHours: 0,
      regularHours: 0,
      overtimeHours: 0,
      calculatedPay: 0
    };
  }

  if (status === 'Half-Day') {
    const totalHours = Number(settings.halfDayThresholdHours || settings.half_day_threshold_hours) || 4.0;
    const pay = Math.round(totalHours * hourlyRate * 100) / 100;
    return {
      totalHours,
      regularHours: totalHours,
      overtimeHours: 0,
      calculatedPay: pay
    };
  }

  const [inH, inM] = timeIn.split(':').map(Number);
  const [outH, outM] = timeOut.split(':').map(Number);
  const inMinutes = inH * 60 + inM;
  const outMinutes = outH * 60 + outM;

  let elapsedMinutes = outMinutes - inMinutes;
  if (elapsedMinutes < 0) elapsedMinutes = 0;

  if (elapsedMinutes >= 300) {
    elapsedMinutes = Math.max(0, elapsedMinutes - breakMinutes);
  }

  const totalHours = Math.round((elapsedMinutes / 60) * 10) / 10;
  const regularHours = Math.min(totalHours, standardHours);
  const overtimeHours = Math.max(0, Math.round((totalHours - standardHours) * 10) / 10);

  const regPay = regularHours * hourlyRate;
  const otPay = overtimeHours * hourlyRate * otMultiplier;
  const calculatedPay = Math.round((regPay + otPay) * 100) / 100;

  return {
    totalHours,
    regularHours,
    overtimeHours,
    calculatedPay
  };
}

router.get('/attendance', requireAuth, requirePermission('attendance', 'view'), async (req, res) => {
  try {
    const date = cleanQueryParam(req.query.date);
    const workerId = cleanQueryParam(req.query.workerId || req.query.worker_id);
    const trade = cleanQueryParam(req.query.trade);
    const status = cleanQueryParam(req.query.status);

    const rows = await db
      .select({
        id: attendance.id,
        worker_id: attendance.workerId,
        workerId: attendance.workerId,
        date: attendance.date,
        time_in: attendance.timeIn,
        timeIn: attendance.timeIn,
        time_out: attendance.timeOut,
        timeOut: attendance.timeOut,
        attendance_status: attendance.attendanceStatus,
        attendanceStatus: attendance.attendanceStatus,
        total_hours_worked: attendance.totalHoursWorked,
        totalHoursWorked: attendance.totalHoursWorked,
        overtime_hours: attendance.overtimeHours,
        overtimeHours: attendance.overtimeHours,
        regular_hours: attendance.regularHours,
        regularHours: attendance.regularHours,
        calculated_pay: attendance.calculatedPay,
        calculatedPay: attendance.calculatedPay,
        remarks: attendance.remarks,
        created_at: attendance.createdAt,
        worker_name: workers.completeName,
        workerName: workers.completeName,
        worker_trade: workers.trade,
        workerTrade: workers.trade,
        worker_wage: workers.dailyWageRate,
        dailyWageRate: workers.dailyWageRate,
        employment_type: workers.employmentType,
        employmentType: workers.employmentType
      })
      .from(attendance)
      .innerJoin(workers, eq(attendance.workerId, workers.id))
      .where(
        and(
          date ? eq(attendance.date, date) : undefined,
          workerId ? eq(attendance.workerId, workerId) : undefined,
          trade ? eq(workers.trade, trade) : undefined,
          status ? eq(attendance.attendanceStatus, status) : undefined
        )
      )
      .orderBy(desc(attendance.date), asc(attendance.workerId));

    return res.json(rows);
  } catch (err: any) {
    console.error('Error fetching attendance:', err);
    return res.status(500).json({ error: 'Failed to retrieve attendance records.' });
  }
});

router.post('/attendance', requireAuth, requirePermission('attendance', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetWorkerId = req.body.workerId || req.body.worker_id;
    const targetDate = req.body.date;
    const targetTimeIn = req.body.timeIn !== undefined ? req.body.timeIn : req.body.time_in;
    const targetTimeOut = req.body.timeOut !== undefined ? req.body.timeOut : req.body.time_out;
    const targetStatus = req.body.attendanceStatus || req.body.attendance_status;
    const remarks = req.body.remarks;

    if (!targetWorkerId || !targetDate || !targetStatus) {
      return res.status(400).json({ error: 'Worker, date, and attendance status are required.' });
    }

    const settings = await getSettings();
    const { totalHours, regularHours, overtimeHours, calculatedPay } = await computeAttendanceHoursAndPay(
      targetWorkerId,
      targetTimeIn || null,
      targetTimeOut || null,
      targetStatus,
      settings
    );

    const existing = await db.query.attendance.findFirst({
      where: and(eq(attendance.workerId, targetWorkerId), eq(attendance.date, targetDate))
    });

    if (existing) {
      // Update existing record smoothly
      await db.update(attendance).set({
        timeIn: targetStatus === 'Absent' ? null : (targetTimeIn || null),
        timeOut: targetStatus === 'Absent' ? null : (targetTimeOut || null),
        attendanceStatus: targetStatus,
        totalHoursWorked: totalHours,
        overtimeHours,
        regularHours,
        calculatedPay,
        remarks: remarks !== undefined ? String(remarks) : existing.remarks
      }).where(eq(attendance.id, existing.id));

      await syncDocToFirestore('attendance', existing.id, {
        id: existing.id,
        workerId: targetWorkerId,
        worker_id: targetWorkerId,
        date: targetDate,
        timeIn: targetStatus === 'Absent' ? null : (targetTimeIn || null),
        time_in: targetStatus === 'Absent' ? null : (targetTimeIn || null),
        timeOut: targetStatus === 'Absent' ? null : (targetTimeOut || null),
        time_out: targetStatus === 'Absent' ? null : (targetTimeOut || null),
        attendanceStatus: targetStatus,
        attendance_status: targetStatus,
        totalHoursWorked: totalHours,
        total_hours_worked: totalHours,
        overtimeHours,
        overtime_hours: overtimeHours,
        regularHours,
        regular_hours: regularHours,
        calculatedPay,
        calculated_pay: calculatedPay,
        remarks: remarks !== undefined ? String(remarks) : existing.remarks
      });

      await logAudit(req, 'UPDATE', 'Attendance Management', existing.id, `Updated attendance for ${targetWorkerId} on ${targetDate} (${targetStatus}, ${totalHours} hrs)`);
      return res.status(200).json({ success: true, message: `Attendance updated for worker ${targetWorkerId} on ${targetDate}.`, id: existing.id });
    }

    const id = `ATT-${targetDate.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();

    await db.insert(attendance).values({
      id,
      workerId: targetWorkerId,
      date: targetDate,
      timeIn: targetStatus === 'Absent' ? null : targetTimeIn,
      timeOut: targetStatus === 'Absent' ? null : targetTimeOut,
      attendanceStatus: targetStatus,
      totalHoursWorked: totalHours,
      overtimeHours,
      regularHours,
      calculatedPay,
      remarks: remarks || '',
      createdAt: now
    });

    await syncDocToFirestore('attendance', id, {
      id,
      workerId: targetWorkerId,
      worker_id: targetWorkerId,
      date: targetDate,
      timeIn: targetStatus === 'Absent' ? null : targetTimeIn,
      time_in: targetStatus === 'Absent' ? null : targetTimeIn,
      timeOut: targetStatus === 'Absent' ? null : targetTimeOut,
      time_out: targetStatus === 'Absent' ? null : targetTimeOut,
      attendanceStatus: targetStatus,
      attendance_status: targetStatus,
      totalHoursWorked: totalHours,
      total_hours_worked: totalHours,
      overtimeHours,
      overtime_hours: overtimeHours,
      regularHours,
      regular_hours: regularHours,
      calculatedPay,
      calculated_pay: calculatedPay,
      remarks: remarks || '',
      createdAt: now
    });

    await logAudit(req, 'CREATE', 'Attendance Management', id, `Recorded attendance for ${targetWorkerId} on ${targetDate} (${targetStatus}, ${totalHours} hrs)`);
    return res.status(201).json({ success: true, message: 'Attendance record created in Cloud SQL and Firestore.', id });
  } catch (err: any) {
    console.error('Attendance create error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create attendance.' });
  }
});

router.put('/attendance/:id', requireAuth, requirePermission('attendance', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const workerId = req.body.workerId || req.body.worker_id;
    const date = req.body.date;
    const timeIn = req.body.timeIn !== undefined ? req.body.timeIn : req.body.time_in;
    const timeOut = req.body.timeOut !== undefined ? req.body.timeOut : req.body.time_out;
    const attendanceStatus = req.body.attendanceStatus || req.body.attendance_status;
    const remarks = req.body.remarks;

    const current = await db.query.attendance.findFirst({
      where: eq(attendance.id, id)
    });
    if (!current) {
      return res.status(404).json({ error: 'Attendance record not found.' });
    }

    const targetWorker = workerId || current.workerId;
    const targetDate = date || current.date;
    const targetStatus = attendanceStatus || current.attendanceStatus;

    const settings = await getSettings();
    const { totalHours, regularHours, overtimeHours, calculatedPay } = await computeAttendanceHoursAndPay(
      targetWorker,
      timeIn !== undefined ? timeIn : current.timeIn,
      timeOut !== undefined ? timeOut : current.timeOut,
      targetStatus,
      settings
    );

    await db.update(attendance)
      .set({
        workerId: targetWorker,
        date: targetDate,
        timeIn: targetStatus === 'Absent' ? null : (timeIn !== undefined ? timeIn : current.timeIn),
        timeOut: targetStatus === 'Absent' ? null : (timeOut !== undefined ? timeOut : current.timeOut),
        attendanceStatus: targetStatus,
        totalHoursWorked: totalHours,
        overtimeHours,
        regularHours,
        calculatedPay,
        remarks: remarks !== undefined ? remarks : current.remarks
      })
      .where(eq(attendance.id, id));

    await logAudit(req, 'UPDATE', 'Attendance Management', id, `Updated attendance ${id} for worker ${targetWorker} on ${targetDate}`);
    return res.json({ success: true, message: 'Attendance record updated successfully.' });
  } catch (err: any) {
    console.error('Attendance update error:', err);
    return res.status(500).json({ error: 'Failed to update attendance record.' });
  }
});

router.delete('/attendance/:id', requireAuth, requirePermission('attendance', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(attendance).where(eq(attendance.id, id));
    await deleteDocFromFirestore('attendance', id);
    await logAudit(req, 'DELETE', 'Attendance Management', id, `Deleted attendance record ${id}`);
    return res.json({ success: true, message: 'Attendance record deleted.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete attendance.' });
  }
});

// -----------------------------------------------------------------------------
// 7. DAILY LABOR ASSIGNMENTS
// -----------------------------------------------------------------------------
router.get('/assignments', requireAuth, requirePermission('assignments', 'view'), async (req, res) => {
  try {
    const date = cleanQueryParam(req.query.date);
    const workerId = cleanQueryParam(req.query.workerId || req.query.worker_id);
    const activityId = cleanQueryParam(req.query.activityId || req.query.activity_id);
    const areaId = cleanQueryParam(req.query.areaId || req.query.area_id);
    const supervisorId = cleanQueryParam(req.query.supervisorId || req.query.supervisor_id);
    const status = cleanQueryParam(req.query.status);

    const rows = await db
      .select({
        id: dailyLaborAssignments.id,
        date: dailyLaborAssignments.date,
        worker_id: dailyLaborAssignments.workerId,
        workerId: dailyLaborAssignments.workerId,
        activity_id: dailyLaborAssignments.activityId,
        activityId: dailyLaborAssignments.activityId,
        work_area_id: dailyLaborAssignments.workAreaId,
        workAreaId: dailyLaborAssignments.workAreaId,
        supervisor_id: dailyLaborAssignments.supervisorId,
        supervisorId: dailyLaborAssignments.supervisorId,
        assignment_status: dailyLaborAssignments.assignmentStatus,
        assignmentStatus: dailyLaborAssignments.assignmentStatus,
        notes: dailyLaborAssignments.notes,
        created_at: dailyLaborAssignments.createdAt,
        worker_name: workers.completeName,
        workerName: workers.completeName,
        worker_trade: workers.trade,
        workerTrade: workers.trade,
        activity_name: workActivities.activityName,
        activityName: workActivities.activityName,
        unit_of_measurement: workActivities.unitOfMeasurement,
        unitOfMeasurement: workActivities.unitOfMeasurement,
        area_name: workAreas.areaName,
        areaName: workAreas.areaName,
        supervisor_name: supervisors.fullName,
        supervisorName: supervisors.fullName
      })
      .from(dailyLaborAssignments)
      .innerJoin(workers, eq(dailyLaborAssignments.workerId, workers.id))
      .innerJoin(workActivities, eq(dailyLaborAssignments.activityId, workActivities.id))
      .innerJoin(workAreas, eq(dailyLaborAssignments.workAreaId, workAreas.id))
      .innerJoin(supervisors, eq(dailyLaborAssignments.supervisorId, supervisors.id))
      .where(
        and(
          date ? eq(dailyLaborAssignments.date, date) : undefined,
          workerId ? eq(dailyLaborAssignments.workerId, workerId) : undefined,
          activityId ? eq(dailyLaborAssignments.activityId, activityId) : undefined,
          areaId ? eq(dailyLaborAssignments.workAreaId, areaId) : undefined,
          supervisorId ? eq(dailyLaborAssignments.supervisorId, supervisorId) : undefined,
          status ? eq(dailyLaborAssignments.assignmentStatus, status) : undefined
        )
      )
      .orderBy(desc(dailyLaborAssignments.date), asc(dailyLaborAssignments.workerId));

    return res.json(rows);
  } catch (err: any) {
    console.error('Error fetching assignments:', err);
    return res.status(500).json({ error: 'Failed to retrieve labor assignments.' });
  }
});

router.post('/assignments', requireAuth, requirePermission('assignments', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const targetDate = req.body.date;
    const targetWorkerId = req.body.workerId || req.body.worker_id;
    const targetActivityId = req.body.activityId || req.body.activity_id;
    const targetWorkAreaId = req.body.workAreaId || req.body.work_area_id;
    const targetSupervisorId = req.body.supervisorId || req.body.supervisor_id;
    const targetStatus = req.body.assignmentStatus || req.body.assignment_status || 'Assigned';
    const notes = req.body.notes;

    if (!targetDate || !targetWorkerId || !targetActivityId || !targetWorkAreaId || !targetSupervisorId) {
      return res.status(400).json({ error: 'Date, Worker, Activity, Work Area, and Supervisor are required.' });
    }

    const worker = await db.query.workers.findFirst({
      where: eq(workers.id, targetWorkerId)
    });
    if (!worker) {
      return res.status(404).json({ error: 'Worker not found.' });
    }
    if (worker.employmentStatus !== 'Active') {
      return res.status(400).json({ error: `Cannot assign inactive worker "${worker.completeName}". Activate worker first.` });
    }

    const existing = await db.query.dailyLaborAssignments.findFirst({
      where: and(eq(dailyLaborAssignments.workerId, targetWorkerId), eq(dailyLaborAssignments.date, targetDate))
    });

    if (existing) {
      // Update existing assignment record smoothly
      await db.update(dailyLaborAssignments).set({
        activityId: targetActivityId,
        workAreaId: targetWorkAreaId,
        supervisorId: targetSupervisorId,
        assignmentStatus: targetStatus,
        notes: notes !== undefined ? String(notes) : existing.notes
      }).where(eq(dailyLaborAssignments.id, existing.id));

      await syncDocToFirestore('assignments', existing.id, {
        id: existing.id,
        date: targetDate,
        workerId: targetWorkerId,
        worker_id: targetWorkerId,
        activityId: targetActivityId,
        activity_id: targetActivityId,
        workAreaId: targetWorkAreaId,
        work_area_id: targetWorkAreaId,
        supervisorId: targetSupervisorId,
        supervisor_id: targetSupervisorId,
        assignmentStatus: targetStatus,
        assignment_status: targetStatus,
        notes: notes !== undefined ? String(notes) : existing.notes
      });

      await logAudit(req, 'UPDATE', 'Daily Labor Assignment', existing.id, `Updated assignment for ${worker.completeName} on ${targetDate} to ${targetActivityId}`);
      return res.status(200).json({ success: true, message: `Labor assignment updated for worker ${targetWorkerId} on ${targetDate}.`, id: existing.id });
    }

    const id = `ASN-${targetDate.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();

    await db.insert(dailyLaborAssignments).values({
      id,
      date: targetDate,
      workerId: targetWorkerId,
      activityId: targetActivityId,
      workAreaId: targetWorkAreaId,
      supervisorId: targetSupervisorId,
      assignmentStatus: targetStatus,
      notes: notes || '',
      createdAt: now
    });

    await syncDocToFirestore('assignments', id, {
      id,
      date: targetDate,
      workerId: targetWorkerId,
      worker_id: targetWorkerId,
      activityId: targetActivityId,
      activity_id: targetActivityId,
      workAreaId: targetWorkAreaId,
      work_area_id: targetWorkAreaId,
      supervisorId: targetSupervisorId,
      supervisor_id: targetSupervisorId,
      assignmentStatus: targetStatus,
      assignment_status: targetStatus,
      notes: notes || '',
      createdAt: now
    });

    await logAudit(req, 'CREATE', 'Daily Labor Assignment', id, `Assigned ${worker.completeName} to ${targetActivityId} on ${targetDate}`);
    return res.status(201).json({ success: true, message: 'Labor assignment created successfully in Cloud SQL and Firestore.', id });
  } catch (err: any) {
    console.error('Assignment create error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create assignment.' });
  }
});

router.put('/assignments/:id', requireAuth, requirePermission('assignments', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const targetDate = req.body.date;
    const targetWorkerId = req.body.workerId || req.body.worker_id;
    const targetActivityId = req.body.activityId || req.body.activity_id;
    const targetWorkAreaId = req.body.workAreaId || req.body.work_area_id;
    const targetSupervisorId = req.body.supervisorId || req.body.supervisor_id;
    const targetStatus = req.body.assignmentStatus || req.body.assignment_status;
    const notes = req.body.notes;

    const current = await db.query.dailyLaborAssignments.findFirst({
      where: eq(dailyLaborAssignments.id, id)
    });
    if (!current) {
      return res.status(404).json({ error: 'Assignment not found.' });
    }

    await db.update(dailyLaborAssignments)
      .set({
        date: targetDate || current.date,
        workerId: targetWorkerId || current.workerId,
        activityId: targetActivityId || current.activityId,
        workAreaId: targetWorkAreaId || current.workAreaId,
        supervisorId: targetSupervisorId || current.supervisorId,
        assignmentStatus: targetStatus || current.assignmentStatus,
        notes: notes !== undefined ? notes : current.notes
      })
      .where(eq(dailyLaborAssignments.id, id));

    await syncDocToFirestore('assignments', id, {
      id,
      date: targetDate || current.date,
      workerId: targetWorkerId || current.workerId,
      worker_id: targetWorkerId || current.workerId,
      activityId: targetActivityId || current.activityId,
      activity_id: targetActivityId || current.activityId,
      workAreaId: targetWorkAreaId || current.workAreaId,
      work_area_id: targetWorkAreaId || current.workAreaId,
      supervisorId: targetSupervisorId || current.supervisorId,
      supervisor_id: targetSupervisorId || current.supervisorId,
      assignmentStatus: targetStatus || current.assignmentStatus,
      assignment_status: targetStatus || current.assignmentStatus,
      notes: notes !== undefined ? notes : current.notes
    });

    await logAudit(req, 'UPDATE', 'Daily Labor Assignment', id, `Updated assignment ${id}`);
    return res.json({ success: true, message: 'Assignment updated successfully in Cloud SQL and Firestore.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update assignment.' });
  }
});

router.patch('/assignments/:id/status', requireAuth, requirePermission('assignments', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['Assigned', 'In Progress', 'Completed'].includes(status)) {
      return res.status(400).json({ error: 'Status must be Assigned, In Progress, or Completed.' });
    }

    await db.update(dailyLaborAssignments).set({ assignmentStatus: status }).where(eq(dailyLaborAssignments.id, id));
    await logAudit(req, 'STATUS_CHANGE', 'Daily Labor Assignment', id, `Assignment status updated to ${status}`);

    return res.json({ success: true, message: `Assignment status changed to ${status}.` });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update status.' });
  }
});

router.delete('/assignments/:id', requireAuth, requirePermission('assignments', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(dailyLaborAssignments).where(eq(dailyLaborAssignments.id, id));
    await deleteDocFromFirestore('assignments', id);
    await logAudit(req, 'DELETE', 'Daily Labor Assignment', id, `Deleted assignment ${id}`);
    return res.json({ success: true, message: 'Assignment deleted successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete assignment.' });
  }
});

// -----------------------------------------------------------------------------
// 8. DAILY ACCOMPLISHMENTS & PRODUCTIVITY MONITORING
// -----------------------------------------------------------------------------
router.get('/accomplishments', requireAuth, requirePermission('accomplishments', 'view'), async (req, res) => {
  try {
    const date = cleanQueryParam(req.query.date);
    const activityId = cleanQueryParam(req.query.activityId || req.query.activity_id);
    const areaId = cleanQueryParam(req.query.areaId || req.query.area_id);
    const status = cleanQueryParam(req.query.status);

    const rows = await db
      .select({
        id: dailyAccomplishments.id,
        date: dailyAccomplishments.date,
        activity_id: dailyAccomplishments.activityId,
        activityId: dailyAccomplishments.activityId,
        work_area_id: dailyAccomplishments.workAreaId,
        workAreaId: dailyAccomplishments.workAreaId,
        planned_quantity: dailyAccomplishments.plannedQuantity,
        plannedQuantity: dailyAccomplishments.plannedQuantity,
        actual_quantity: dailyAccomplishments.actualQuantity,
        actualQuantity: dailyAccomplishments.actualQuantity,
        unit_of_measurement: dailyAccomplishments.unitOfMeasurement,
        unitOfMeasurement: dailyAccomplishments.unitOfMeasurement,
        actual_labor_hours: dailyAccomplishments.actualLaborHours,
        actualLaborHours: dailyAccomplishments.actualLaborHours,
        actual_productivity_rate: dailyAccomplishments.actualProductivityRate,
        actualProductivityRate: dailyAccomplishments.actualProductivityRate,
        productivity_achievement_percent: dailyAccomplishments.productivityAchievementPercent,
        productivityAchievementPercent: dailyAccomplishments.productivityAchievementPercent,
        planned_achievement_percent: dailyAccomplishments.plannedAchievementPercent,
        plannedAchievementPercent: dailyAccomplishments.plannedAchievementPercent,
        performance_status: dailyAccomplishments.performanceStatus,
        performanceStatus: dailyAccomplishments.performanceStatus,
        remarks: dailyAccomplishments.remarks,
        created_at: dailyAccomplishments.createdAt,
        activity_name: workActivities.activityName,
        activityName: workActivities.activityName,
        target_productivity_rate: workActivities.targetProductivityRate,
        targetProductivityRate: workActivities.targetProductivityRate,
        area_name: workAreas.areaName,
        areaName: workAreas.areaName
      })
      .from(dailyAccomplishments)
      .innerJoin(workActivities, eq(dailyAccomplishments.activityId, workActivities.id))
      .innerJoin(workAreas, eq(dailyAccomplishments.workAreaId, workAreas.id))
      .where(
        and(
          date ? eq(dailyAccomplishments.date, date) : undefined,
          activityId ? eq(dailyAccomplishments.activityId, activityId) : undefined,
          areaId ? eq(dailyAccomplishments.workAreaId, areaId) : undefined,
          status ? eq(dailyAccomplishments.performanceStatus, status) : undefined
        )
      )
      .orderBy(desc(dailyAccomplishments.date), asc(dailyAccomplishments.id));

    // Get participants
    const parts = await db
      .select({
        accomplishmentId: accomplishmentParticipants.accomplishmentId,
        workerId: accomplishmentParticipants.workerId,
        hoursContributed: accomplishmentParticipants.hoursContributed,
        completeName: workers.completeName,
        trade: workers.trade
      })
      .from(accomplishmentParticipants)
      .innerJoin(workers, eq(accomplishmentParticipants.workerId, workers.id));

    const partsMap = new Map<string, any[]>();
    for (const p of parts) {
      if (!partsMap.has(p.accomplishmentId)) {
        partsMap.set(p.accomplishmentId, []);
      }
      partsMap.get(p.accomplishmentId)!.push({
        workerId: p.workerId,
        name: p.completeName,
        trade: p.trade,
        hours: p.hoursContributed
      });
    }

    const result = rows.map(r => ({
      ...r,
      participants: partsMap.get(r.id) || []
    }));

    return res.json(result);
  } catch (err: any) {
    console.error('Error fetching accomplishments:', err);
    return res.status(500).json({ error: 'Failed to retrieve accomplishment records.' });
  }
});

router.post('/accomplishments', requireAuth, requirePermission('accomplishments', 'create'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const date = req.body.date;
    const activityId = req.body.activityId || req.body.activity_id;
    const workAreaId = req.body.workAreaId || req.body.work_area_id;
    const plannedQuantity = req.body.plannedQuantity !== undefined ? req.body.plannedQuantity : req.body.planned_quantity;
    const actualQuantity = req.body.actualQuantity !== undefined ? req.body.actualQuantity : req.body.actual_quantity;
    const actualLaborHours = req.body.actualLaborHours !== undefined ? req.body.actualLaborHours : req.body.actual_labor_hours;
    const workerIds = req.body.workerIds || req.body.worker_ids;
    const remarks = req.body.remarks;

    if (!date || !activityId || !workAreaId || plannedQuantity === undefined || actualQuantity === undefined || actualLaborHours === undefined) {
      return res.status(400).json({ error: 'All fields including planned & actual quantities and labor hours are required.' });
    }

    const act = await db.query.workActivities.findFirst({
      where: eq(workActivities.id, activityId)
    });
    if (!act) {
      return res.status(404).json({ error: 'Activity not found.' });
    }

    const planned = Number(plannedQuantity);
    const actual = Number(actualQuantity);
    const hours = Number(actualLaborHours);

    if (hours <= 0) {
      return res.status(400).json({ error: 'Actual labor hours must be greater than zero.' });
    }

    const actualProdRate = Math.round((actual / hours) * 100) / 100;
    const prodAchPercent = Math.round((actualProdRate / act.targetProductivityRate) * 1000) / 10;
    const planAchPercent = planned > 0 ? Math.round((actual / planned) * 1000) / 10 : 0;

    let perfStatus: 'Above Target' | 'Met Target' | 'Below Target';
    if (prodAchPercent >= 105.0) {
      perfStatus = 'Above Target';
    } else if (prodAchPercent >= 95.0) {
      perfStatus = 'Met Target';
    } else {
      perfStatus = 'Below Target';
    }

    const id = `ACC-${date.replace(/-/g, '')}-${Date.now().toString().slice(-4)}`;
    const now = new Date().toISOString();

    await db.insert(dailyAccomplishments).values({
      id,
      date,
      activityId,
      workAreaId,
      plannedQuantity: planned,
      actualQuantity: actual,
      unitOfMeasurement: act.unitOfMeasurement,
      actualLaborHours: hours,
      actualProductivityRate: actualProdRate,
      productivityAchievementPercent: prodAchPercent,
      plannedAchievementPercent: planAchPercent,
      performanceStatus: perfStatus,
      remarks: remarks || '',
      createdAt: now
    });

    if (Array.isArray(workerIds) && workerIds.length > 0) {
      const hoursPerWorker = Math.round((hours / workerIds.length) * 10) / 10;
      for (const wId of workerIds) {
        await db.insert(accomplishmentParticipants).values({
          id: `PART-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          accomplishmentId: id,
          workerId: wId,
          assignmentId: null,
          hoursContributed: hoursPerWorker
        });
      }
    }

    await syncDocToFirestore('accomplishments', id, {
      id,
      date,
      activityId,
      activity_id: activityId,
      workAreaId,
      work_area_id: workAreaId,
      plannedQuantity: planned,
      planned_quantity: planned,
      actualQuantity: actual,
      actual_quantity: actual,
      unitOfMeasurement: act.unitOfMeasurement,
      unit_of_measurement: act.unitOfMeasurement,
      actualLaborHours: hours,
      actual_labor_hours: hours,
      actualProductivityRate: actualProdRate,
      actual_productivity_rate: actualProdRate,
      productivityAchievementPercent: prodAchPercent,
      productivity_achievement_percent: prodAchPercent,
      plannedAchievementPercent: planAchPercent,
      planned_achievement_percent: planAchPercent,
      performanceStatus: perfStatus,
      performance_status: perfStatus,
      remarks: remarks || '',
      createdAt: now
    });

    await logAudit(req, 'CREATE', 'Daily Accomplishment Records', id, `Recorded accomplishment for ${act.activityName} on ${date}: ${actual}/${planned} ${act.unitOfMeasurement} (${perfStatus})`);
    return res.status(201).json({ success: true, message: 'Accomplishment recorded successfully in Cloud SQL and Firestore.', id });
  } catch (err: any) {
    console.error('Accomplishment create error:', err);
    return res.status(500).json({ error: err.message || 'Failed to create accomplishment.' });
  }
});

router.put('/accomplishments/:id', requireAuth, requirePermission('accomplishments', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    const date = req.body.date;
    const activityId = req.body.activityId || req.body.activity_id;
    const workAreaId = req.body.workAreaId || req.body.work_area_id;
    const plannedQuantity = req.body.plannedQuantity !== undefined ? req.body.plannedQuantity : req.body.planned_quantity;
    const actualQuantity = req.body.actualQuantity !== undefined ? req.body.actualQuantity : req.body.actual_quantity;
    const actualLaborHours = req.body.actualLaborHours !== undefined ? req.body.actualLaborHours : req.body.actual_labor_hours;
    const workerIds = req.body.workerIds || req.body.worker_ids;
    const remarks = req.body.remarks;

    const current = await db.query.dailyAccomplishments.findFirst({
      where: eq(dailyAccomplishments.id, id)
    });
    if (!current) {
      return res.status(404).json({ error: 'Accomplishment record not found.' });
    }

    const targetActId = activityId || current.activityId;
    const act = await db.query.workActivities.findFirst({
      where: eq(workActivities.id, targetActId)
    });
    if (!act) {
      return res.status(404).json({ error: 'Target activity not found.' });
    }

    const planned = Number(plannedQuantity !== undefined ? plannedQuantity : current.plannedQuantity);
    const actual = Number(actualQuantity !== undefined ? actualQuantity : current.actualQuantity);
    const hours = Number(actualLaborHours !== undefined ? actualLaborHours : current.actualLaborHours);

    const actualProdRate = Math.round((actual / hours) * 100) / 100;
    const prodAchPercent = Math.round((actualProdRate / act.targetProductivityRate) * 1000) / 10;
    const planAchPercent = planned > 0 ? Math.round((actual / planned) * 1000) / 10 : 0;

    let perfStatus: 'Above Target' | 'Met Target' | 'Below Target';
    if (prodAchPercent >= 105.0) {
      perfStatus = 'Above Target';
    } else if (prodAchPercent >= 95.0) {
      perfStatus = 'Met Target';
    } else {
      perfStatus = 'Below Target';
    }

    await db.update(dailyAccomplishments)
      .set({
        date: date || current.date,
        activityId: targetActId,
        workAreaId: workAreaId || current.workAreaId,
        plannedQuantity: planned,
        actualQuantity: actual,
        unitOfMeasurement: act.unitOfMeasurement,
        actualLaborHours: hours,
        actualProductivityRate: actualProdRate,
        productivityAchievementPercent: prodAchPercent,
        plannedAchievementPercent: planAchPercent,
        performanceStatus: perfStatus,
        remarks: remarks !== undefined ? remarks : current.remarks
      })
      .where(eq(dailyAccomplishments.id, id));

    if (Array.isArray(workerIds)) {
      await db.delete(accomplishmentParticipants).where(eq(accomplishmentParticipants.accomplishmentId, id));
      const hoursPerWorker = workerIds.length > 0 ? Math.round((hours / workerIds.length) * 10) / 10 : 0;
      for (const wId of workerIds) {
        await db.insert(accomplishmentParticipants).values({
          id: `PART-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
          accomplishmentId: id,
          workerId: wId,
          assignmentId: null,
          hoursContributed: hoursPerWorker
        });
      }
    }

    await logAudit(req, 'UPDATE', 'Daily Accomplishment Records', id, `Updated accomplishment ${id}`);
    return res.json({ success: true, message: 'Accomplishment updated successfully.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to update accomplishment.' });
  }
});

router.delete('/accomplishments/:id', requireAuth, requirePermission('accomplishments', 'delete'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    await db.delete(dailyAccomplishments).where(eq(dailyAccomplishments.id, id));
    await deleteDocFromFirestore('accomplishments', id);
    await logAudit(req, 'DELETE', 'Daily Accomplishment Records', id, `Deleted accomplishment record ${id}`);
    return res.json({ success: true, message: 'Accomplishment record deleted.' });
  } catch (err: any) {
    return res.status(500).json({ error: 'Failed to delete accomplishment.' });
  }
});

// -----------------------------------------------------------------------------
// 9. LABOR MANAGEMENT DASHBOARD (All 6 Sections A, B, C, D, E, F)
// -----------------------------------------------------------------------------
router.get('/dashboard/stats', requireAuth, async (req, res) => {
  try {
    const selectedDate = (req.query.date as string) || '2026-10-24';
    const settings = await getSettings();

    // SECTION A: Today's Workforce
    const assignedRows = await db
      .select({ workerId: dailyLaborAssignments.workerId })
      .from(dailyLaborAssignments)
      .where(eq(dailyLaborAssignments.date, selectedDate));
    const scheduledWorkerSet = new Set(assignedRows.map(r => r.workerId));
    const scheduledCount = scheduledWorkerSet.size;

    const attRows = await db
      .select()
      .from(attendance)
      .where(eq(attendance.date, selectedDate));

    let presentCount = 0;
    let absentCount = 0;
    let lateCount = 0;
    let halfDayCount = 0;

    for (const row of attRows) {
      if (row.attendanceStatus === 'Present') presentCount++;
      else if (row.attendanceStatus === 'Absent') absentCount++;
      else if (row.attendanceStatus === 'Late') lateCount++;
      else if (row.attendanceStatus === 'Half-Day') halfDayCount++;
    }

    // SECTION B: Labor Hours
    let todayTotalHours = 0;
    let todayOtHours = 0;
    let todayRegHours = 0;
    for (const row of attRows) {
      todayTotalHours += Number(row.totalHoursWorked || 0);
      todayOtHours += Number(row.overtimeHours || 0);
      todayRegHours += Number(row.regularHours || 0);
    }

    // Period Total Hours
    const periodStart = settings.samplePeriodStart || '2026-10-20';
    const periodEnd = settings.samplePeriodEnd || '2026-10-24';

    const periodRows = await db
      .select()
      .from(attendance)
      .where(and(sql`${attendance.date} >= ${periodStart}`, sql`${attendance.date} <= ${periodEnd}`));

    let periodTotalHours = 0;
    let periodOtHours = 0;
    const trendMap = new Map<string, { total: number; ot: number; cost: number }>();

    for (const r of periodRows) {
      periodTotalHours += Number(r.totalHoursWorked || 0);
      periodOtHours += Number(r.overtimeHours || 0);

      const cur = trendMap.get(r.date) || { total: 0, ot: 0, cost: 0 };
      cur.total += Number(r.totalHoursWorked || 0);
      cur.ot += Number(r.overtimeHours || 0);
      cur.cost += Number(r.calculatedPay || 0);
      trendMap.set(r.date, cur);
    }

    const periodTrendRows = Array.from(trendMap.entries())
      .map(([d, val]) => ({
        date: d,
        total_hours: Math.round(val.total * 10) / 10,
        ot_hours: Math.round(val.ot * 10) / 10,
        total_cost: Math.round(val.cost * 100) / 100
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // SECTION C: Labor Cost
    let todayCost = 0;
    for (const row of attRows) {
      todayCost += Number(row.calculatedPay || 0);
    }

    let mtdCost = 0;
    for (const row of periodRows) {
      mtdCost += Number(row.calculatedPay || 0);
    }

    // Cost per worker & per trade on selected date
    const allWorkers = await db.select().from(workers).where(eq(workers.employmentStatus, 'Active'));
    const attMap = new Map<string, typeof attendance.$inferSelect>();
    for (const a of attRows) {
      attMap.set(a.workerId, a);
    }

    const costPerWorkerRows = allWorkers.map(w => {
      const a = attMap.get(w.id);
      return {
        worker_id: w.id,
        complete_name: w.completeName,
        trade: w.trade,
        daily_wage_rate: w.dailyWageRate,
        total_hours: a ? a.totalHoursWorked : 0,
        ot_hours: a ? a.overtimeHours : 0,
        labor_cost: a ? a.calculatedPay : 0
      };
    }).sort((a, b) => b.labor_cost - a.labor_cost);

    const tradeCostMap = new Map<string, { count: number; cost: number; hours: number }>();
    for (const w of allWorkers) {
      const a = attMap.get(w.id);
      const cur = tradeCostMap.get(w.trade) || { count: 0, cost: 0, hours: 0 };
      cur.count++;
      cur.cost += a ? a.calculatedPay : 0;
      cur.hours += a ? a.totalHoursWorked : 0;
      tradeCostMap.set(w.trade, cur);
    }

    const costPerTradeRows = Array.from(tradeCostMap.entries()).map(([trade, val]) => ({
      trade,
      worker_count: val.count,
      total_cost: Math.round(val.cost * 100) / 100,
      total_hours: Math.round(val.hours * 10) / 10
    })).sort((a, b) => b.total_cost - a.total_cost);

    // SECTION D: Workforce by Trade
    const workforceByTradeRows = Array.from(tradeCostMap.entries()).map(([trade, val]) => ({
      trade,
      count: val.count
    })).sort((a, b) => b.count - a.count);

    // SECTION E: Manpower Status
    const [{ value: totalActiveWorkers }] = await db.select({ value: count() }).from(workers).where(eq(workers.employmentStatus, 'Active'));
    const [{ value: totalInactiveWorkers }] = await db.select({ value: count() }).from(workers).where(eq(workers.employmentStatus, 'Inactive'));

    let assignedCount = 0;
    let unassignedCount = 0;
    for (const w of allWorkers) {
      if (scheduledWorkerSet.has(w.id)) {
        assignedCount++;
      } else {
        unassignedCount++;
      }
    }

    // SECTION F: Productivity per Activity
    const dayAccomplishments = await db
      .select({
        id: dailyAccomplishments.id,
        date: dailyAccomplishments.date,
        activity_id: dailyAccomplishments.activityId,
        work_area_id: dailyAccomplishments.workAreaId,
        planned_quantity: dailyAccomplishments.plannedQuantity,
        actual_quantity: dailyAccomplishments.actualQuantity,
        unit_of_measurement: dailyAccomplishments.unitOfMeasurement,
        actual_labor_hours: dailyAccomplishments.actualLaborHours,
        actual_productivity_rate: dailyAccomplishments.actualProductivityRate,
        productivity_achievement_percent: dailyAccomplishments.productivityAchievementPercent,
        planned_achievement_percent: dailyAccomplishments.plannedAchievementPercent,
        performance_status: dailyAccomplishments.performanceStatus,
        remarks: dailyAccomplishments.remarks,
        activity_name: workActivities.activityName,
        target_productivity_rate: workActivities.targetProductivityRate,
        area_name: workAreas.areaName
      })
      .from(dailyAccomplishments)
      .innerJoin(workActivities, eq(dailyAccomplishments.activityId, workActivities.id))
      .innerJoin(workAreas, eq(dailyAccomplishments.workAreaId, workAreas.id))
      .where(eq(dailyAccomplishments.date, selectedDate))
      .orderBy(asc(dailyAccomplishments.productivityAchievementPercent));

    // Aggregate productivity across all activities in Cloud SQL
    const allActs = await db.select().from(workActivities).orderBy(asc(workActivities.id));
    const allAccs = await db.select().from(dailyAccomplishments);

    const actAccMap = new Map<string, typeof dailyAccomplishments.$inferSelect[]>();
    for (const acc of allAccs) {
      if (!actAccMap.has(acc.activityId)) {
        actAccMap.set(acc.activityId, []);
      }
      actAccMap.get(acc.activityId)!.push(acc);
    }

    const activityAnalysis = allActs.map(act => {
      const records = actAccMap.get(act.id) || [];
      const totalPlanned = records.reduce((s, r) => s + r.plannedQuantity, 0);
      const totalActual = records.reduce((s, r) => s + r.actualQuantity, 0);
      const totalHours = records.reduce((s, r) => s + r.actualLaborHours, 0);
      const belowCount = records.filter(r => r.performanceStatus === 'Below Target').length;

      const actualRate = totalHours > 0 ? Math.round((totalActual / totalHours) * 100) / 100 : 0;
      const prodAchievement = act.targetProductivityRate > 0 ? Math.round((actualRate / act.targetProductivityRate) * 1000) / 10 : 0;
      const plannedAchievement = totalPlanned > 0 ? Math.round((totalActual / totalPlanned) * 1000) / 10 : 0;
      const isBelowTarget = prodAchievement < 95.0 && totalHours > 0;

      return {
        activityId: act.id,
        activityName: act.activityName,
        unit: act.unitOfMeasurement,
        targetRate: act.targetProductivityRate,
        totalPlanned: Math.round(totalPlanned * 10) / 10,
        totalActual: Math.round(totalActual * 10) / 10,
        totalLaborHours: Math.round(totalHours * 10) / 10,
        actualRate,
        prodAchievementPercent: prodAchievement,
        plannedAchievementPercent: plannedAchievement,
        isBelowTarget,
        belowTargetRecords: belowCount
      };
    });

    return res.json({
      selectedDate,
      currencySymbol: settings.currencySymbol || '₱',
      samplePeriod: {
        start: periodStart,
        end: periodEnd,
        days: SAMPLE_DAYS
      },
      workforce: {
        scheduled: scheduledCount,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        halfDay: halfDayCount
      },
      hours: {
        todayTotal: Math.round(todayTotalHours * 10) / 10,
        todayOvertime: Math.round(todayOtHours * 10) / 10,
        todayRegular: Math.round(todayRegHours * 10) / 10,
        periodTotal: Math.round(periodTotalHours * 10) / 10,
        periodOvertime: Math.round(periodOtHours * 10) / 10,
        trend: periodTrendRows
      },
      costs: {
        dailyCost: Math.round(todayCost * 100) / 100,
        mtdCost: Math.round(mtdCost * 100) / 100,
        perWorker: costPerWorkerRows,
        perTrade: costPerTradeRows
      },
      workforceByTrade: workforceByTradeRows,
      manpowerStatus: {
        active: Number(totalActiveWorkers),
        inactive: Number(totalInactiveWorkers),
        assigned: assignedCount,
        unassigned: unassignedCount,
        present: presentCount,
        absent: absentCount,
        late: lateCount,
        halfDay: halfDayCount
      },
      productivity: {
        dayAccomplishments,
        activities: activityAnalysis,
        belowTargetCount: activityAnalysis.filter(a => a.isBelowTarget).length
      }
    });
  } catch (err: any) {
    console.error('Dashboard stats error:', err);
    return res.status(500).json({ error: 'Failed to calculate dashboard statistics from Cloud SQL.' });
  }
});

// -----------------------------------------------------------------------------
// 10. AUDIT LOGS
// -----------------------------------------------------------------------------
router.get('/audit-logs', requireAuth, requirePermission('audit', 'view'), async (req, res) => {
  try {
    const moduleFilter = cleanQueryParam(req.query.module);
    const action = cleanQueryParam(req.query.action);
    const search = cleanQueryParam(req.query.search);

    const conditions: any[] = [];
    if (moduleFilter) {
      conditions.push(eq(auditLogs.module, moduleFilter));
    }
    if (action) {
      conditions.push(eq(auditLogs.action, action));
    }
    if (search) {
      const term = `%${search}%`;
      conditions.push(or(like(auditLogs.details, term), like(auditLogs.userName, term), like(auditLogs.recordId, term)));
    }

    const logs = await db.select().from(auditLogs)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(desc(auditLogs.createdAt))
      .limit(100);

    const mapped = logs.map(l => ({
      id: l.id,
      user_id: l.userId,
      userId: l.userId,
      user_name: l.userName,
      userName: l.userName,
      action: l.action,
      module: l.module,
      record_id: l.recordId,
      recordId: l.recordId,
      details: l.details,
      created_at: l.createdAt,
      createdAt: l.createdAt
    }));

    return res.json(mapped);
  } catch (err: any) {
    console.error('Error fetching audit logs:', err);
    return res.status(500).json({ error: 'Failed to retrieve audit log history.' });
  }
});

// -----------------------------------------------------------------------------
// 11. SYSTEM SETTINGS & DATABASE STATUS
// -----------------------------------------------------------------------------
router.get('/settings', requireAuth, async (req, res) => {
  try {
    const settings = await getSettings();

    const [{ value: workerCount }] = await db.select({ value: count() }).from(workers);
    const [{ value: attendanceCount }] = await db.select({ value: count() }).from(attendance);
    const [{ value: assignmentCount }] = await db.select({ value: count() }).from(dailyLaborAssignments);
    const [{ value: activityCount }] = await db.select({ value: count() }).from(workActivities);
    const [{ value: accomplishmentCount }] = await db.select({ value: count() }).from(dailyAccomplishments);
    const [{ value: userCount }] = await db.select({ value: count() }).from(users);
    const [{ value: auditCount }] = await db.select({ value: count() }).from(auditLogs);

    return res.json({
      settings: {
        id: settings.id,
        standard_daily_hours: settings.standardDailyHours,
        standardDailyHours: settings.standardDailyHours,
        normal_shift_start_time: settings.normalShiftStartTime,
        normalShiftStartTime: settings.normalShiftStartTime,
        unpaid_break_duration_minutes: settings.unpaidBreakDurationMinutes,
        unpaidBreakDurationMinutes: settings.unpaidBreakDurationMinutes,
        overtime_multiplier: settings.overtimeMultiplier,
        overtimeMultiplier: settings.overtimeMultiplier,
        half_day_threshold_hours: settings.halfDayThresholdHours,
        halfDayThresholdHours: settings.halfDayThresholdHours,
        currency_symbol: settings.currencySymbol,
        currencySymbol: settings.currencySymbol,
        company_name: settings.companyName,
        companyName: settings.companyName,
        project_name: settings.projectName,
        projectName: settings.projectName,
        sample_period_start: settings.samplePeriodStart,
        samplePeriodStart: settings.samplePeriodStart,
        sample_period_end: settings.samplePeriodEnd,
        samplePeriodEnd: settings.samplePeriodEnd
      },
      databaseStats: {
        type: 'Cloud SQL for PostgreSQL (Developer Edition / Managed Relational DB)',
        status: 'Connected & Verified Persistent',
        instance: 'ai-studio-929e2a11 (asia-southeast1)',
        database: process.env.SQL_DB_NAME || 'cloud_sql_development_database',
        counts: {
          workers: Number(workerCount),
          attendance: Number(attendanceCount),
          assignments: Number(assignmentCount),
          activities: Number(activityCount),
          accomplishments: Number(accomplishmentCount),
          users: Number(userCount),
          auditLogs: Number(auditCount)
        },
        cloudSql: {
          configured: true,
          provider: 'Google Cloud SQL (PostgreSQL)',
          region: 'asia-southeast1',
          orm: 'Drizzle ORM v0.45+ with connection pooling (pg.Pool Object Method)'
        }
      }
    });
  } catch (err: any) {
    console.error('Settings error:', err);
    return res.status(500).json({ error: 'Failed to retrieve system configuration.' });
  }
});

router.put('/settings', requireAuth, requirePermission('settings', 'edit'), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const {
      standardDailyHours,
      normalShiftStartTime,
      unpaidBreakDurationMinutes,
      overtimeMultiplier,
      halfDayThresholdHours,
      currencySymbol,
      companyName,
      projectName,
      samplePeriodStart,
      samplePeriodEnd
    } = req.body;

    const now = new Date().toISOString();
    await db.insert(systemSettings).values({
      id: 'global',
      standardDailyHours: Number(standardDailyHours) || 8.0,
      normalShiftStartTime: normalShiftStartTime || '08:00',
      unpaidBreakDurationMinutes: Number(unpaidBreakDurationMinutes) || 60,
      overtimeMultiplier: Number(overtimeMultiplier) || 1.25,
      halfDayThresholdHours: Number(halfDayThresholdHours) || 4.0,
      currencySymbol: currencySymbol || '₱',
      companyName: companyName || 'BuildPulse Infrastructure & Engineering Corp.',
      projectName: projectName || 'Metro Heights Commercial Complex Phase 2',
      samplePeriodStart: samplePeriodStart || '2026-10-20',
      samplePeriodEnd: samplePeriodEnd || '2026-10-24',
      updatedAt: now
    }).onConflictDoUpdate({
      target: systemSettings.id,
      set: {
        standardDailyHours: Number(standardDailyHours) || 8.0,
        normalShiftStartTime: normalShiftStartTime || '08:00',
        unpaidBreakDurationMinutes: Number(unpaidBreakDurationMinutes) || 60,
        overtimeMultiplier: Number(overtimeMultiplier) || 1.25,
        halfDayThresholdHours: Number(halfDayThresholdHours) || 4.0,
        currencySymbol: currencySymbol || '₱',
        companyName: companyName || 'BuildPulse Infrastructure & Engineering Corp.',
        projectName: projectName || 'Metro Heights Commercial Complex Phase 2',
        samplePeriodStart: samplePeriodStart || '2026-10-20',
        samplePeriodEnd: samplePeriodEnd || '2026-10-24',
        updatedAt: now
      }
    });

    await logAudit(req, 'SETTINGS_UPDATE', 'System Settings', 'global', 'Updated global payroll, break, and company configurations in Cloud SQL');
    return res.json({ success: true, message: 'Settings saved successfully.' });
  } catch (err: any) {
    console.error('Update settings error:', err);
    return res.status(500).json({ error: 'Failed to update system settings.' });
  }
});

router.post('/system/seed', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { forceReset } = req.body;
    const result = await seedDatabase(Boolean(forceReset));
    await logAudit(req, 'SEED_RESET', 'System Settings', 'global', `Cloud SQL Database seed executed (forceReset: ${Boolean(forceReset)})`);
    return res.json(result);
  } catch (err: any) {
    console.error('Seed error:', err);
    return res.status(500).json({ error: err.message || 'Database seeding failed.' });
  }
});

router.post('/system/sync-firestore', requireAuth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const result = await syncAllWorkersFromSqlToFirestore();
    await logAudit(req, 'SYNC_FIRESTORE', 'System Settings', 'global', `Synchronized ${result.count} workers to Firebase Firestore`);
    return res.json({
      success: true,
      message: `Synchronized ${result.count} workers to Firebase Firestore.`,
      workerIds: result.workerIds
    });
  } catch (err: any) {
    console.error('Firestore sync error:', err);
    return res.status(500).json({ error: 'Firestore sync failed: ' + err.message });
  }
});
