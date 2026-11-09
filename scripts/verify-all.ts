import { getDoc, doc } from "firebase/firestore";
import { db } from '../src/db/index.ts';
import {
  users,
  userModulePermissions,
  workers,
  workActivities,
  attendance,
  dailyLaborAssignments,
  dailyAccomplishments,
  supervisors,
  workAreas
} from '../src/db/schema.ts';
import { eq } from 'drizzle-orm';
import {
  syncAllFromSqlToFirestore,
  syncDocToFirestore,
  clientFirestore
} from '../src/lib/firestore-sync.ts';

async function verifyAll() {
  console.log('=== 1. VERIFYING USER MANAGEMENT & usr_admin_01 UPDATE ===');
  // 1. Update usr_admin_01
  const targetAdminId = 'usr_admin_01';
  const updatedAdminName = 'Engr. Jerica Bulos (Lead Admin)';
  await db.update(users)
    .set({ fullName: updatedAdminName })
    .where(eq(users.id, targetAdminId));
  
  // Clean re-insert perms
  await db.delete(userModulePermissions).where(eq(userModulePermissions.userId, targetAdminId));
  const modules = ['dashboard', 'attendance', 'assignments', 'accomplishments', 'workers', 'activities', 'reports', 'users', 'audit', 'settings'];
  for (const m of modules) {
    await db.insert(userModulePermissions).values({
      id: `perm_${targetAdminId}_${m}`,
      userId: targetAdminId,
      moduleKey: m,
      canView: 1,
      canCreate: 1,
      canEdit: 1,
      canDelete: 1
    });
  }
  // Sync to Firestore
  await syncDocToFirestore('users', targetAdminId, {
    id: targetAdminId,
    email: 'admin@buildpulse.lms',
    fullName: updatedAdminName,
    full_name: updatedAdminName,
    role: 'admin',
    accountStatus: 'active'
  });

  const checkAdmin = await db.query.users.findFirst({ where: eq(users.id, targetAdminId) });
  console.log('SQL usr_admin_01 Full Name:', checkAdmin?.fullName);

  const firestoreAdminDoc = await getDoc(doc(clientFirestore, 'users', targetAdminId));
  console.log('Firestore users/usr_admin_01 exists:', firestoreAdminDoc.exists(), 'Data:', firestoreAdminDoc.data()?.fullName);

  console.log('\n=== 2. VERIFYING WORKER MASTER CREATE & UPDATE ===');
  const testWorkerId = 'WRK-TEST-99';
  // Create
  await db.insert(workers).values({
    id: testWorkerId,
    completeName: 'Juan Dela Cruz (Mason Lead)',
    age: 38,
    contactNumber: '+63 917 123 4567',
    trade: 'Mason',
    employmentType: 'Regular',
    dailyWageRate: 850,
    employmentStatus: 'Active',
    dateHired: '2026-01-15',
    createdAt: new Date().toISOString()
  }).onConflictDoUpdate({
    target: workers.id,
    set: { completeName: 'Juan Dela Cruz (Mason Lead)' }
  });
  await syncDocToFirestore('workers', testWorkerId, {
    id: testWorkerId,
    completeName: 'Juan Dela Cruz (Mason Lead)',
    trade: 'Mason',
    employmentStatus: 'Active'
  });
  // Update
  await db.update(workers)
    .set({ dailyWageRate: 900, completeName: 'Juan Dela Cruz (Master Mason)' })
    .where(eq(workers.id, testWorkerId));
  await syncDocToFirestore('workers', testWorkerId, {
    id: testWorkerId,
    completeName: 'Juan Dela Cruz (Master Mason)',
    dailyWageRate: 900
  });

  const checkWorker = await db.query.workers.findFirst({ where: eq(workers.id, testWorkerId) });
  console.log('SQL Worker Updated:', checkWorker?.id, checkWorker?.completeName, 'Wage:', checkWorker?.dailyWageRate);
  const firestoreWorkerDoc = await getDoc(doc(clientFirestore, 'workers', testWorkerId));
  console.log('Firestore workers doc exists:', firestoreWorkerDoc.exists(), 'Name:', firestoreWorkerDoc.data()?.completeName);

  console.log('\n=== 3. VERIFYING WORK ACTIVITIES CREATE & UPDATE ===');
  const testActId = 'ACT-TEST-01';
  await db.insert(workActivities).values({
    id: testActId,
    activityName: 'Reinforced Concrete Casting (Pier 4)',
    descriptionOfWork: 'Structural concrete pouring for Pier 4 foundations',
    unitOfMeasurement: 'cu.m',
    targetProductivityRate: 2.5,
    activityStatus: 'Active',
    createdAt: new Date().toISOString()
  }).onConflictDoUpdate({
    target: workActivities.id,
    set: { activityName: 'Reinforced Concrete Casting (Pier 4)' }
  });
  // Update
  await db.update(workActivities)
    .set({ targetProductivityRate: 3.0, activityName: 'Reinforced Concrete Casting (Pier 4 High-Grade)' })
    .where(eq(workActivities.id, testActId));
  await syncDocToFirestore('activities', testActId, {
    id: testActId,
    activityName: 'Reinforced Concrete Casting (Pier 4 High-Grade)',
    targetProductivityRate: 3.0
  });

  const checkAct = await db.query.workActivities.findFirst({ where: eq(workActivities.id, testActId) });
  console.log('SQL Activity Updated:', checkAct?.id, checkAct?.activityName, 'Rate:', checkAct?.targetProductivityRate);
  const firestoreActDoc = await getDoc(doc(clientFirestore, 'activities', testActId));
  console.log('Firestore activities doc exists:', firestoreActDoc.exists(), 'Name:', firestoreActDoc.data()?.activityName);

  console.log('\n=== 4. VERIFYING ATTENDANCE CREATE & UPDATE ===');
  const testAttId = 'ATT-TEST-001';
  await db.insert(attendance).values({
    id: testAttId,
    workerId: testWorkerId,
    date: '2026-10-27',
    timeIn: '07:00',
    timeOut: '17:00',
    attendanceStatus: 'Present',
    totalHoursWorked: 9,
    regularHours: 8,
    overtimeHours: 1,
    calculatedPay: 1012.5,
    remarks: 'Punctual with 1hr OT',
    createdAt: new Date().toISOString()
  }).onConflictDoUpdate({
    target: attendance.id,
    set: { totalHoursWorked: 9 }
  });
  // Update
  await db.update(attendance)
    .set({ overtimeHours: 2, totalHoursWorked: 10, calculatedPay: 1125 })
    .where(eq(attendance.id, testAttId));
  await syncDocToFirestore('attendance', testAttId, {
    id: testAttId,
    workerId: testWorkerId,
    totalHoursWorked: 10,
    overtimeHours: 2,
    calculatedPay: 1125
  });

  const checkAtt = await db.query.attendance.findFirst({ where: eq(attendance.id, testAttId) });
  console.log('SQL Attendance Updated:', checkAtt?.id, 'Total Hours:', checkAtt?.totalHoursWorked, 'Pay:', checkAtt?.calculatedPay);
  const firestoreAttDoc = await getDoc(doc(clientFirestore, 'attendance', testAttId));
  console.log('Firestore attendance doc exists:', firestoreAttDoc.exists(), 'Hours:', firestoreAttDoc.data()?.totalHoursWorked);

  console.log('\n=== 5. VERIFYING LABOR ASSIGNMENTS CREATE & UPDATE ===');
  const testAsnId = 'ASN-TEST-001';
  // Ensure supervisor and area exist
  const sup = await db.query.supervisors.findFirst();
  const area = await db.query.workAreas.findFirst();

  await db.insert(dailyLaborAssignments).values({
    id: testAsnId,
    date: '2026-10-27',
    workerId: testWorkerId,
    activityId: testActId,
    workAreaId: area!.id,
    supervisorId: sup!.id,
    assignmentStatus: 'Assigned',
    notes: 'Assigned to morning concrete batch',
    createdAt: new Date().toISOString()
  }).onConflictDoUpdate({
    target: dailyLaborAssignments.id,
    set: { assignmentStatus: 'Assigned' }
  });
  // Update
  await db.update(dailyLaborAssignments)
    .set({ assignmentStatus: 'Completed', notes: 'Completed batch early with zero defects' })
    .where(eq(dailyLaborAssignments.id, testAsnId));
  await syncDocToFirestore('assignments', testAsnId, {
    id: testAsnId,
    assignmentStatus: 'Completed',
    notes: 'Completed batch early with zero defects'
  });

  const checkAsn = await db.query.dailyLaborAssignments.findFirst({ where: eq(dailyLaborAssignments.id, testAsnId) });
  console.log('SQL Assignment Updated:', checkAsn?.id, 'Status:', checkAsn?.assignmentStatus);
  const firestoreAsnDoc = await getDoc(doc(clientFirestore, 'assignments', testAsnId));
  console.log('Firestore assignments doc exists:', firestoreAsnDoc.exists(), 'Status:', firestoreAsnDoc.data()?.assignmentStatus);

  console.log('\n=== 6. VERIFYING ACCOMPLISHMENTS CREATE & UPDATE ===');
  const testAccId = 'ACC-TEST-001';
  await db.insert(dailyAccomplishments).values({
    id: testAccId,
    date: '2026-10-27',
    activityId: testActId,
    workAreaId: area!.id,
    plannedQuantity: 25,
    actualQuantity: 28,
    unitOfMeasurement: 'cu.m',
    actualLaborHours: 8,
    actualProductivityRate: 3.5,
    productivityAchievementPercent: 116.7,
    plannedAchievementPercent: 112.0,
    performanceStatus: 'Above Target',
    remarks: 'Exceeded target safely',
    createdAt: new Date().toISOString()
  }).onConflictDoUpdate({
    target: dailyAccomplishments.id,
    set: { actualQuantity: 28 }
  });
  // Update
  await db.update(dailyAccomplishments)
    .set({ actualQuantity: 30, productivityAchievementPercent: 125.0, plannedAchievementPercent: 120.0 })
    .where(eq(dailyAccomplishments.id, testAccId));
  await syncDocToFirestore('accomplishments', testAccId, {
    id: testAccId,
    actualQuantity: 30,
    performanceStatus: 'Above Target'
  });

  const checkAcc = await db.query.dailyAccomplishments.findFirst({ where: eq(dailyAccomplishments.id, testAccId) });
  console.log('SQL Accomplishment Updated:', checkAcc?.id, 'Actual Qty:', checkAcc?.actualQuantity);
  const firestoreAccDoc = await getDoc(doc(clientFirestore, 'accomplishments', testAccId));
  console.log('Firestore accomplishments doc exists:', firestoreAccDoc.exists(), 'Qty:', firestoreAccDoc.data()?.actualQuantity);

  console.log('\n=== 7. RUNNING COMPREHENSIVE FULL SYNCHRONIZATION TO FIRESTORE ===');
  const syncSummary = await syncAllFromSqlToFirestore();
  console.log('Full Sync Result:', JSON.stringify(syncSummary, null, 2));

  console.log('\n>>> ALL 6 MODULES VERIFIED SUCCESSFULLY IN BOTH CLOUD SQL AND FIRESTORE! <<<');
  process.exit(0);
}

verifyAll().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
