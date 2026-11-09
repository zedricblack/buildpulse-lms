import bcrypt from 'bcryptjs';
import { db } from './index.ts';
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
} from './schema.ts';
import { count } from 'drizzle-orm';

export const SAMPLE_DAYS = [
  '2026-10-20',
  '2026-10-21',
  '2026-10-22',
  '2026-10-23',
  '2026-10-24'
];

export async function seedDatabase(forceReset = false) {
  if (forceReset) {
    await db.delete(accomplishmentParticipants);
    await db.delete(dailyAccomplishments);
    await db.delete(dailyLaborAssignments);
    await db.delete(attendance);
    await db.delete(workActivities);
    await db.delete(workAreas);
    await db.delete(supervisors);
    await db.delete(workers);
    await db.delete(userModulePermissions);
    await db.delete(users);
    await db.delete(systemSettings);
    await db.delete(auditLogs);
  }

  // Check if already seeded
  const [{ value: workerCount }] = await db.select({ value: count() }).from(workers);
  if (Number(workerCount) >= 15 && !forceReset) {
    return { seeded: false, message: 'Database already seeded with demo data.' };
  }

  const now = new Date().toISOString();

  // 1. System Settings
  await db.insert(systemSettings).values({
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
    samplePeriodEnd: '2026-10-24',
    updatedAt: now
  }).onConflictDoUpdate({
    target: systemSettings.id,
    set: { updatedAt: now }
  });

  // 2. Initial Users & Passwords (bcrypt)
  const adminPassHash = await bcrypt.hash('AdminPass123!', 10);
  const userPassHash = await bcrypt.hash('UserPass123!', 10);

  await db.insert(users).values([
    {
      id: 'usr_admin_01',
      uid: 'firebase_admin_default',
      email: 'admin@buildpulse.lms',
      passwordHash: adminPassHash,
      fullName: 'Engr. David Vance (System Admin)',
      role: 'admin',
      accountStatus: 'active',
      createdAt: now,
      lastLoginAt: now
    },
    {
      id: 'usr_siteeng_01',
      uid: 'firebase_user_default',
      email: 'user@buildpulse.lms',
      passwordHash: userPassHash,
      fullName: 'Engr. Sarah Jenkins (Site Engineer)',
      role: 'user',
      accountStatus: 'active',
      createdAt: now,
      lastLoginAt: now
    }
  ]).onConflictDoNothing();

  // 3. Module Permissions
  const modules = [
    'dashboard',
    'workers',
    'attendance',
    'assignments',
    'activities',
    'accomplishments',
    'reports',
    'users',
    'audit',
    'settings'
  ];

  for (const m of modules) {
    await db.insert(userModulePermissions).values({
      id: `perm_admin_${m}`,
      userId: 'usr_admin_01',
      moduleKey: m,
      canView: 1,
      canCreate: 1,
      canEdit: 1,
      canDelete: 1
    }).onConflictDoNothing();

    const isOp = ['attendance', 'assignments', 'accomplishments', 'workers'].includes(m);
    const isViewOnly = ['dashboard', 'reports', 'activities'].includes(m);
    await db.insert(userModulePermissions).values({
      id: `perm_user_${m}`,
      userId: 'usr_siteeng_01',
      moduleKey: m,
      canView: (isOp || isViewOnly) ? 1 : 0,
      canCreate: isOp ? 1 : 0,
      canEdit: isOp ? 1 : 0,
      canDelete: 0
    }).onConflictDoNothing();
  }

  // 4. Supervisors (4 supervisors)
  const supervisorList = [
    { id: 'SUP-001', fullName: 'Engr. Roberto Santos', contactNumber: '+63 917 555 0101', email: 'roberto.santos@buildpulse.com', roleTitle: 'Project Manager', createdAt: now },
    { id: 'SUP-002', fullName: 'Engr. Maria Clara Reyes', contactNumber: '+63 918 555 0202', email: 'maria.reyes@buildpulse.com', roleTitle: 'Site Civil Engineer', createdAt: now },
    { id: 'SUP-003', fullName: 'Danilo Cruz', contactNumber: '+63 920 555 0303', email: 'danilo.cruz@buildpulse.com', roleTitle: 'General Foreman', createdAt: now },
    { id: 'SUP-004', fullName: 'Engr. Jonathan Lim', contactNumber: '+63 922 555 0404', email: 'jonathan.lim@buildpulse.com', roleTitle: 'MEP Engineer', createdAt: now },
  ];
  await db.insert(supervisors).values(supervisorList).onConflictDoNothing();

  // 5. Work Areas (6 locations)
  const workAreaList = [
    { id: 'AREA-01', areaName: 'Foundation Zone A', description: 'Deep excavation, ground beams & mat foundation zone', status: 'Active', createdAt: now },
    { id: 'AREA-02', areaName: 'Tower 1 - Level 2', description: 'Structural suspended columns, beams, and elevated slab pouring', status: 'Active', createdAt: now },
    { id: 'AREA-03', areaName: 'Perimeter Drainage', description: 'Retaining walls, underground drainage box culverts, and backfill', status: 'Active', createdAt: now },
    { id: 'AREA-04', areaName: 'Basement Level 1', description: 'MEP rough-ins, underground utility conduits, and storm drainage', status: 'Active', createdAt: now },
    { id: 'AREA-05', areaName: 'Main Commercial Lobby', description: 'Architectural finishes, tile setting, plastering, and ceiling works', status: 'Active', createdAt: now },
    { id: 'AREA-06', areaName: 'Electrical Shaft East', description: 'Cable tray layout, electrical panel boards, and busduct installation', status: 'Active', createdAt: now },
  ];
  await db.insert(workAreas).values(workAreaList).onConflictDoNothing();

  // 6. Work Activities (10 unique activities with target productivity benchmarks)
  const activityList = [
    { id: 'ACT-01', activityName: 'Excavation & Soil Compaction', descriptionOfWork: 'Earthmoving and foundation trench excavation using manual and backhoe support', unitOfMeasurement: 'm³', targetProductivityRate: 3.5, activityStatus: 'Active', createdAt: now },
    { id: 'ACT-02', activityName: 'Reinforcement Steel Installation', descriptionOfWork: 'Cutting, bending, fixing and tying reinforcing deformed steel bars for structural members', unitOfMeasurement: 'kg', targetProductivityRate: 45.0, activityStatus: 'Active', createdAt: now },
    { id: 'ACT-03', activityName: 'Formwork Fabrication & Installation', descriptionOfWork: 'Erecting phenolic plywood and steel scaffolding shuttering for cast-in-place concrete', unitOfMeasurement: 'm²', targetProductivityRate: 1.8, activityStatus: 'Active', createdAt: now },
    { id: 'ACT-04', activityName: 'Concrete Pouring & Consolidation', descriptionOfWork: 'Placing ready-mix concrete with mechanical vibration and leveling for slabs and columns', unitOfMeasurement: 'm³', targetProductivityRate: 2.2, activityStatus: 'Active', createdAt: now },
    { id: 'ACT-05', activityName: 'Concrete Masonry Unit (CMU) Laying', descriptionOfWork: 'Laying 150mm and 100mm concrete hollow blocks with structural mortar jointing', unitOfMeasurement: 'm²', targetProductivityRate: 1.5, activityStatus: 'Active', createdAt: now },
    { id: 'ACT-06', activityName: 'Cement Plastering Finishes', descriptionOfWork: 'Application of two-coat scratch and brown cement plaster on interior and exterior walls', unitOfMeasurement: 'm²', targetProductivityRate: 2.5, activityStatus: 'Active', createdAt: now },
    { id: 'ACT-07', activityName: 'Electrical Conduit & Box Rough-in', descriptionOfWork: 'Embedding uPVC electrical conduit runs, junction boxes, and pulling fish wires', unitOfMeasurement: 'm', targetProductivityRate: 4.0, activityStatus: 'Active', createdAt: now },
    { id: 'ACT-08', activityName: 'Sanitary & Water Pipe Installation', descriptionOfWork: 'Installation of PPR cold water supply lines and PVC sewer drainage runs', unitOfMeasurement: 'm', targetProductivityRate: 3.2, activityStatus: 'Active', createdAt: now },
    { id: 'ACT-09', activityName: 'Floor Tile Laying & Grouting', descriptionOfWork: 'Installation of 60x60cm vitrified porcelain tiles with heavy-duty adhesive and grout', unitOfMeasurement: 'm²', targetProductivityRate: 1.2, activityStatus: 'Active', createdAt: now },
    { id: 'ACT-10', activityName: 'Wall Priming & Painting Application', descriptionOfWork: 'Surface preparation, neutralizer, acrylic primer coat, and topcoat wall painting', unitOfMeasurement: 'm²', targetProductivityRate: 6.0, activityStatus: 'Active', createdAt: now },
  ];
  await db.insert(workActivities).values(activityList).onConflictDoNothing();

  // 7. Workers Master Data (15 unique workers across trades)
  const workerList = [
    { id: 'WRK-1001', completeName: 'Ramon Gutierrez', age: 38, contactNumber: '+63 917 111 0001', trade: 'Mason', employmentType: 'Regular', dailyWageRate: 650.0, employmentStatus: 'Active', dateHired: '2024-01-15', createdAt: now },
    { id: 'WRK-1002', completeName: 'Danilo Santos', age: 42, contactNumber: '+63 917 111 0002', trade: 'Carpenter', employmentType: 'Regular', dailyWageRate: 620.0, employmentStatus: 'Active', dateHired: '2024-02-01', createdAt: now },
    { id: 'WRK-1003', completeName: 'Eduardo Reyes', age: 35, contactNumber: '+63 917 111 0003', trade: 'Electrician', employmentType: 'Regular', dailyWageRate: 750.0, employmentStatus: 'Active', dateHired: '2024-01-20', createdAt: now },
    { id: 'WRK-1004', completeName: 'Jaime Mendoza', age: 40, contactNumber: '+63 917 111 0004', trade: 'Plumber', employmentType: 'Regular', dailyWageRate: 700.0, employmentStatus: 'Active', dateHired: '2024-03-10', createdAt: now },
    { id: 'WRK-1005', completeName: 'Carlos Bautista', age: 26, contactNumber: '+63 917 111 0005', trade: 'General Laborer', employmentType: 'Daily Wage', dailyWageRate: 500.0, employmentStatus: 'Active', dateHired: '2025-05-12', createdAt: now },
    { id: 'WRK-1006', completeName: 'Jonathan Villanueva', age: 33, contactNumber: '+63 917 111 0006', trade: 'Welder', employmentType: 'Contractual', dailyWageRate: 780.0, employmentStatus: 'Active', dateHired: '2024-06-01', createdAt: now },
    { id: 'WRK-1007', completeName: 'Rodrigo Dela Cruz', age: 39, contactNumber: '+63 917 111 0007', trade: 'Steelman', employmentType: 'Regular', dailyWageRate: 680.0, employmentStatus: 'Active', dateHired: '2024-01-10', createdAt: now },
    { id: 'WRK-1008', completeName: 'Ferdinand Aquino', age: 31, contactNumber: '+63 917 111 0008', trade: 'Painter', employmentType: 'Contractual', dailyWageRate: 600.0, employmentStatus: 'Active', dateHired: '2025-02-14', createdAt: now },
    { id: 'WRK-1009', completeName: 'Michael Soriano', age: 29, contactNumber: '+63 917 111 0009', trade: 'Tile Setter', employmentType: 'Regular', dailyWageRate: 650.0, employmentStatus: 'Active', dateHired: '2024-08-20', createdAt: now },
    { id: 'WRK-1010', completeName: 'Antonio Morales', age: 45, contactNumber: '+63 917 111 0010', trade: 'Heavy Equipment Operator', employmentType: 'Regular', dailyWageRate: 850.0, employmentStatus: 'Active', dateHired: '2023-11-05', createdAt: now },
    { id: 'WRK-1011', completeName: 'Manuel Pascual', age: 37, contactNumber: '+63 917 111 0011', trade: 'Mason', employmentType: 'Contractual', dailyWageRate: 650.0, employmentStatus: 'Active', dateHired: '2025-01-10', createdAt: now },
    { id: 'WRK-1012', completeName: 'Vicente Ramos', age: 41, contactNumber: '+63 917 111 0012', trade: 'Carpenter', employmentType: 'Regular', dailyWageRate: 620.0, employmentStatus: 'Active', dateHired: '2024-04-18', createdAt: now },
    { id: 'WRK-1013', completeName: 'Arnel Castro', age: 34, contactNumber: '+63 917 111 0013', trade: 'Steelman', employmentType: 'Contractual', dailyWageRate: 680.0, employmentStatus: 'Active', dateHired: '2025-03-01', createdAt: now },
    { id: 'WRK-1014', completeName: 'Gabriel Navarro', age: 24, contactNumber: '+63 917 111 0014', trade: 'General Laborer', employmentType: 'Daily Wage', dailyWageRate: 500.0, employmentStatus: 'Active', dateHired: '2025-06-20', createdAt: now },
    { id: 'WRK-1015', completeName: 'Roberto Diaz', age: 36, contactNumber: '+63 917 111 0015', trade: 'Electrician', employmentType: 'Regular', dailyWageRate: 750.0, employmentStatus: 'Active', dateHired: '2024-09-01', createdAt: now },
  ];
  await db.insert(workers).values(workerList).onConflictDoNothing();

  // 8. 75 Attendance Records (15 workers x 5 days)
  const attendancePatterns: Record<string, Record<string, { in: string | null; out: string | null; status: string; total: number; ot: number; remarks: string }>> = {
    '2026-10-20': {
      'WRK-1001': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1002': { in: '08:00', out: '19:00', status: 'Present', total: 10.0, ot: 2.0, remarks: 'Overtime - Formwork preparation' },
      'WRK-1003': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1004': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1005': { in: '08:35', out: '17:00', status: 'Late', total: 7.4, ot: 0, remarks: 'Late arrival - Traffic delay' },
      'WRK-1006': { in: '08:00', out: '19:00', status: 'Present', total: 10.0, ot: 2.0, remarks: 'Overtime - Structural welding' },
      'WRK-1007': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1008': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1009': { in: '08:00', out: '12:00', status: 'Half-Day', total: 4.0, ot: 0, remarks: 'Half-day - Scheduled clinic appointment' },
      'WRK-1010': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1011': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1012': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1013': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1014': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1015': { in: null, out: null, status: 'Absent', total: 0, ot: 0, remarks: 'Unexcused absence' },
    },
    '2026-10-21': {
      'WRK-1001': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1002': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1003': { in: '08:00', out: '19:00', status: 'Present', total: 10.0, ot: 2.0, remarks: 'Overtime - Emergency conduit repair' },
      'WRK-1004': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1005': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1006': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1007': { in: '08:00', out: '19:00', status: 'Present', total: 10.0, ot: 2.0, remarks: 'Overtime - Mat footing rebar tied' },
      'WRK-1008': { in: '08:40', out: '17:00', status: 'Late', total: 7.3, ot: 0, remarks: 'Late - Public transport delay' },
      'WRK-1009': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1010': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1011': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1012': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1013': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1014': { in: null, out: null, status: 'Absent', total: 0, ot: 0, remarks: 'Personal emergency' },
      'WRK-1015': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'Reported to site' },
    },
    '2026-10-22': {
      'WRK-1001': { in: '08:00', out: '19:00', status: 'Present', total: 10.0, ot: 2.0, remarks: 'Overtime - Block laying target' },
      'WRK-1002': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1003': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1004': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1005': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1006': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1007': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1008': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1009': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1010': { in: '08:00', out: '19:00', status: 'Present', total: 10.0, ot: 2.0, remarks: 'Overtime - Earth filling compaction' },
      'WRK-1011': { in: '08:30', out: '17:00', status: 'Late', total: 7.5, ot: 0, remarks: 'Late - Heavy rain' },
      'WRK-1012': { in: '08:00', out: '12:00', status: 'Half-Day', total: 4.0, ot: 0, remarks: 'Half-day approved' },
      'WRK-1013': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1014': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'Returned to site' },
      'WRK-1015': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
    },
    '2026-10-23': {
      'WRK-1001': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1002': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1003': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1004': { in: '08:00', out: '19:00', status: 'Present', total: 10.0, ot: 2.0, remarks: 'Overtime - Hydro-testing leak test' },
      'WRK-1005': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1006': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1007': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1008': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1009': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1010': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1011': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1012': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1013': { in: null, out: null, status: 'Absent', total: 0, ot: 0, remarks: 'Sick leave - Medical certificate submitted' },
      'WRK-1014': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1015': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
    },
    '2026-10-24': {
      'WRK-1001': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1002': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1003': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1004': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1005': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1006': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1007': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1008': { in: '08:00', out: '12:00', status: 'Half-Day', total: 4.0, ot: 0, remarks: 'Half-day - Family errand' },
      'WRK-1009': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1010': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1011': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1012': { in: '08:35', out: '17:00', status: 'Late', total: 7.4, ot: 0, remarks: 'Late - Vehicle breakdown' },
      'WRK-1013': { in: '08:00', out: '19:00', status: 'Present', total: 10.0, ot: 2.0, remarks: 'Overtime - Beam stirrup tying' },
      'WRK-1014': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
      'WRK-1015': { in: '08:00', out: '17:00', status: 'Present', total: 8.0, ot: 0, remarks: 'On time' },
    }
  };

  const workerMap = new Map(workerList.map(w => [w.id, w]));
  let attIndex = 1;
  const attendanceList = [];

  for (const date of SAMPLE_DAYS) {
    for (const w of workerList) {
      const attId = `ATT-${date.replace(/-/g, '')}-${String(attIndex++).padStart(3, '0')}`;
      const pat = attendancePatterns[date][w.id];
      const regularHours = Math.min(pat.total, 8.0);
      const otHours = pat.ot;
      const hourlyRate = w.dailyWageRate / 8.0;
      const regPay = regularHours * hourlyRate;
      const otPay = otHours * hourlyRate * 1.25;
      const totalPay = Math.round((regPay + otPay) * 100) / 100;

      attendanceList.push({
        id: attId,
        workerId: w.id,
        date,
        timeIn: pat.in,
        timeOut: pat.out,
        attendanceStatus: pat.status,
        totalHoursWorked: pat.total,
        overtimeHours: otHours,
        regularHours,
        calculatedPay: totalPay,
        remarks: pat.remarks,
        createdAt: now
      });
    }
  }
  await db.insert(attendance).values(attendanceList).onConflictDoNothing();

  // 9. 75 Daily Labor Assignments (15 workers x 5 days)
  const assignmentConfigs: Record<string, { act: string; area: string; sup: string; notes: string }> = {
    'WRK-1001': { act: 'ACT-05', area: 'AREA-05', sup: 'SUP-003', notes: 'Exterior wall CMU laying' },
    'WRK-1002': { act: 'ACT-03', area: 'AREA-02', sup: 'SUP-002', notes: 'Column formwork scaffolding erection' },
    'WRK-1003': { act: 'ACT-07', area: 'AREA-04', sup: 'SUP-004', notes: 'Basement cable raceways rough-ins' },
    'WRK-1004': { act: 'ACT-08', area: 'AREA-04', sup: 'SUP-004', notes: 'Sewer stacks and water riser install' },
    'WRK-1005': { act: 'ACT-01', area: 'AREA-01', sup: 'SUP-001', notes: 'Site grading and manual debris clearing' },
    'WRK-1006': { act: 'ACT-02', area: 'AREA-02', sup: 'SUP-002', notes: 'Welded wire mesh and column joint welding' },
    'WRK-1007': { act: 'ACT-02', area: 'AREA-02', sup: 'SUP-002', notes: 'Beam rebar cage fabrication and tying' },
    'WRK-1008': { act: 'ACT-10', area: 'AREA-05', sup: 'SUP-003', notes: 'Surface skimming and primer rolling' },
    'WRK-1009': { act: 'ACT-09', area: 'AREA-05', sup: 'SUP-003', notes: 'Lobby granite tile installation' },
    'WRK-1010': { act: 'ACT-01', area: 'AREA-03', sup: 'SUP-001', notes: 'Excavator ditch digging and soil haulage' },
    'WRK-1011': { act: 'ACT-06', area: 'AREA-05', sup: 'SUP-003', notes: 'Wall plastering leveling coat' },
    'WRK-1012': { act: 'ACT-03', area: 'AREA-02', sup: 'SUP-002', notes: 'Elevated slab decking alignment' },
    'WRK-1013': { act: 'ACT-02', area: 'AREA-02', sup: 'SUP-002', notes: 'Slab top and bottom mesh tying' },
    'WRK-1014': { act: 'ACT-04', area: 'AREA-02', sup: 'SUP-002', notes: 'Concrete chute guidance and vibration' },
    'WRK-1015': { act: 'ACT-07', area: 'AREA-06', sup: 'SUP-004', notes: 'Switchgear raceway conduit assembly' },
  };

  let asnIndex = 1;
  const assignmentList = [];
  for (const date of SAMPLE_DAYS) {
    for (const w of workerList) {
      const asnId = `ASN-${date.replace(/-/g, '')}-${String(asnIndex++).padStart(3, '0')}`;
      const cfg = assignmentConfigs[w.id];
      const status = date === '2026-10-24' ? 'In Progress' : 'Completed';
      assignmentList.push({
        id: asnId,
        date,
        workerId: w.id,
        activityId: cfg.act,
        workAreaId: cfg.area,
        supervisorId: cfg.sup,
        assignmentStatus: status,
        notes: cfg.notes,
        createdAt: now
      });
    }
  }
  await db.insert(dailyLaborAssignments).values(assignmentList).onConflictDoNothing();

  // 10. Accomplishments across 5 days
  const accomplishmentData = [
    { id: 'ACC-20261020-001', date: '2026-10-20', actId: 'ACT-02', areaId: 'AREA-02', planned: 700.0, actual: 760.0, unit: 'kg', hours: 16.0, workers: ['WRK-1006', 'WRK-1007'], remarks: 'Fast rebar tying pace for main tower shear wall' },
    { id: 'ACC-20261020-002', date: '2026-10-20', actId: 'ACT-03', areaId: 'AREA-02', planned: 30.0, actual: 32.4, unit: 'm²', hours: 18.0, workers: ['WRK-1002', 'WRK-1012'], remarks: 'Column formwork erected ahead of concrete schedule' },
    { id: 'ACC-20261020-003', date: '2026-10-20', actId: 'ACT-01', areaId: 'AREA-03', planned: 35.0, actual: 22.0, unit: 'm³', hours: 8.0, workers: ['WRK-1010'], remarks: 'Encountered unexpected boulder formations slowing down excavation' },
    { id: 'ACC-20261020-004', date: '2026-10-20', actId: 'ACT-05', areaId: 'AREA-05', planned: 12.0, actual: 12.0, unit: 'm²', hours: 8.0, workers: ['WRK-1001'], remarks: 'CMU wall laying met target exactly' },
    { id: 'ACC-20261021-001', date: '2026-10-21', actId: 'ACT-02', areaId: 'AREA-02', planned: 800.0, actual: 880.0, unit: 'kg', hours: 18.0, workers: ['WRK-1006', 'WRK-1007'], remarks: 'Elevated slab reinforcement completed smoothly' },
    { id: 'ACC-20261021-002', date: '2026-10-21', actId: 'ACT-07', areaId: 'AREA-04', planned: 40.0, actual: 44.0, unit: 'm', hours: 10.0, workers: ['WRK-1003'], remarks: 'Conduit bending and pipe threading executed quickly' },
    { id: 'ACC-20261021-003', date: '2026-10-21', actId: 'ACT-10', areaId: 'AREA-05', planned: 48.0, actual: 32.0, unit: 'm²', hours: 7.3, workers: ['WRK-1008'], remarks: 'High ambient humidity delayed drying time for wall surface' },
    { id: 'ACC-20261022-001', date: '2026-10-22', actId: 'ACT-01', areaId: 'AREA-03', planned: 40.0, actual: 42.0, unit: 'm³', hours: 10.0, workers: ['WRK-1010'], remarks: 'Drainage trench excavation completed with rock breaker attachment' },
    { id: 'ACC-20261022-002', date: '2026-10-22', actId: 'ACT-05', areaId: 'AREA-05', planned: 15.0, actual: 16.5, unit: 'm²', hours: 10.0, workers: ['WRK-1001'], remarks: 'Extended shift allowed team to complete entire partition section' },
    { id: 'ACC-20261022-003', date: '2026-10-22', actId: 'ACT-06', areaId: 'AREA-05', planned: 20.0, actual: 14.0, unit: 'm²', hours: 7.5, workers: ['WRK-1011'], remarks: 'Uneven blockwork required thicker base coat application' },
    { id: 'ACC-20261023-001', date: '2026-10-23', actId: 'ACT-08', areaId: 'AREA-04', planned: 32.0, actual: 35.0, unit: 'm', hours: 10.0, workers: ['WRK-1004'], remarks: 'PPR water line jointing and pressure test passed inspection' },
    { id: 'ACC-20261023-002', date: '2026-10-23', actId: 'ACT-03', areaId: 'AREA-02', planned: 28.0, actual: 29.5, unit: 'm²', hours: 16.0, workers: ['WRK-1002', 'WRK-1012'], remarks: 'Slab edge formwork stripped and repositioned for grid 4' },
    { id: 'ACC-20261023-003', date: '2026-10-23', actId: 'ACT-09', areaId: 'AREA-05', planned: 10.0, actual: 10.4, unit: 'm²', hours: 8.0, workers: ['WRK-1009'], remarks: 'Lobby tile layout aligned to central column axes' },
    { id: 'ACC-20261024-001', date: '2026-10-24', actId: 'ACT-02', areaId: 'AREA-02', planned: 720.0, actual: 780.0, unit: 'kg', hours: 16.0, workers: ['WRK-1006', 'WRK-1007'], remarks: 'Grid 5 cantilever reinforcement fully placed and inspected' },
    { id: 'ACC-20261024-002', date: '2026-10-24', actId: 'ACT-07', areaId: 'AREA-06', planned: 32.0, actual: 20.0, unit: 'm', hours: 8.0, workers: ['WRK-1015'], remarks: 'Conduit bends constrained by structural duct congestion' },
    { id: 'ACC-20261024-003', date: '2026-10-24', actId: 'ACT-09', areaId: 'AREA-05', planned: 9.6, actual: 10.2, unit: 'm²', hours: 8.0, workers: ['WRK-1009'], remarks: 'Main entrance tile threshold completed and cured' }
  ];

  const actMap = new Map(activityList.map(a => [a.id, a]));
  let partIndex = 1;

  for (const acc of accomplishmentData) {
    const act = actMap.get(acc.actId)!;
    const actualProdRate = Math.round((acc.actual / acc.hours) * 100) / 100;
    const prodAchPercent = Math.round((actualProdRate / act.targetProductivityRate) * 1000) / 10;
    const planAchPercent = Math.round((acc.actual / acc.planned) * 1000) / 10;

    let perfStatus: 'Above Target' | 'Met Target' | 'Below Target';
    if (prodAchPercent >= 105.0) {
      perfStatus = 'Above Target';
    } else if (prodAchPercent >= 95.0) {
      perfStatus = 'Met Target';
    } else {
      perfStatus = 'Below Target';
    }

    await db.insert(dailyAccomplishments).values({
      id: acc.id,
      date: acc.date,
      activityId: acc.actId,
      workAreaId: acc.areaId,
      plannedQuantity: acc.planned,
      actualQuantity: acc.actual,
      unitOfMeasurement: acc.unit,
      actualLaborHours: acc.hours,
      actualProductivityRate: actualProdRate,
      productivityAchievementPercent: prodAchPercent,
      plannedAchievementPercent: planAchPercent,
      performanceStatus: perfStatus,
      remarks: acc.remarks,
      createdAt: now
    }).onConflictDoNothing();

    for (const wId of acc.workers) {
      const partId = `PART-${String(partIndex++).padStart(4, '0')}`;
      const hoursPerWorker = acc.hours / acc.workers.length;
      await db.insert(accomplishmentParticipants).values({
        id: partId,
        accomplishmentId: acc.id,
        workerId: wId,
        assignmentId: null,
        hoursContributed: hoursPerWorker
      }).onConflictDoNothing();
    }
  }

  // 11. Initial Audit Logs
  const auditLogEntries = [
    { action: 'SEED_RESET', module: 'System Settings', recordId: 'global', details: 'System initialized on Cloud SQL (PostgreSQL) with baseline demonstration dataset (15 workers, 75 attendances, 75 assignments, 10 activities, 16 accomplishments)' },
    { action: 'CREATE', module: 'User Management', recordId: 'usr_admin_01', details: 'Provisioned default Administrator account (admin@buildpulse.lms) with full RBAC access' },
    { action: 'CREATE', module: 'User Management', recordId: 'usr_siteeng_01', details: 'Provisioned standard Site Engineer account (user@buildpulse.lms) with operational workforce permissions' },
    { action: 'CREATE', module: 'Worker Master Data', recordId: 'WRK-1001_TO_1015', details: 'Registered 15 certified construction trade workers with base daily wage rates' },
    { action: 'CREATE', module: 'Work Activity Master Data', recordId: 'ACT-01_TO_10', details: 'Configured 10 construction work activities with target productivity benchmarks' },
  ];

  let logIdx = 1;
  for (const log of auditLogEntries) {
    await db.insert(auditLogs).values({
      id: `LOG-${now.substring(0, 10).replace(/-/g, '')}-${String(logIdx++).padStart(3, '0')}`,
      userId: 'usr_admin_01',
      userName: 'System Provisioner',
      action: log.action,
      module: log.module,
      recordId: log.recordId,
      details: log.details,
      createdAt: now
    }).onConflictDoNothing();
  }

  return {
    seeded: true,
    message: 'Successfully seeded Cloud SQL PostgreSQL database with 15 workers, 75 attendances, 75 assignments, 10 activities, accomplishments, and initial accounts.'
  };
}
