-- =========================================================================
-- BUILDPULSE LMS - SUPABASE POSTGRESQL PRODUCTION MIGRATION
-- Project: Construction Labor Management System (LMS)
-- Generated: 2026-10-27
-- Normalized Relational Schema with Constraints, Indexes, and RLS Policies
-- =========================================================================

-- Enable UUID extension if needed
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. User Profiles Table (Linked to auth.users or standalone LMS profiles)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id TEXT PRIMARY KEY,
  auth_user_id UUID UNIQUE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('admin', 'user')),
  account_status TEXT NOT NULL DEFAULT 'active' CHECK(account_status IN ('active', 'inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  last_login_at TIMESTAMPTZ
);

-- 2. User Module Permissions (Granular 10-module RBAC)
CREATE TABLE IF NOT EXISTS public.user_module_permissions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.user_profiles(id) ON DELETE CASCADE,
  module_key TEXT NOT NULL,
  can_view BOOLEAN NOT NULL DEFAULT true,
  can_create BOOLEAN NOT NULL DEFAULT false,
  can_edit BOOLEAN NOT NULL DEFAULT false,
  can_delete BOOLEAN NOT NULL DEFAULT false,
  UNIQUE(user_id, module_key)
);

-- 3. Construction Workers Master Data
CREATE TABLE IF NOT EXISTS public.workers (
  id TEXT PRIMARY KEY,
  complete_name TEXT NOT NULL,
  age INTEGER NOT NULL CHECK(age >= 18 AND age <= 70),
  contact_number TEXT NOT NULL,
  trade TEXT NOT NULL,
  employment_type TEXT NOT NULL CHECK(employment_type IN ('Regular', 'Contractual', 'Daily Wage')),
  daily_wage_rate NUMERIC(10, 2) NOT NULL CHECK(daily_wage_rate > 0),
  employment_status TEXT NOT NULL DEFAULT 'Active' CHECK(employment_status IN ('Active', 'Inactive')),
  date_hired DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. Supervisors Master Data
CREATE TABLE IF NOT EXISTS public.supervisors (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  contact_number TEXT NOT NULL,
  email TEXT NOT NULL,
  role_title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. Work Areas Master Data
CREATE TABLE IF NOT EXISTS public.work_areas (
  id TEXT PRIMARY KEY,
  area_name TEXT NOT NULL,
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'Active' CHECK(status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 6. Work Activities Master Data (Productivity Targets)
CREATE TABLE IF NOT EXISTS public.work_activities (
  id TEXT PRIMARY KEY,
  activity_name TEXT NOT NULL,
  description_of_work TEXT NOT NULL,
  unit_of_measurement TEXT NOT NULL,
  target_productivity_rate NUMERIC(10, 2) NOT NULL CHECK(target_productivity_rate > 0),
  activity_status TEXT NOT NULL DEFAULT 'Active' CHECK(activity_status IN ('Active', 'Inactive')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. Daily Attendance Records
CREATE TABLE IF NOT EXISTS public.attendance (
  id TEXT PRIMARY KEY,
  worker_id TEXT NOT NULL REFERENCES public.workers(id) ON UPDATE CASCADE,
  date DATE NOT NULL,
  time_in TIME,
  time_out TIME,
  attendance_status TEXT NOT NULL CHECK(attendance_status IN ('Present', 'Absent', 'Late', 'Half-Day')),
  total_hours_worked NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  overtime_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  regular_hours NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  calculated_pay NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(worker_id, date)
);

-- 8. Daily Labor Assignments
CREATE TABLE IF NOT EXISTS public.daily_labor_assignments (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  worker_id TEXT NOT NULL REFERENCES public.workers(id) ON UPDATE CASCADE,
  activity_id TEXT NOT NULL REFERENCES public.work_activities(id) ON UPDATE CASCADE,
  work_area_id TEXT NOT NULL REFERENCES public.work_areas(id) ON UPDATE CASCADE,
  supervisor_id TEXT NOT NULL REFERENCES public.supervisors(id) ON UPDATE CASCADE,
  assignment_status TEXT NOT NULL DEFAULT 'Assigned' CHECK(assignment_status IN ('Assigned', 'In Progress', 'Completed')),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(worker_id, date)
);

-- 9. Daily Accomplishments Monitoring
CREATE TABLE IF NOT EXISTS public.daily_accomplishments (
  id TEXT PRIMARY KEY,
  date DATE NOT NULL,
  activity_id TEXT NOT NULL REFERENCES public.work_activities(id) ON UPDATE CASCADE,
  work_area_id TEXT NOT NULL REFERENCES public.work_areas(id) ON UPDATE CASCADE,
  planned_quantity NUMERIC(10, 2) NOT NULL CHECK(planned_quantity > 0),
  actual_quantity NUMERIC(10, 2) NOT NULL CHECK(actual_quantity >= 0),
  unit_of_measurement TEXT NOT NULL,
  actual_labor_hours NUMERIC(6, 2) NOT NULL CHECK(actual_labor_hours >= 0),
  actual_productivity_rate NUMERIC(10, 2) NOT NULL DEFAULT 0.0,
  productivity_achievement_percent NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  planned_achievement_percent NUMERIC(6, 2) NOT NULL DEFAULT 0.0,
  performance_status TEXT NOT NULL CHECK(performance_status IN ('Above Target', 'Met Target', 'Below Target')),
  remarks TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. Accomplishment Participants (Junction Table)
CREATE TABLE IF NOT EXISTS public.accomplishment_participants (
  id TEXT PRIMARY KEY,
  accomplishment_id TEXT NOT NULL REFERENCES public.daily_accomplishments(id) ON DELETE CASCADE,
  worker_id TEXT NOT NULL REFERENCES public.workers(id) ON UPDATE CASCADE,
  assignment_id TEXT REFERENCES public.daily_labor_assignments(id) ON DELETE SET NULL,
  hours_contributed NUMERIC(6, 2) NOT NULL DEFAULT 8.0,
  UNIQUE(accomplishment_id, worker_id)
);

-- 11. System Configuration & Rules
CREATE TABLE IF NOT EXISTS public.system_settings (
  id TEXT PRIMARY KEY,
  standard_daily_hours NUMERIC(4, 2) NOT NULL DEFAULT 8.0,
  normal_shift_start_time TIME NOT NULL DEFAULT '08:00',
  unpaid_break_duration_minutes INTEGER NOT NULL DEFAULT 60,
  overtime_multiplier NUMERIC(4, 2) NOT NULL DEFAULT 1.25,
  half_day_threshold_hours NUMERIC(4, 2) NOT NULL DEFAULT 4.0,
  currency_symbol TEXT NOT NULL DEFAULT '₱',
  company_name TEXT NOT NULL DEFAULT 'BuildPulse Infrastructure & Engineering Corp.',
  project_name TEXT NOT NULL DEFAULT 'Metro Heights Commercial Complex Phase 2',
  sample_period_start DATE NOT NULL DEFAULT '2026-10-20',
  sample_period_end DATE NOT NULL DEFAULT '2026-10-24',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. Immutable System Audit Logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  user_name TEXT,
  action TEXT NOT NULL,
  module TEXT NOT NULL,
  record_id TEXT,
  details TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Indexes for optimal querying
CREATE INDEX IF NOT EXISTS idx_attendance_date ON public.attendance(date);
CREATE INDEX IF NOT EXISTS idx_attendance_worker ON public.attendance(worker_id);
CREATE INDEX IF NOT EXISTS idx_assignments_date ON public.daily_labor_assignments(date);
CREATE INDEX IF NOT EXISTS idx_assignments_worker ON public.daily_labor_assignments(worker_id);
CREATE INDEX IF NOT EXISTS idx_assignments_activity ON public.daily_labor_assignments(activity_id);
CREATE INDEX IF NOT EXISTS idx_accomplishments_date ON public.daily_accomplishments(date);
CREATE INDEX IF NOT EXISTS idx_accomplishments_activity ON public.daily_accomplishments(activity_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON public.audit_logs(created_at DESC);

-- Row Level Security (RLS) Policies
ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_module_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_areas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.work_activities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_labor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_accomplishments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accomplishment_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Default Read Policies for Authenticated Users
CREATE POLICY "Allow authenticated read on operational tables" ON public.workers FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read on activities" ON public.work_activities FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read on areas" ON public.work_areas FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read on supervisors" ON public.supervisors FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read on attendance" ON public.attendance FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read on assignments" ON public.daily_labor_assignments FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read on accomplishments" ON public.daily_accomplishments FOR SELECT USING (true);
CREATE POLICY "Allow authenticated read on settings" ON public.system_settings FOR SELECT USING (true);
