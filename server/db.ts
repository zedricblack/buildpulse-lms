import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const DATA_DIR = path.resolve(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_PATH = path.join(DATA_DIR, 'construction_lms.db');

export const db = new Database(DB_PATH);

// Enforce foreign keys and WAL mode for reliability
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

export function initDatabase() {
  db.exec(`
    -- 1. Users table (Profiles & Authentication)
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
      account_status TEXT NOT NULL DEFAULT 'active' CHECK(account_status IN ('active', 'inactive')),
      created_at TEXT NOT NULL,
      last_login_at TEXT
    );

    -- 2. User Module Permissions (Granular RBAC)
    CREATE TABLE IF NOT EXISTS user_module_permissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      module_key TEXT NOT NULL,
      can_view INTEGER NOT NULL DEFAULT 1,
      can_create INTEGER NOT NULL DEFAULT 0,
      can_edit INTEGER NOT NULL DEFAULT 0,
      can_delete INTEGER NOT NULL DEFAULT 0,
      UNIQUE(user_id, module_key)
    );

    -- 3. Workers Master Data
    CREATE TABLE IF NOT EXISTS workers (
      id TEXT PRIMARY KEY,
      complete_name TEXT NOT NULL,
      age INTEGER NOT NULL CHECK(age >= 18 AND age <= 70),
      contact_number TEXT NOT NULL,
      trade TEXT NOT NULL,
      employment_type TEXT NOT NULL CHECK(employment_type IN ('Regular', 'Contractual', 'Daily Wage')),
      daily_wage_rate REAL NOT NULL CHECK(daily_wage_rate > 0),
      employment_status TEXT NOT NULL DEFAULT 'Active' CHECK(employment_status IN ('Active', 'Inactive')),
      date_hired TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- 4. Supervisors Master Data
    CREATE TABLE IF NOT EXISTS supervisors (
      id TEXT PRIMARY KEY,
      full_name TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      email TEXT NOT NULL,
      role_title TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- 5. Work Areas Master Data
    CREATE TABLE IF NOT EXISTS work_areas (
      id TEXT PRIMARY KEY,
      area_name TEXT NOT NULL,
      description TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
      created_at TEXT NOT NULL
    );

    -- 6. Work Activities Master Data
    CREATE TABLE IF NOT EXISTS work_activities (
      id TEXT PRIMARY KEY,
      activity_name TEXT NOT NULL,
      description_of_work TEXT NOT NULL,
      unit_of_measurement TEXT NOT NULL,
      target_productivity_rate REAL NOT NULL CHECK(target_productivity_rate > 0),
      activity_status TEXT NOT NULL DEFAULT 'Active' CHECK(activity_status IN ('Active', 'Inactive')),
      created_at TEXT NOT NULL
    );

    -- 7. Attendance Records
    CREATE TABLE IF NOT EXISTS attendance (
      id TEXT PRIMARY KEY,
      worker_id TEXT NOT NULL REFERENCES workers(id) ON UPDATE CASCADE,
      date TEXT NOT NULL,
      time_in TEXT,
      time_out TEXT,
      attendance_status TEXT NOT NULL CHECK(attendance_status IN ('Present', 'Absent', 'Late', 'Half-Day')),
      total_hours_worked REAL NOT NULL DEFAULT 0.0,
      overtime_hours REAL NOT NULL DEFAULT 0.0,
      regular_hours REAL NOT NULL DEFAULT 0.0,
      calculated_pay REAL NOT NULL DEFAULT 0.0,
      remarks TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(worker_id, date)
    );

    -- 8. Daily Labor Assignments
    CREATE TABLE IF NOT EXISTS daily_labor_assignments (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      worker_id TEXT NOT NULL REFERENCES workers(id) ON UPDATE CASCADE,
      activity_id TEXT NOT NULL REFERENCES work_activities(id) ON UPDATE CASCADE,
      work_area_id TEXT NOT NULL REFERENCES work_areas(id) ON UPDATE CASCADE,
      supervisor_id TEXT NOT NULL REFERENCES supervisors(id) ON UPDATE CASCADE,
      assignment_status TEXT NOT NULL DEFAULT 'Assigned' CHECK(assignment_status IN ('Assigned', 'In Progress', 'Completed')),
      notes TEXT,
      created_at TEXT NOT NULL,
      UNIQUE(worker_id, date)
    );

    -- 9. Daily Accomplishments
    CREATE TABLE IF NOT EXISTS daily_accomplishments (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      activity_id TEXT NOT NULL REFERENCES work_activities(id) ON UPDATE CASCADE,
      work_area_id TEXT NOT NULL REFERENCES work_areas(id) ON UPDATE CASCADE,
      planned_quantity REAL NOT NULL CHECK(planned_quantity > 0),
      actual_quantity REAL NOT NULL CHECK(actual_quantity >= 0),
      unit_of_measurement TEXT NOT NULL,
      actual_labor_hours REAL NOT NULL CHECK(actual_labor_hours >= 0),
      actual_productivity_rate REAL NOT NULL DEFAULT 0.0,
      productivity_achievement_percent REAL NOT NULL DEFAULT 0.0,
      planned_achievement_percent REAL NOT NULL DEFAULT 0.0,
      performance_status TEXT NOT NULL CHECK(performance_status IN ('Above Target', 'Met Target', 'Below Target')),
      remarks TEXT,
      created_at TEXT NOT NULL
    );

    -- 10. Accomplishment Participants (Junction table for team & individual worker links)
    CREATE TABLE IF NOT EXISTS accomplishment_participants (
      id TEXT PRIMARY KEY,
      accomplishment_id TEXT NOT NULL REFERENCES daily_accomplishments(id) ON DELETE CASCADE,
      worker_id TEXT NOT NULL REFERENCES workers(id) ON UPDATE CASCADE,
      assignment_id TEXT REFERENCES daily_labor_assignments(id) ON DELETE SET NULL,
      hours_contributed REAL NOT NULL DEFAULT 8.0,
      UNIQUE(accomplishment_id, worker_id)
    );

    -- 11. System Settings
    CREATE TABLE IF NOT EXISTS system_settings (
      id TEXT PRIMARY KEY,
      standard_daily_hours REAL NOT NULL DEFAULT 8.0,
      normal_shift_start_time TEXT NOT NULL DEFAULT '08:00',
      unpaid_break_duration_minutes INTEGER NOT NULL DEFAULT 60,
      overtime_multiplier REAL NOT NULL DEFAULT 1.25,
      half_day_threshold_hours REAL NOT NULL DEFAULT 4.0,
      currency_symbol TEXT NOT NULL DEFAULT '₱',
      company_name TEXT NOT NULL DEFAULT 'BuildPulse Infrastructure & Engineering Corp.',
      project_name TEXT NOT NULL DEFAULT 'Metro Heights Commercial Complex Phase 2',
      sample_period_start TEXT NOT NULL DEFAULT '2026-10-20',
      sample_period_end TEXT NOT NULL DEFAULT '2026-10-24',
      updated_at TEXT NOT NULL
    );

    -- 12. Audit Logs
    CREATE TABLE IF NOT EXISTS audit_logs (
      id TEXT PRIMARY KEY,
      user_id TEXT,
      user_name TEXT,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      record_id TEXT,
      details TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    -- Indexes for query performance
    CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(date);
    CREATE INDEX IF NOT EXISTS idx_attendance_worker ON attendance(worker_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_date ON daily_labor_assignments(date);
    CREATE INDEX IF NOT EXISTS idx_assignments_worker ON daily_labor_assignments(worker_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_activity ON daily_labor_assignments(activity_id);
    CREATE INDEX IF NOT EXISTS idx_accomplishments_date ON daily_accomplishments(date);
    CREATE INDEX IF NOT EXISTS idx_accomplishments_activity ON daily_accomplishments(activity_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);
  `);
}
