import { relations } from 'drizzle-orm';
import {
  pgTable,
  text,
  integer,
  doublePrecision,
  uniqueIndex,
  index
} from 'drizzle-orm/pg-core';

// 1. Users Table (Authentication & RBAC Profile)
export const users = pgTable('users', {
  id: text('id').primaryKey(),
  uid: text('uid').unique(), // Firebase Auth UID
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash'),
  fullName: text('full_name').notNull(),
  role: text('role').notNull().default('user'), // 'admin' | 'user'
  accountStatus: text('account_status').notNull().default('active'), // 'active' | 'inactive'
  createdAt: text('created_at').notNull(),
  lastLoginAt: text('last_login_at'),
});

// 2. User Module Permissions (Granular RBAC)
export const userModulePermissions = pgTable('user_module_permissions', {
  id: text('id').primaryKey(),
  userId: text('user_id').references(() => users.id, { onDelete: 'cascade' }).notNull(),
  moduleKey: text('module_key').notNull(),
  canView: integer('can_view').notNull().default(1),
  canCreate: integer('can_create').notNull().default(0),
  canEdit: integer('can_edit').notNull().default(0),
  canDelete: integer('can_delete').notNull().default(0),
});

// 3. Workers Master Data
export const workers = pgTable('workers', {
  id: text('id').primaryKey(),
  completeName: text('complete_name').notNull(),
  age: integer('age').notNull(),
  contactNumber: text('contact_number').notNull(),
  trade: text('trade').notNull(),
  employmentType: text('employment_type').notNull(), // 'Regular' | 'Contractual' | 'Daily Wage'
  dailyWageRate: doublePrecision('daily_wage_rate').notNull(),
  employmentStatus: text('employment_status').notNull().default('Active'), // 'Active' | 'Inactive'
  dateHired: text('date_hired').notNull(),
  createdAt: text('created_at').notNull(),
});

// 4. Supervisors Master Data
export const supervisors = pgTable('supervisors', {
  id: text('id').primaryKey(),
  fullName: text('full_name').notNull(),
  contactNumber: text('contact_number').notNull(),
  email: text('email').notNull(),
  roleTitle: text('role_title').notNull(),
  createdAt: text('created_at').notNull(),
});

// 5. Work Areas Master Data
export const workAreas = pgTable('work_areas', {
  id: text('id').primaryKey(),
  areaName: text('area_name').notNull(),
  description: text('description').notNull(),
  status: text('status').notNull().default('Active'),
  createdAt: text('created_at').notNull(),
});

// 6. Work Activities Master Data
export const workActivities = pgTable('work_activities', {
  id: text('id').primaryKey(),
  activityName: text('activity_name').notNull(),
  descriptionOfWork: text('description_of_work').notNull(),
  unitOfMeasurement: text('unit_of_measurement').notNull(),
  targetProductivityRate: doublePrecision('target_productivity_rate').notNull(),
  activityStatus: text('activity_status').notNull().default('Active'),
  createdAt: text('created_at').notNull(),
});

// 7. Attendance Records
export const attendance = pgTable('attendance', {
  id: text('id').primaryKey(),
  workerId: text('worker_id').references(() => workers.id, { onUpdate: 'cascade' }).notNull(),
  date: text('date').notNull(),
  timeIn: text('time_in'),
  timeOut: text('time_out'),
  attendanceStatus: text('attendance_status').notNull(), // 'Present' | 'Absent' | 'Late' | 'Half-Day'
  totalHoursWorked: doublePrecision('total_hours_worked').notNull().default(0.0),
  overtimeHours: doublePrecision('overtime_hours').notNull().default(0.0),
  regularHours: doublePrecision('regular_hours').notNull().default(0.0),
  calculatedPay: doublePrecision('calculated_pay').notNull().default(0.0),
  remarks: text('remarks'),
  createdAt: text('created_at').notNull(),
});

// 8. Daily Labor Assignments
export const dailyLaborAssignments = pgTable('daily_labor_assignments', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  workerId: text('worker_id').references(() => workers.id, { onUpdate: 'cascade' }).notNull(),
  activityId: text('activity_id').references(() => workActivities.id, { onUpdate: 'cascade' }).notNull(),
  workAreaId: text('work_area_id').references(() => workAreas.id, { onUpdate: 'cascade' }).notNull(),
  supervisorId: text('supervisor_id').references(() => supervisors.id, { onUpdate: 'cascade' }).notNull(),
  assignmentStatus: text('assignment_status').notNull().default('Assigned'), // 'Assigned' | 'In Progress' | 'Completed'
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});

// 9. Daily Accomplishments
export const dailyAccomplishments = pgTable('daily_accomplishments', {
  id: text('id').primaryKey(),
  date: text('date').notNull(),
  activityId: text('activity_id').references(() => workActivities.id, { onUpdate: 'cascade' }).notNull(),
  workAreaId: text('work_area_id').references(() => workAreas.id, { onUpdate: 'cascade' }).notNull(),
  plannedQuantity: doublePrecision('planned_quantity').notNull(),
  actualQuantity: doublePrecision('actual_quantity').notNull(),
  unitOfMeasurement: text('unit_of_measurement').notNull(),
  actualLaborHours: doublePrecision('actual_labor_hours').notNull(),
  actualProductivityRate: doublePrecision('actual_productivity_rate').notNull().default(0.0),
  productivityAchievementPercent: doublePrecision('productivity_achievement_percent').notNull().default(0.0),
  plannedAchievementPercent: doublePrecision('planned_achievement_percent').notNull().default(0.0),
  performanceStatus: text('performance_status').notNull(), // 'Above Target' | 'Met Target' | 'Below Target'
  remarks: text('remarks'),
  createdAt: text('created_at').notNull(),
});

// 10. Accomplishment Participants
export const accomplishmentParticipants = pgTable('accomplishment_participants', {
  id: text('id').primaryKey(),
  accomplishmentId: text('accomplishment_id').references(() => dailyAccomplishments.id, { onDelete: 'cascade' }).notNull(),
  workerId: text('worker_id').references(() => workers.id, { onUpdate: 'cascade' }).notNull(),
  assignmentId: text('assignment_id').references(() => dailyLaborAssignments.id, { onDelete: 'set null' }),
  hoursContributed: doublePrecision('hours_contributed').notNull().default(8.0),
});

// 11. System Settings
export const systemSettings = pgTable('system_settings', {
  id: text('id').primaryKey(),
  standardDailyHours: doublePrecision('standard_daily_hours').notNull().default(8.0),
  normalShiftStartTime: text('normal_shift_start_time').notNull().default('08:00'),
  unpaidBreakDurationMinutes: integer('unpaid_break_duration_minutes').notNull().default(60),
  overtimeMultiplier: doublePrecision('overtime_multiplier').notNull().default(1.25),
  halfDayThresholdHours: doublePrecision('half_day_threshold_hours').notNull().default(4.0),
  currencySymbol: text('currency_symbol').notNull().default('₱'),
  companyName: text('company_name').notNull().default('BuildPulse Infrastructure & Engineering Corp.'),
  projectName: text('project_name').notNull().default('Metro Heights Commercial Complex Phase 2'),
  samplePeriodStart: text('sample_period_start').notNull().default('2026-10-20'),
  samplePeriodEnd: text('sample_period_end').notNull().default('2026-10-24'),
  updatedAt: text('updated_at').notNull(),
});

// 12. Audit Logs
export const auditLogs = pgTable('audit_logs', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  userName: text('user_name'),
  action: text('action').notNull(),
  module: text('module').notNull(),
  recordId: text('record_id'),
  details: text('details').notNull(),
  createdAt: text('created_at').notNull(),
});

// Relationships
export const usersRelations = relations(users, ({ many }) => ({
  permissions: many(userModulePermissions),
}));

export const userModulePermissionsRelations = relations(userModulePermissions, ({ one }) => ({
  user: one(users, {
    fields: [userModulePermissions.userId],
    references: [users.id],
  }),
}));

export const workersRelations = relations(workers, ({ many }) => ({
  attendances: many(attendance),
  assignments: many(dailyLaborAssignments),
  accomplishmentParticipations: many(accomplishmentParticipants),
}));

export const attendanceRelations = relations(attendance, ({ one }) => ({
  worker: one(workers, {
    fields: [attendance.workerId],
    references: [workers.id],
  }),
}));

export const dailyLaborAssignmentsRelations = relations(dailyLaborAssignments, ({ one }) => ({
  worker: one(workers, {
    fields: [dailyLaborAssignments.workerId],
    references: [workers.id],
  }),
  activity: one(workActivities, {
    fields: [dailyLaborAssignments.activityId],
    references: [workActivities.id],
  }),
  workArea: one(workAreas, {
    fields: [dailyLaborAssignments.workAreaId],
    references: [workAreas.id],
  }),
  supervisor: one(supervisors, {
    fields: [dailyLaborAssignments.supervisorId],
    references: [supervisors.id],
  }),
}));

export const dailyAccomplishmentsRelations = relations(dailyAccomplishments, ({ one, many }) => ({
  activity: one(workActivities, {
    fields: [dailyAccomplishments.activityId],
    references: [workActivities.id],
  }),
  workArea: one(workAreas, {
    fields: [dailyAccomplishments.workAreaId],
    references: [workAreas.id],
  }),
  participants: many(accomplishmentParticipants),
}));

export const accomplishmentParticipantsRelations = relations(accomplishmentParticipants, ({ one }) => ({
  accomplishment: one(dailyAccomplishments, {
    fields: [accomplishmentParticipants.accomplishmentId],
    references: [dailyAccomplishments.id],
  }),
  worker: one(workers, {
    fields: [accomplishmentParticipants.workerId],
    references: [workers.id],
  }),
  assignment: one(dailyLaborAssignments, {
    fields: [accomplishmentParticipants.assignmentId],
    references: [dailyLaborAssignments.id],
  }),
}));
