export interface User {
  id: string;
  email: string;
  fullName: string;
  role: 'admin' | 'user';
  accountStatus?: 'active' | 'inactive';
  createdAt?: string;
  lastLoginAt?: string | null;
  permissions?: UserPermission[];
}

export interface UserPermission {
  moduleKey: string;
  canView: boolean;
  canCreate: boolean;
  canEdit: boolean;
  canDelete: boolean;
}

export interface Worker {
  id: string;
  complete_name: string;
  age: number;
  contact_number: string;
  trade: string;
  employment_type: 'Regular' | 'Contractual' | 'Daily Wage';
  daily_wage_rate: number;
  employment_status: 'Active' | 'Inactive';
  date_hired: string;
  created_at?: string;
}

export interface Supervisor {
  id: string;
  full_name: string;
  contact_number: string;
  email: string;
  role_title: string;
}

export interface WorkArea {
  id: string;
  area_name: string;
  description: string;
  status: 'Active' | 'Inactive';
}

export interface WorkActivity {
  id: string;
  activity_name: string;
  description_of_work: string;
  unit_of_measurement: string;
  target_productivity_rate: number;
  activity_status: 'Active' | 'Inactive';
  assignment_count?: number;
  accomplishment_count?: number;
}

export interface AttendanceRecord {
  id: string;
  worker_id: string;
  worker_name?: string;
  worker_trade?: string;
  worker_wage?: number;
  employment_type?: string;
  date: string;
  time_in: string | null;
  time_out: string | null;
  attendance_status: 'Present' | 'Absent' | 'Late' | 'Half-Day';
  total_hours_worked: number;
  overtime_hours: number;
  regular_hours: number;
  calculated_pay: number;
  remarks: string | null;
}

export interface LaborAssignment {
  id: string;
  date: string;
  worker_id: string;
  worker_name?: string;
  worker_trade?: string;
  activity_id: string;
  activity_name?: string;
  unit_of_measurement?: string;
  work_area_id: string;
  area_name?: string;
  supervisor_id: string;
  supervisor_name?: string;
  assignment_status: 'Assigned' | 'In Progress' | 'Completed';
  notes?: string;
}

export interface AccomplishmentParticipant {
  workerId: string;
  name: string;
  trade: string;
  hours: number;
}

export interface DailyAccomplishment {
  id: string;
  date: string;
  activity_id: string;
  activity_name?: string;
  target_productivity_rate?: number;
  work_area_id: string;
  area_name?: string;
  planned_quantity: number;
  actual_quantity: number;
  unit_of_measurement: string;
  actual_labor_hours: number;
  actual_productivity_rate: number;
  productivity_achievement_percent: number;
  planned_achievement_percent: number;
  performance_status: 'Above Target' | 'Met Target' | 'Below Target';
  remarks: string | null;
  participants?: AccomplishmentParticipant[];
}

export interface AuditLog {
  id: string;
  user_id: string | null;
  user_name: string | null;
  action: string;
  module: string;
  record_id: string | null;
  details: string;
  created_at: string;
}

export interface SystemSettings {
  id: string;
  standard_daily_hours: number;
  normal_shift_start_time: string;
  unpaid_break_duration_minutes: number;
  overtime_multiplier: number;
  half_day_threshold_hours: number;
  currency_symbol: string;
  company_name: string;
  project_name: string;
  sample_period_start: string;
  sample_period_end: string;
  updated_at: string;
}

export interface DashboardStats {
  selectedDate: string;
  currencySymbol: string;
  samplePeriod: {
    start: string;
    end: string;
    days: string[];
  };
  workforce: {
    scheduled: number;
    present: number;
    absent: number;
    late: number;
    halfDay: number;
  };
  hours: {
    todayTotal: number;
    todayOvertime: number;
    todayRegular: number;
    periodTotal: number;
    periodOvertime: number;
    trend: Array<{
      date: string;
      total_hours: number;
      ot_hours: number;
      total_cost: number;
    }>;
  };
  costs: {
    dailyCost: number;
    mtdCost: number;
    perWorker: Array<{
      worker_id: string;
      complete_name: string;
      trade: string;
      daily_wage_rate: number;
      total_hours: number;
      ot_hours: number;
      labor_cost: number;
    }>;
    perTrade: Array<{
      trade: string;
      worker_count: number;
      total_cost: number;
      total_hours: number;
    }>;
  };
  workforceByTrade: Array<{
    trade: string;
    count: number;
  }>;
  manpowerStatus: {
    active: number;
    inactive: number;
    assigned: number;
    unassigned: number;
    present: number;
    absent: number;
    late: number;
    halfDay: number;
  };
  productivity: {
    dayAccomplishments: DailyAccomplishment[];
    activities: Array<{
      activityId: string;
      activityName: string;
      unit: string;
      targetRate: number;
      totalPlanned: number;
      totalActual: number;
      totalLaborHours: number;
      actualRate: number;
      prodAchievementPercent: number;
      plannedAchievementPercent: number;
      isBelowTarget: boolean;
      belowTargetRecords: number;
    }>;
    belowTargetCount: number;
  };
}
