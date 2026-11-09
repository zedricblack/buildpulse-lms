import { initializeApp as initAdminApp, getApps as getAdminApps } from 'firebase-admin/app';
import { getFirestore as getAdminFirestore } from 'firebase-admin/firestore';
import { initializeApp as initClientApp, getApps as getClientApps } from 'firebase/app';
import { getFirestore as getClientFirestore, doc, setDoc, deleteDoc } from 'firebase/firestore';
import config from '../../firebase-applet-config.json';
import { db } from '../db/index.ts';
import {
  users,
  userModulePermissions,
  workers,
  attendance,
  dailyLaborAssignments,
  workActivities,
  dailyAccomplishments,
  supervisors,
  workAreas
} from '../db/schema.ts';

if (!getAdminApps().length) {
  initAdminApp({
    projectId: config.projectId,
  });
}

// Admin Firestore instance for direct database writes
export const adminFirestore = getAdminFirestore(config.firestoreDatabaseId);

// Client Firestore instance fallback
const clientApp = !getClientApps().length ? initClientApp(config) : getClientApps()[0];
export const clientFirestore = getClientFirestore(clientApp, config.firestoreDatabaseId);

export async function syncDocToFirestore(collectionName: string, docId: string, data: any): Promise<void> {
  const cleanData = Object.entries(data).reduce((acc, [k, v]) => {
    if (v !== undefined) {
      acc[k] = v;
    }
    return acc;
  }, {} as any);

  const payload = {
    ...cleanData,
    syncedAt: new Date().toISOString()
  };

  try {
    await setDoc(doc(clientFirestore, collectionName, docId), payload, { merge: true });
    return;
  } catch (clientErr) {
    try {
      await adminFirestore.collection(collectionName).doc(docId).set(payload, { merge: true });
    } catch (adminErr) {
      console.warn(`[Firestore Sync] Could not sync ${collectionName}/${docId}:`, clientErr);
    }
  }
}

export async function deleteDocFromFirestore(collectionName: string, docId: string): Promise<void> {
  try {
    await adminFirestore.collection(collectionName).doc(docId).delete();
    return;
  } catch {
    try {
      await deleteDoc(doc(clientFirestore, collectionName, docId));
    } catch (err) {
      console.error(`[Firestore Sync Error] Failed to delete ${collectionName}/${docId}:`, err);
    }
  }
}

export async function syncAllWorkersFromSqlToFirestore(): Promise<{ count: number; workerIds: string[] }> {
  try {
    const allWorkers = await db.select().from(workers);
    const workerIds: string[] = [];

    for (const w of allWorkers) {
      await syncDocToFirestore('workers', w.id, {
        id: w.id,
        completeName: w.completeName,
        complete_name: w.completeName,
        age: w.age,
        contactNumber: w.contactNumber,
        contact_number: w.contactNumber,
        trade: w.trade,
        employmentType: w.employmentType,
        employment_type: w.employmentType,
        dailyWageRate: w.dailyWageRate,
        daily_wage_rate: w.dailyWageRate,
        employmentStatus: w.employmentStatus,
        employment_status: w.employmentStatus,
        dateHired: w.dateHired,
        date_hired: w.dateHired,
        createdAt: w.createdAt,
        created_at: w.createdAt
      });
      workerIds.push(w.id);
    }

    console.log(`[Firestore Sync] Successfully synchronized all ${allWorkers.length} workers to Firestore.`);
    return { count: allWorkers.length, workerIds };
  } catch (err) {
    console.error('[Firestore Sync] Error syncing workers to Firestore:', err);
    return { count: 0, workerIds: [] };
  }
}

export async function syncAllUsersFromSqlToFirestore(): Promise<number> {
  try {
    const allUsers = await db.select().from(users);
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

    for (const u of allUsers) {
      await syncDocToFirestore('users', u.id, {
        id: u.id,
        uid: u.uid || null,
        email: u.email,
        fullName: u.fullName,
        full_name: u.fullName,
        role: u.role,
        accountStatus: u.accountStatus,
        account_status: u.accountStatus,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt || null,
        permissions: permsByUser.get(u.id) || []
      });
    }
    console.log(`[Firestore Sync] Successfully synchronized ${allUsers.length} users to Firestore.`);
    return allUsers.length;
  } catch (err) {
    console.error('[Firestore Sync] Error syncing users to Firestore:', err);
    return 0;
  }
}

export async function syncAllActivitiesFromSqlToFirestore(): Promise<number> {
  try {
    const allActivities = await db.select().from(workActivities);
    for (const a of allActivities) {
      await syncDocToFirestore('activities', a.id, {
        id: a.id,
        activityName: a.activityName,
        activity_name: a.activityName,
        descriptionOfWork: a.descriptionOfWork,
        description_of_work: a.descriptionOfWork,
        unitOfMeasurement: a.unitOfMeasurement,
        unit_of_measurement: a.unitOfMeasurement,
        targetProductivityRate: a.targetProductivityRate,
        target_productivity_rate: a.targetProductivityRate,
        activityStatus: a.activityStatus,
        activity_status: a.activityStatus,
        createdAt: a.createdAt
      });
    }
    console.log(`[Firestore Sync] Successfully synchronized ${allActivities.length} activities to Firestore.`);
    return allActivities.length;
  } catch (err) {
    console.error('[Firestore Sync] Error syncing activities to Firestore:', err);
    return 0;
  }
}

export async function syncAllAttendanceFromSqlToFirestore(): Promise<number> {
  try {
    const records = await db.select().from(attendance);
    for (const att of records) {
      await syncDocToFirestore('attendance', att.id, {
        id: att.id,
        workerId: att.workerId,
        worker_id: att.workerId,
        date: att.date,
        timeIn: att.timeIn,
        time_in: att.timeIn,
        timeOut: att.timeOut,
        time_out: att.timeOut,
        attendanceStatus: att.attendanceStatus,
        attendance_status: att.attendanceStatus,
        totalHoursWorked: att.totalHoursWorked,
        total_hours_worked: att.totalHoursWorked,
        overtimeHours: att.overtimeHours,
        overtime_hours: att.overtimeHours,
        regularHours: att.regularHours,
        regular_hours: att.regularHours,
        calculatedPay: att.calculatedPay,
        calculated_pay: att.calculatedPay,
        remarks: att.remarks,
        createdAt: att.createdAt
      });
    }
    console.log(`[Firestore Sync] Successfully synchronized ${records.length} attendance records to Firestore.`);
    return records.length;
  } catch (err) {
    console.error('[Firestore Sync] Error syncing attendance to Firestore:', err);
    return 0;
  }
}

export async function syncAllAssignmentsFromSqlToFirestore(): Promise<number> {
  try {
    const list = await db.select().from(dailyLaborAssignments);
    for (const asn of list) {
      await syncDocToFirestore('assignments', asn.id, {
        id: asn.id,
        date: asn.date,
        workerId: asn.workerId,
        worker_id: asn.workerId,
        activityId: asn.activityId,
        activity_id: asn.activityId,
        workAreaId: asn.workAreaId,
        work_area_id: asn.workAreaId,
        supervisorId: asn.supervisorId,
        supervisor_id: asn.supervisorId,
        assignmentStatus: asn.assignmentStatus,
        assignment_status: asn.assignmentStatus,
        notes: asn.notes,
        createdAt: asn.createdAt
      });
    }
    console.log(`[Firestore Sync] Successfully synchronized ${list.length} assignments to Firestore.`);
    return list.length;
  } catch (err) {
    console.error('[Firestore Sync] Error syncing assignments to Firestore:', err);
    return 0;
  }
}

export async function syncAllAccomplishmentsFromSqlToFirestore(): Promise<number> {
  try {
    const records = await db.select().from(dailyAccomplishments);
    for (const acc of records) {
      await syncDocToFirestore('accomplishments', acc.id, {
        id: acc.id,
        date: acc.date,
        activityId: acc.activityId,
        activity_id: acc.activityId,
        workAreaId: acc.workAreaId,
        work_area_id: acc.workAreaId,
        plannedQuantity: acc.plannedQuantity,
        planned_quantity: acc.plannedQuantity,
        actualQuantity: acc.actualQuantity,
        actual_quantity: acc.actualQuantity,
        unitOfMeasurement: acc.unitOfMeasurement,
        unit_of_measurement: acc.unitOfMeasurement,
        actualLaborHours: acc.actualLaborHours,
        actual_labor_hours: acc.actualLaborHours,
        actualProductivityRate: acc.actualProductivityRate,
        actual_productivity_rate: acc.actualProductivityRate,
        productivityAchievementPercent: acc.productivityAchievementPercent,
        productivity_achievement_percent: acc.productivityAchievementPercent,
        plannedAchievementPercent: acc.plannedAchievementPercent,
        planned_achievement_percent: acc.plannedAchievementPercent,
        performanceStatus: acc.performanceStatus,
        performance_status: acc.performanceStatus,
        remarks: acc.remarks,
        createdAt: acc.createdAt
      });
    }
    console.log(`[Firestore Sync] Successfully synchronized ${records.length} accomplishments to Firestore.`);
    return records.length;
  } catch (err) {
    console.error('[Firestore Sync] Error syncing accomplishments to Firestore:', err);
    return 0;
  }
}

export async function syncAllSupervisorsAndAreas(): Promise<void> {
  try {
    const sups = await db.select().from(supervisors);
    for (const s of sups) {
      await syncDocToFirestore('supervisors', s.id, {
        id: s.id,
        fullName: s.fullName,
        contactNumber: s.contactNumber,
        email: s.email,
        roleTitle: s.roleTitle,
        createdAt: s.createdAt
      });
    }
    const areas = await db.select().from(workAreas);
    for (const a of areas) {
      await syncDocToFirestore('workAreas', a.id, {
        id: a.id,
        areaName: a.areaName,
        area_name: a.areaName,
        description: a.description,
        status: a.status,
        createdAt: a.createdAt
      });
    }
  } catch (err) {
    console.error('[Firestore Sync] Error syncing supervisors and areas:', err);
  }
}

export async function syncAllFromSqlToFirestore(): Promise<{
  workers: number;
  users: number;
  activities: number;
  attendance: number;
  assignments: number;
  accomplishments: number;
}> {
  console.log(`[Firestore Sync] Starting full bidirectional sync to Firestore database "${config.firestoreDatabaseId}"...`);
  const [workerRes, usersCount, actCount, attCount, asnCount, accCount] = await Promise.all([
    syncAllWorkersFromSqlToFirestore(),
    syncAllUsersFromSqlToFirestore(),
    syncAllActivitiesFromSqlToFirestore(),
    syncAllAttendanceFromSqlToFirestore(),
    syncAllAssignmentsFromSqlToFirestore(),
    syncAllAccomplishmentsFromSqlToFirestore()
  ]);
  await syncAllSupervisorsAndAreas();
  console.log('[Firestore Sync] Full database synchronization complete.');
  return {
    workers: workerRes.count,
    users: usersCount,
    activities: actCount,
    attendance: attCount,
    assignments: asnCount,
    accomplishments: accCount
  };
}
