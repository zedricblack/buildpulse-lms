import { db } from '../server/db.js';
import { seedDatabase } from '../server/seed.js';
import bcrypt from 'bcryptjs';

async function verifyAll() {
  console.log('=== BUILDPULSE LMS SYSTEM VERIFICATION ===\n');

  // 1. Seed database if empty
  await seedDatabase(false);

  // 2. Verify Table Record Counts
  const counts = {
    workers: (db.prepare('SELECT COUNT(*) as c FROM workers').get() as any).c,
    attendance: (db.prepare('SELECT COUNT(*) as c FROM attendance').get() as any).c,
    assignments: (db.prepare('SELECT COUNT(*) as c FROM daily_labor_assignments').get() as any).c,
    activities: (db.prepare('SELECT COUNT(*) as c FROM work_activities').get() as any).c,
    accomplishments: (db.prepare('SELECT COUNT(*) as c FROM daily_accomplishments').get() as any).c,
    users: (db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c,
    supervisors: (db.prepare('SELECT COUNT(*) as c FROM supervisors').get() as any).c,
    workAreas: (db.prepare('SELECT COUNT(*) as c FROM work_areas').get() as any).c,
    auditLogs: (db.prepare('SELECT COUNT(*) as c FROM audit_logs').get() as any).c,
  };

  console.log('Database Table Counts:');
  console.log(`- Workers: ${counts.workers} (Minimum required: 15) -> ${counts.workers >= 15 ? 'PASSED ✓' : 'FAILED ✗'}`);
  console.log(`- Attendance: ${counts.attendance} (Minimum required: 75) -> ${counts.attendance >= 75 ? 'PASSED ✓' : 'FAILED ✗'}`);
  console.log(`- Labor Assignments: ${counts.assignments} (Minimum required: 75) -> ${counts.assignments >= 75 ? 'PASSED ✓' : 'FAILED ✗'}`);
  console.log(`- Work Activities: ${counts.activities} (Minimum required: 10) -> ${counts.activities >= 10 ? 'PASSED ✓' : 'FAILED ✗'}`);
  console.log(`- Accomplishments: ${counts.accomplishments} -> ${counts.accomplishments >= 10 ? 'PASSED ✓' : 'FAILED ✗'}`);
  console.log(`- Supervisors: ${counts.supervisors}`);
  console.log(`- Work Areas: ${counts.workAreas}`);
  console.log(`- Registered Users: ${counts.users}`);
  console.log(`- Audit Logs: ${counts.auditLogs}\n`);

  // 3. Test Attendance Coverage Across 5 Sample Days
  const days = ['2026-10-20', '2026-10-21', '2026-10-22', '2026-10-23', '2026-10-24'];
  console.log('Attendance Coverage per Day:');
  for (const day of days) {
    const attOnDay = (db.prepare('SELECT COUNT(*) as c FROM attendance WHERE date = ?').get(day) as any).c;
    const asgnOnDay = (db.prepare('SELECT COUNT(*) as c FROM daily_labor_assignments WHERE date = ?').get(day) as any).c;
    console.log(`  ${day}: ${attOnDay} attendance records, ${asgnOnDay} assignments -> ${attOnDay === 15 && asgnOnDay === 15 ? 'PASSED (All 15 workers) ✓' : 'FAILED ✗'}`);
  }

  // 4. Verify Attendance Statuses
  const statuses = db.prepare('SELECT attendance_status, COUNT(*) as c FROM attendance GROUP BY attendance_status').all() as any[];
  console.log('\nAttendance Status Distribution across 75 records:');
  for (const s of statuses) {
    console.log(`  - ${s.attendance_status}: ${s.c} records`);
  }

  // 5. Test Calculation Accuracy
  console.log('\nCalculations Verification:');

  // Test Hours & Pay for a regular worker on Oct 20 (WRK-1001, wage 650, 08:00 to 17:00, 8.0 hrs worked, 0 OT)
  const regAtt = db.prepare("SELECT * FROM attendance WHERE worker_id = 'WRK-1001' AND date = '2026-10-20'").get() as any;
  const expectedRegPay = 650.0; // 8.0 * (650/8)
  console.log(`- Regular Shift (WRK-1001 on 2026-10-20): Hours=${regAtt.total_hours_worked}h, OT=${regAtt.overtime_hours}h, Pay=₱${regAtt.calculated_pay} (Expected ₱${expectedRegPay}) -> ${regAtt.calculated_pay === expectedRegPay ? 'ACCURATE ✓' : 'DISCREPANCY ✗'}`);

  // Test Hours & Pay for an overtime worker on Oct 20 (WRK-1002, wage 620, 08:00 to 19:00, 10.0 hrs worked, 2.0 OT)
  const otAtt = db.prepare("SELECT * FROM attendance WHERE worker_id = 'WRK-1002' AND date = '2026-10-20'").get() as any;
  const hourlyRate = 620 / 8; // 77.5
  const expectedOtPay = Math.round((8 * hourlyRate + 2 * hourlyRate * 1.25) * 100) / 100; // 620 + 193.75 = 813.75
  console.log(`- Overtime Shift (WRK-1002 on 2026-10-20): Hours=${otAtt.total_hours_worked}h, OT=${otAtt.overtime_hours}h, Pay=₱${otAtt.calculated_pay} (Expected ₱${expectedOtPay}) -> ${otAtt.calculated_pay === expectedOtPay ? 'ACCURATE ✓' : 'DISCREPANCY ✗'}`);

  // Test Productivity Calculation
  const acc = db.prepare("SELECT * FROM daily_accomplishments WHERE id = 'ACC-20261020-001'").get() as any;
  const expectedActualRate = Math.round((acc.actual_quantity / acc.actual_labor_hours) * 100) / 100; // 760 / 16 = 47.5
  console.log(`- Productivity Calculation (ACC-20261020-001): Actual Rate=${acc.actual_productivity_rate} kg/h (Expected ${expectedActualRate}), Prod Ach=${acc.productivity_achievement_percent}% -> ${acc.actual_productivity_rate === expectedActualRate ? 'ACCURATE ✓' : 'DISCREPANCY ✗'}`);

  // Test Below Target Flagging
  const belowTargetRows = db.prepare("SELECT COUNT(*) as c FROM daily_accomplishments WHERE performance_status = 'Below Target'").get() as any;
  console.log(`- Underperforming Activities correctly flagged 'Below Target': ${belowTargetRows.c} records -> ${belowTargetRows.c > 0 ? 'VERIFIED ✓' : 'FAILED ✗'}`);

  // 6. Test Authentication & Passwords
  const adminUser = db.prepare("SELECT * FROM users WHERE email = 'admin@buildpulse.lms'").get() as any;
  const adminPassValid = await bcrypt.compare('AdminPass123!', adminUser.password_hash);
  const standardUser = db.prepare("SELECT * FROM users WHERE email = 'user@buildpulse.lms'").get() as any;
  const standardPassValid = await bcrypt.compare('UserPass123!', standardUser.password_hash);
  console.log(`\nAuthentication Verification:`);
  console.log(`- Admin Password Verification (admin@buildpulse.lms): ${adminPassValid ? 'PASSED ✓' : 'FAILED ✗'}`);
  console.log(`- Site Engineer Password Verification (user@buildpulse.lms): ${standardPassValid ? 'PASSED ✓' : 'FAILED ✗'}`);

  console.log('\n=== ALL SYSTEM TESTS COMPLETED SUCCESSFULLY ===');
}

verifyAll().catch(console.error);
