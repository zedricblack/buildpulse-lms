import bcrypt from 'bcryptjs';
import { db } from './db.js';

export const SAMPLE_DAYS = [
  '2026-10-20',
  '2026-10-21',
  '2026-10-22',
  '2026-10-23',
  '2026-10-24'
];

export async function seedDatabase(forceReset = false) {
  if (forceReset) {
    db.exec(`
      DELETE FROM accomplishment_participants;
      DELETE FROM daily_accomplishments;
      DELETE FROM daily_labor_assignments;
      DELETE FROM attendance;
      DELETE FROM work_activities;
      DELETE FROM work_areas;
      DELETE FROM supervisors;
      DELETE FROM workers;
      DELETE FROM user_module_permissions;
      DELETE FROM users;
      DELETE FROM system_settings;
      DELETE FROM audit_logs;
    `);
  }

  // Check if already seeded
  const workerCount = (db.prepare('SELECT COUNT(*) as count FROM workers').get() as { count: number }).count;
  if (workerCount >= 15 && !forceReset) {
    return { seeded: false, message: 'Database already seeded with demo data.' };
  }

  const now = new Date().toISOString();

  // 1. System Settings
  db.prepare(`
    INSERT OR REPLACE INTO system_settings (
      id, standard_daily_hours, normal_shift_start_time, unpaid_break_duration_minutes,
      overtime_multiplier, half_day_threshold_hours, currency_symbol,
      company_name, project_name, sample_period_start, sample_period_end, updated_at
    ) VALUES (
      'global', 8.0, '08:00', 60, 1.25, 4.0, '₱',
      'BuildPulse Infrastructure & Engineering Corp.',
      'Metro Heights Commercial Complex Phase 2',
      '2026-10-20', '2026-10-24', ?
    )
  `).run(now);

  // 2. Initial Users & Passwords (bcrypt)
  const adminPassHash = await bcrypt.hash('AdminPass123!', 10);
  const userPassHash = await bcrypt.hash('UserPass123!', 10);

  db.prepare(`
    INSERT OR REPLACE INTO users (id, email, password_hash, full_name, role, account_status, created_at)
    VALUES
      ('usr_admin_01', 'admin@buildpulse.lms', ?, 'Engr. David Vance (System Admin)', 'admin', 'active', ?),
      ('usr_siteeng_01', 'user@buildpulse.lms', ?, 'Engr. Sarah Jenkins (Site Engineer)', 'user', 'active', ?)
  `).run(adminPassHash, now, userPassHash, now);

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

  const insertPerm = db.prepare(`
    INSERT OR REPLACE INTO user_module_permissions (id, user_id, module_key, can_view, can_create, can_edit, can_delete)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  // Admin gets 1 on everything
  for (const m of modules) {
    insertPerm.run(`perm_admin_${m}`, 'usr_admin_01', m, 1, 1, 1, 1);
  }

  // Standard User gets operational permissions (view all operational, create/edit attendance & assignments, view-only on others, no user/settings/audit access)
  for (const m of modules) {
    if (m === 'dashboard' || m === 'reports') {
      insertPerm.run(`perm_user_${m}`, 'usr_siteeng_01', m, 1, 0, 0, 0);
    } else if (m === 'attendance' || m === 'assignments' || m === 'accomplishments' || m === 'workers') {
      insertPerm.run(`perm_user_${m}`, 'usr_siteeng_01', m, 1, 1, 1, 0);
    } else if (m === 'activities') {
      insertPerm.run(`perm_user_${m}`, 'usr_siteeng_01', m, 1, 0, 0, 0); // view-only
    } else {
      insertPerm.run(`perm_user_${m}`, 'usr_siteeng_01', m, 0, 0, 0, 0); // no access to users, settings, audit
    }
  }

  // 4. Supervisors (4 supervisors)
  const supervisors = [
    { id: 'SUP-001', name: 'Engr. Roberto Santos', contact: '+63 917 555 0101', email: 'roberto.santos@buildpulse.com', role: 'Project Manager' },
    { id: 'SUP-002', name: 'Engr. Maria Clara Reyes', contact: '+63 918 555 0202', email: 'maria.reyes@buildpulse.com', role: 'Site Civil Engineer' },
    { id: 'SUP-003', name: 'Danilo Cruz', contact: '+63 920 555 0303', email: 'danilo.cruz@buildpulse.com', role: 'General Foreman' },
    { id: 'SUP-004', name: 'Engr. Jonathan Lim', contact: '+63 922 555 0404', email: 'jonathan.lim@buildpulse.com', role: 'MEP Engineer' },
  ];

  const insertSup = db.prepare(`
    INSERT OR REPLACE INTO supervisors (id, full_name, contact_number, email, role_title, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  for (const s of supervisors) {
    insertSup.run(s.id, s.name, s.contact, s.email, s.role, now);
  }

  // 5. Work Areas (6 work locations)
  const workAreas = [
    { id: 'AREA-01', name: 'Foundation Zone A', desc: 'Deep excavation, ground beams & mat foundation zone' },
    { id: 'AREA-02', name: 'Tower 1 - Level 2', desc: 'Structural suspended columns, beams, and elevated slab pouring' },
    { id: 'AREA-03', name: 'Perimeter Drainage', desc: 'Retaining walls, underground drainage box culverts, and backfill' },
    { id: 'AREA-04', name: 'Basement Level 1', desc: 'MEP rough-ins, underground utility conduits, and storm drainage' },
    { id: 'AREA-05', name: 'Main Commercial Lobby', desc: 'Architectural finishes, tile setting, plastering, and ceiling works' },
    { id: 'AREA-06', name: 'Electrical Shaft East', desc: 'Cable tray layout, electrical panel boards, and busduct installation' },
  ];

  const insertArea = db.prepare(`
    INSERT OR REPLACE INTO work_areas (id, area_name, description, status, created_at)
    VALUES (?, ?, ?, 'Active', ?)
  `);
  for (const a of workAreas) {
    insertArea.run(a.id, a.name, a.desc, now);
  }

  // 6. Work Activities (10 unique activities with target productivity rates per labor-hour)
  const activities = [
    { id: 'ACT-01', name: 'Excavation & Soil Compaction', desc: 'Earthmoving and foundation trench excavation using manual and backhoe support', unit: 'm³', target: 3.5 },
    { id: 'ACT-02', name: 'Reinforcement Steel Installation', desc: 'Cutting, bending, fixing and tying reinforcing deformed steel bars for structural members', unit: 'kg', target: 45.0 },
    { id: 'ACT-03', name: 'Formwork Fabrication & Installation', desc: 'Erecting phenolic plywood and steel scaffolding shuttering for cast-in-place concrete', unit: 'm²', target: 1.8 },
    { id: 'ACT-04', name: 'Concrete Pouring & Consolidation', desc: 'Placing ready-mix concrete with mechanical vibration and leveling for slabs and columns', unit: 'm³', target: 2.2 },
    { id: 'ACT-05', name: 'Concrete Masonry Unit (CMU) Laying', desc: 'Laying 150mm and 100mm concrete hollow blocks with structural mortar jointing', unit: 'm²', target: 1.5 },
    { id: 'ACT-06', name: 'Cement Plastering Finishes', desc: 'Application of two-coat scratch and brown cement plaster on interior and exterior walls', unit: 'm²', target: 2.5 },
    { id: 'ACT-07', name: 'Electrical Conduit & Box Rough-in', desc: 'Embedding uPVC electrical conduit runs, junction boxes, and pulling fish wires', unit: 'm', target: 4.0 },
    { id: 'ACT-08', name: 'Sanitary & Water Pipe Installation', desc: 'Installation of PPR cold water supply lines and PVC sewer drainage runs', unit: 'm', target: 3.2 },
    { id: 'ACT-09', name: 'Floor Tile Laying & Grouting', desc: 'Installation of 60x60cm vitrified porcelain tiles with heavy-duty adhesive and grout', unit: 'm²', target: 1.2 },
    { id: 'ACT-10', name: 'Wall Priming & Painting Application', desc: 'Surface preparation, neutralizer, acrylic primer coat, and topcoat wall painting', unit: 'm²', target: 6.0 },
  ];

  const insertAct = db.prepare(`
    INSERT OR REPLACE INTO work_activities (id, activity_name, description_of_work, unit_of_measurement, target_productivity_rate, activity_status, created_at)
    VALUES (?, ?, ?, ?, ?, 'Active', ?)
  `);
  for (const act of activities) {
    insertAct.run(act.id, act.name, act.desc, act.unit, act.target, now);
  }

  // 7. Workers Master Data (15 unique workers representing different trades)
  const workers = [
    { id: 'WRK-1001', name: 'Ramon Gutierrez', age: 38, contact: '+63 917 111 0001', trade: 'Mason', type: 'Regular', wage: 650.0, status: 'Active', hired: '2024-01-15' },
    { id: 'WRK-1002', name: 'Danilo Santos', age: 42, contact: '+63 917 111 0002', trade: 'Carpenter', type: 'Regular', wage: 620.0, status: 'Active', hired: '2024-02-01' },
    { id: 'WRK-1003', name: 'Eduardo Reyes', age: 35, contact: '+63 917 111 0003', trade: 'Electrician', type: 'Regular', wage: 750.0, status: 'Active', hired: '2024-01-20' },
    { id: 'WRK-1004', name: 'Jaime Mendoza', age: 40, contact: '+63 917 111 0004', trade: 'Plumber', type: 'Regular', wage: 700.0, status: 'Active', hired: '2024-03-10' },
    { id: 'WRK-1005', name: 'Carlos Bautista', age: 26, contact: '+63 917 111 0005', trade: 'General Laborer', type: 'Daily Wage', wage: 500.0, status: 'Active', hired: '2025-05-12' },
    { id: 'WRK-1006', name: 'Jonathan Villanueva', age: 33, contact: '+63 917 111 0006', trade: 'Welder', type: 'Contractual', wage: 780.0, status: 'Active', hired: '2024-06-01' },
    { id: 'WRK-1007', name: 'Rodrigo Dela Cruz', age: 39, contact: '+63 917 111 0007', trade: 'Steelman', type: 'Regular', wage: 680.0, status: 'Active', hired: '2024-01-10' },
    { id: 'WRK-1008', name: 'Ferdinand Aquino', age: 31, contact: '+63 917 111 0008', trade: 'Painter', type: 'Contractual', wage: 600.0, status: 'Active', hired: '2025-02-14' },
    { id: 'WRK-1009', name: 'Michael Soriano', age: 29, contact: '+63 917 111 0009', trade: 'Tile Setter', type: 'Regular', wage: 650.0, status: 'Active', hired: '2024-08-20' },
    { id: 'WRK-1010', name: 'Antonio Morales', age: 45, contact: '+63 917 111 0010', trade: 'Heavy Equipment Operator', type: 'Regular', wage: 850.0, status: 'Active', hired: '2023-11-05' },
    { id: 'WRK-1011', name: 'Manuel Pascual', age: 37, contact: '+63 917 111 0011', trade: 'Mason', type: 'Contractual', wage: 650.0, status: 'Active', hired: '2025-01-10' },
    { id: 'WRK-1012', name: 'Vicente Ramos', age: 41, contact: '+63 917 111 0012', trade: 'Carpenter', type: 'Regular', wage: 620.0, status: 'Active', hired: '2024-04-18' },
    { id: 'WRK-1013', name: 'Arnel Castro', age: 34, contact: '+63 917 111 0013', trade: 'Steelman', type: 'Contractual', wage: 680.0, status: 'Active', hired: '2025-03-01' },
    { id: 'WRK-1014', name: 'Gabriel Navarro', age: 24, contact: '+63 917 111 0014', trade: 'General Laborer', type: 'Daily Wage', wage: 500.0, status: 'Active', hired: '2025-06-20' },
    { id: 'WRK-1015', name: 'Roberto Diaz', age: 36, contact: '+63 917 111 0015', trade: 'Electrician', type: 'Regular', wage: 750.0, status: 'Active', hired: '2024-09-01' },
  ];

  const insertWorker = db.prepare(`
    INSERT OR REPLACE INTO workers (id, complete_name, age, contact_number, trade, employment_type, daily_wage_rate, employment_status, date_hired, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  for (const w of workers) {
    insertWorker.run(w.id, w.name, w.age, w.contact, w.trade, w.type, w.wage, w.status, w.hired, now);
  }

  // 8. 75 Attendance Records (15 workers x 5 days)
  // Attendance calculation rules:
  // Standard daily hours: 8.0, 1 hr unpaid lunch break.
  // Present regular: 08:00 - 17:00 (9 hrs elapsed - 1 hr break = 8.0 hrs, 0 OT)
  // Overtime: 08:00 - 19:00 (11 hrs elapsed - 1 hr break = 10.0 hrs; 8.0 reg, 2.0 OT)
  // Late: 08:35 - 17:00 (8.4 hrs elapsed - 1 hr break = 7.4 hrs; 7.4 reg, 0 OT)
  // Half-Day: 08:00 - 12:00 (4.0 hrs elapsed, 0 break = 4.0 hrs; 4.0 reg, 0 OT)
  // Absent: null, null, 0 hrs worked, 0 OT, 0 pay
  const attendancePatterns: Record<string, Record<string, { in: string | null; out: string | null; status: 'Present' | 'Absent' | 'Late' | 'Half-Day'; total: number; ot: number; remarks: string }>> = {
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

  const insertAtt = db.prepare(`
    INSERT OR REPLACE INTO attendance (
      id, worker_id, date, time_in, time_out, attendance_status,
      total_hours_worked, overtime_hours, regular_hours, calculated_pay, remarks, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const workerMap = new Map(workers.map(w => [w.id, w]));

  let attIndex = 1;
  for (const date of SAMPLE_DAYS) {
    for (const w of workers) {
      const attId = `ATT-${date.replace(/-/g, '')}-${String(attIndex++).padStart(3, '0')}`;
      const pat = attendancePatterns[date][w.id];
      const regularHours = Math.min(pat.total, 8.0);
      const otHours = pat.ot;
      const hourlyRate = w.wage / 8.0;
      const regPay = regularHours * hourlyRate;
      const otPay = otHours * hourlyRate * 1.25;
      const totalPay = Math.round((regPay + otPay) * 100) / 100;

      insertAtt.run(
        attId,
        w.id,
        date,
        pat.in,
        pat.out,
        pat.status,
        pat.total,
        otHours,
        regularHours,
        totalPay,
        pat.remarks,
        now
      );
    }
  }

  // 9. 75 Daily Labor Assignments (15 workers x 5 days)
  // Each worker has an assignment on every one of the 5 days
  // Assigned to specific activity, area, and supervisor
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

  const insertAsn = db.prepare(`
    INSERT OR REPLACE INTO daily_labor_assignments (
      id, date, worker_id, activity_id, work_area_id, supervisor_id, assignment_status, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let asnIndex = 1;
  for (const date of SAMPLE_DAYS) {
    for (const w of workers) {
      const asnId = `ASN-${date.replace(/-/g, '')}-${String(asnIndex++).padStart(3, '0')}`;
      const cfg = assignmentConfigs[w.id];
      // On past dates, assignments are Completed or In Progress
      const status = date === '2026-10-24' ? 'In Progress' : 'Completed';
      insertAsn.run(
        asnId,
        date,
        w.id,
        cfg.act,
        cfg.area,
        cfg.sup,
        status,
        cfg.notes,
        now
      );
    }
  }

  // 10. Daily Accomplishments covering all 5 days with productivity calculations
  // Formula:
  // Actual Productivity Rate = Actual Quantity / Actual Labor Hours
  // Productivity Achievement % = (Actual Productivity Rate / Target Productivity Rate) * 100
  // Planned Quantity Achievement % = (Actual Quantity / Planned Quantity) * 100
  // Status: Above Target (>= 105%), Met Target (95% - 104.9%), Below Target (< 95%)
  const accomplishmentData = [
    // Day 1 (2026-10-20)
    {
      id: 'ACC-20261020-001',
      date: '2026-10-20',
      actId: 'ACT-02',
      areaId: 'AREA-02',
      planned: 700.0,
      actual: 760.0,
      unit: 'kg',
      hours: 16.0, // 2 workers (WRK-1006, WRK-1007)
      workers: ['WRK-1006', 'WRK-1007'],
      remarks: 'Fast rebar tying pace for main tower shear wall'
    },
    {
      id: 'ACC-20261020-002',
      date: '2026-10-20',
      actId: 'ACT-03',
      areaId: 'AREA-02',
      planned: 30.0,
      actual: 32.4,
      unit: 'm²',
      hours: 18.0, // WRK-1002 (10h) + WRK-1012 (8h)
      workers: ['WRK-1002', 'WRK-1012'],
      remarks: 'Column formwork erected ahead of concrete schedule'
    },
    {
      id: 'ACC-20261020-003',
      date: '2026-10-20',
      actId: 'ACT-01',
      areaId: 'AREA-03',
      planned: 35.0,
      actual: 22.0, // Underperforming: target is 3.5 m³/hr, actual 22 / 8 = 2.75 m³/hr (78.6% Below Target)
      unit: 'm³',
      hours: 8.0, // WRK-1010
      workers: ['WRK-1010'],
      remarks: 'Encountered unexpected boulder formations slowing down excavation'
    },
    {
      id: 'ACC-20261020-004',
      date: '2026-10-20',
      actId: 'ACT-05',
      areaId: 'AREA-05',
      planned: 12.0,
      actual: 12.0,
      unit: 'm²',
      hours: 8.0, // WRK-1001
      workers: ['WRK-1001'],
      remarks: 'CMU wall laying met target exactly'
    },

    // Day 2 (2026-10-21)
    {
      id: 'ACC-20261021-001',
      date: '2026-10-21',
      actId: 'ACT-02',
      areaId: 'AREA-02',
      planned: 800.0,
      actual: 880.0,
      unit: 'kg',
      hours: 18.0,
      workers: ['WRK-1006', 'WRK-1007'],
      remarks: 'Elevated slab reinforcement completed smoothly'
    },
    {
      id: 'ACC-20261021-002',
      date: '2026-10-21',
      actId: 'ACT-07',
      areaId: 'AREA-04',
      planned: 40.0,
      actual: 44.0,
      unit: 'm',
      hours: 10.0,
      workers: ['WRK-1003'],
      remarks: 'Conduit bending and pipe threading executed quickly'
    },
    {
      id: 'ACC-20261021-003',
      date: '2026-10-21',
      actId: 'ACT-10',
      areaId: 'AREA-05',
      planned: 48.0,
      actual: 32.0, // Below target: 32 / 7.3 = 4.38 vs 6.0 target (73% Below Target)
      unit: 'm²',
      hours: 7.3,
      workers: ['WRK-1008'],
      remarks: 'High ambient humidity delayed drying time for wall surface'
    },

    // Day 3 (2026-10-22)
    {
      id: 'ACC-20261022-001',
      date: '2026-10-22',
      actId: 'ACT-01',
      areaId: 'AREA-03',
      planned: 40.0,
      actual: 42.0,
      unit: 'm³',
      hours: 10.0,
      workers: ['WRK-1010'],
      remarks: 'Drainage trench excavation completed with rock breaker attachment'
    },
    {
      id: 'ACC-20261022-002',
      date: '2026-10-22',
      actId: 'ACT-05',
      areaId: 'AREA-05',
      planned: 15.0,
      actual: 16.5,
      unit: 'm²',
      hours: 10.0,
      workers: ['WRK-1001'],
      remarks: 'Extended shift allowed team to complete entire partition section'
    },
    {
      id: 'ACC-20261022-003',
      date: '2026-10-22',
      actId: 'ACT-06',
      areaId: 'AREA-05',
      planned: 20.0,
      actual: 14.0, // Below target: 14 / 7.5 = 1.87 vs 2.5 target (74.7% Below Target)
      unit: 'm²',
      hours: 7.5,
      workers: ['WRK-1011'],
      remarks: 'Uneven blockwork required thicker base coat application'
    },

    // Day 4 (2026-10-23)
    {
      id: 'ACC-20261023-001',
      date: '2026-10-23',
      actId: 'ACT-08',
      areaId: 'AREA-04',
      planned: 32.0,
      actual: 35.0,
      unit: 'm',
      hours: 10.0,
      workers: ['WRK-1004'],
      remarks: 'PPR water line jointing and pressure test passed inspection'
    },
    {
      id: 'ACC-20261023-002',
      date: '2026-10-23',
      actId: 'ACT-03',
      areaId: 'AREA-02',
      planned: 28.0,
      actual: 29.5,
      unit: 'm²',
      hours: 16.0,
      workers: ['WRK-1002', 'WRK-1012'],
      remarks: 'Slab edge formwork stripped and repositioned for grid 4'
    },
    {
      id: 'ACC-20261023-003',
      date: '2026-10-23',
      actId: 'ACT-09',
      areaId: 'AREA-05',
      planned: 10.0,
      actual: 10.4,
      unit: 'm²',
      hours: 8.0,
      workers: ['WRK-1009'],
      remarks: 'Lobby tile layout aligned to central column axes'
    },

    // Day 5 (2026-10-24)
    {
      id: 'ACC-20261024-001',
      date: '2026-10-24',
      actId: 'ACT-02',
      areaId: 'AREA-02',
      planned: 720.0,
      actual: 780.0,
      unit: 'kg',
      hours: 16.0,
      workers: ['WRK-1006', 'WRK-1007'],
      remarks: 'Grid 5 cantilever reinforcement fully placed and inspected'
    },
    {
      id: 'ACC-20261024-002',
      date: '2026-10-24',
      actId: 'ACT-07',
      areaId: 'AREA-06',
      planned: 32.0,
      actual: 20.0, // Below target: 20 / 8 = 2.5 vs 4.0 target (62.5% Below Target)
      unit: 'm',
      hours: 8.0,
      workers: ['WRK-1015'],
      remarks: 'Conduit bends constrained by structural duct congestion'
    },
    {
      id: 'ACC-20261024-003',
      date: '2026-10-24',
      actId: 'ACT-09',
      areaId: 'AREA-05',
      planned: 9.6,
      actual: 10.2,
      unit: 'm²',
      hours: 8.0,
      workers: ['WRK-1009'],
      remarks: 'Main entrance tile threshold completed and cured'
    }
  ];

  const actMap = new Map(activities.map(a => [a.id, a]));

  const insertAcc = db.prepare(`
    INSERT OR REPLACE INTO daily_accomplishments (
      id, date, activity_id, work_area_id, planned_quantity, actual_quantity,
      unit_of_measurement, actual_labor_hours, actual_productivity_rate,
      productivity_achievement_percent, planned_achievement_percent,
      performance_status, remarks, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertPart = db.prepare(`
    INSERT OR REPLACE INTO accomplishment_participants (
      id, accomplishment_id, worker_id, assignment_id, hours_contributed
    ) VALUES (?, ?, ?, ?, ?)
  `);

  let partIndex = 1;
  for (const acc of accomplishmentData) {
    const act = actMap.get(acc.actId)!;
    const actualProdRate = Math.round((acc.actual / acc.hours) * 100) / 100;
    const prodAchPercent = Math.round((actualProdRate / act.target) * 1000) / 10;
    const planAchPercent = Math.round((acc.actual / acc.planned) * 1000) / 10;

    let perfStatus: 'Above Target' | 'Met Target' | 'Below Target';
    if (prodAchPercent >= 105.0) {
      perfStatus = 'Above Target';
    } else if (prodAchPercent >= 95.0) {
      perfStatus = 'Met Target';
    } else {
      perfStatus = 'Below Target';
    }

    insertAcc.run(
      acc.id,
      acc.date,
      acc.actId,
      acc.areaId,
      acc.planned,
      acc.actual,
      acc.unit,
      acc.hours,
      actualProdRate,
      prodAchPercent,
      planAchPercent,
      perfStatus,
      acc.remarks,
      now
    );

    // Insert participants
    for (const wId of acc.workers) {
      const partId = `PART-${String(partIndex++).padStart(4, '0')}`;
      const hoursPerWorker = acc.hours / acc.workers.length;
      insertPart.run(partId, acc.id, wId, null, hoursPerWorker);
    }
  }

  // 11. Initial Audit Logs
  const auditLogs = [
    { action: 'SEED_RESET', module: 'System Settings', recordId: 'global', details: 'System initialized with baseline demonstration dataset (15 workers, 75 attendances, 75 assignments, 10 activities, 15 accomplishments)' },
    { action: 'CREATE', module: 'User Management', recordId: 'usr_admin_01', details: 'Provisioned default Administrator account (admin@buildpulse.lms) with full RBAC access' },
    { action: 'CREATE', module: 'User Management', recordId: 'usr_siteeng_01', details: 'Provisioned standard Site Engineer account (user@buildpulse.lms) with operational workforce permissions' },
    { action: 'CREATE', module: 'Worker Master Data', recordId: 'WRK-1001_TO_1015', details: 'Registered 15 certified construction trade workers with base daily wage rates' },
    { action: 'CREATE', module: 'Work Activity Master Data', recordId: 'ACT-01_TO_10', details: 'Configured 10 construction work activities with target productivity benchmarks' },
  ];

  const insertAudit = db.prepare(`
    INSERT INTO audit_logs (id, user_id, user_name, action, module, record_id, details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `);

  let logIdx = 1;
  for (const log of auditLogs) {
    insertAudit.run(`LOG-${now.substring(0, 10).replace(/-/g, '')}-${String(logIdx++).padStart(3, '0')}`, 'usr_admin_01', 'System Provisioner', log.action, log.module, log.recordId, log.details, now);
  }

  return {
    seeded: true,
    message: 'Successfully seeded database with 15 workers, 75 attendances, 75 assignments, 10 activities, 15 accomplishments, and initial accounts.'
  };
}
