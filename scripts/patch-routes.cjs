const fs = require('fs');

let code = fs.readFileSync('server/routes.ts', 'utf8');

// 1. In POST /users, add syncDocToFirestore
const postUsersTarget = `    await logAudit(req, 'CREATE', 'User Management', userId, \`Created user account: \${fullName} (\${email}) as \${role}\`);
    return res.status(201).json({ success: true, userId, message: 'User created successfully.' });`;

const postUsersReplacement = `    // Sync to Firestore
    await syncDocToFirestore('users', userId, {
      id: userId,
      email: cleanEmail,
      fullName: fullName.trim(),
      full_name: fullName.trim(),
      role: role,
      accountStatus: 'active',
      account_status: 'active',
      createdAt: now,
      permissions: Object.entries(permissions || {}).map(([m, p]) => ({
        moduleKey: m,
        canView: Boolean(p.canView),
        canCreate: Boolean(p.canCreate),
        canEdit: Boolean(p.canEdit),
        canDelete: Boolean(p.canDelete)
      }))
    });

    await logAudit(req, 'CREATE', 'User Management', userId, \`Created user account: \${fullName} (\${email}) as \${role}\`);
    return res.status(201).json({ success: true, userId, message: 'User created successfully.' });`;

if (code.includes(postUsersTarget)) {
  code = code.replace(postUsersTarget, postUsersReplacement);
  console.log("Patched POST /users");
} else {
  console.warn("Could not find postUsersTarget");
}

// 2. Replace router.put('/users/:id')
const oldPutUsersRegex = /router\.put\('\/users\/:id', requireAuth, requireAdmin, async \(req: AuthenticatedRequest, res: Response\) => \{[\s\S]*?\n\}\);\n\nrouter\.patch\('\/users\/:id\/status'/;

const newPutUsers = `router.put('/users/:id', requireAuth, requireAdmin, async (req: AuthenticatedRequest, res: Response) => {
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
          id: \`perm_\${id}_\${m}\`,
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

    await logAudit(req, 'UPDATE', 'User Management', id, \`Updated user profile and permissions for \${updatedFullName} (\${updatedEmail})\`);
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

router.patch('/users/:id/status'`;

if (oldPutUsersRegex.test(code)) {
  code = code.replace(oldPutUsersRegex, newPutUsers);
  console.log("Patched PUT /users/:id");
} else {
  console.warn("Could not find oldPutUsersRegex");
}

// 3. Patch PATCH /users/:id/status to sync to Firestore
const patchUserStatusTarget = `await db.update(users).set({ accountStatus: status }).where(eq(users.id, id));`;
const patchUserStatusReplacement = `await db.update(users).set({ accountStatus: status }).where(eq(users.id, id));
    await syncDocToFirestore('users', id, { id, accountStatus: status, account_status: status });`;
if (code.includes(patchUserStatusTarget)) {
  code = code.replace(patchUserStatusTarget, patchUserStatusReplacement);
  console.log("Patched PATCH /users/:id/status");
}

// 4. Patch POST /activities to sync to Firestore
const postActivityTarget = `await logAudit(req, 'CREATE', 'Work Activity Master Data', cleanId, \`Added work activity \${activityName} (\${targetProductivityRate} \${unitOfMeasurement}/hr)\`);
    return res.status(201).json({ success: true, message: 'Activity created successfully in Cloud SQL.' });`;

const postActivityReplacement = `await syncDocToFirestore('activities', cleanId, {
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

    await logAudit(req, 'CREATE', 'Work Activity Master Data', cleanId, \`Added work activity \${activityName} (\${targetProductivityRate} \${unitOfMeasurement}/hr)\`);
    return res.status(201).json({ success: true, message: 'Activity created successfully in Cloud SQL and Firestore.' });`;

if (code.includes(postActivityTarget)) {
  code = code.replace(postActivityTarget, postActivityReplacement);
  console.log("Patched POST /activities");
}

// 5. Patch PUT /activities/:id to sync to Firestore
const putActivityTarget = `await logAudit(req, 'UPDATE', 'Work Activity Master Data', id, \`Updated work activity \${activityName || activity.activityName}\`);
    return res.json({ success: true, message: 'Activity updated successfully.' });`;

const putActivityReplacement = `await syncDocToFirestore('activities', id, {
      id,
      activityName: activityName ? String(activityName).trim() : activity.activityName,
      activity_name: activityName ? String(activityName).trim() : activity.activityName,
      descriptionOfWork: descriptionOfWork !== undefined ? String(descriptionOfWork).trim() : activity.descriptionOfWork,
      description_of_work: descriptionOfWork !== undefined ? String(descriptionOfWork).trim() : activity.descriptionOfWork,
      unitOfMeasurement: unitOfMeasurement ? String(unitOfMeasurement).trim() : activity.unitOfMeasurement,
      unit_of_measurement: unitOfMeasurement ? String(unitOfMeasurement).trim() : activity.unitOfMeasurement,
      targetProductivityRate: targetProductivityRate !== undefined ? Number(targetProductivityRate) : activity.targetProductivityRate,
      target_productivity_rate: targetProductivityRate !== undefined ? Number(targetProductivityRate) : activity.targetProductivityRate,
      activityStatus: activityStatus || activity.activityStatus,
      activity_status: activityStatus || activity.activityStatus
    });

    await logAudit(req, 'UPDATE', 'Work Activity Master Data', id, \`Updated work activity \${activityName || activity.activityName}\`);
    return res.json({ success: true, message: 'Activity updated successfully in Cloud SQL and Firestore.' });`;

if (code.includes(putActivityTarget)) {
  code = code.replace(putActivityTarget, putActivityReplacement);
  console.log("Patched PUT /activities/:id");
}

// 6. Patch POST /attendance to sync to Firestore
const postAttExistingTarget = `await logAudit(req, 'UPDATE', 'Attendance Management', existing.id, \`Updated attendance for \${targetWorkerId} on \${targetDate} (\${targetStatus}, \${totalHours} hrs)\`);
      return res.status(200).json({ success: true, message: \`Attendance updated for worker \${targetWorkerId} on \${targetDate}.\`, id: existing.id });`;

const postAttExistingReplacement = `await syncDocToFirestore('attendance', existing.id, {
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

      await logAudit(req, 'UPDATE', 'Attendance Management', existing.id, \`Updated attendance for \${targetWorkerId} on \${targetDate} (\${targetStatus}, \${totalHours} hrs)\`);
      return res.status(200).json({ success: true, message: \`Attendance updated for worker \${targetWorkerId} on \${targetDate}.\`, id: existing.id });`;

if (code.includes(postAttExistingTarget)) {
  code = code.replace(postAttExistingTarget, postAttExistingReplacement);
  console.log("Patched POST /attendance (existing)");
}

const postAttNewTarget = `await logAudit(req, 'CREATE', 'Attendance Management', id, \`Recorded attendance for \${targetWorkerId} on \${targetDate} (\${targetStatus}, \${totalHours} hrs)\`);
    return res.status(201).json({ success: true, message: 'Attendance record created in Cloud SQL.', id });`;

const postAttNewReplacement = `await syncDocToFirestore('attendance', id, {
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

    await logAudit(req, 'CREATE', 'Attendance Management', id, \`Recorded attendance for \${targetWorkerId} on \${targetDate} (\${targetStatus}, \${totalHours} hrs)\`);
    return res.status(201).json({ success: true, message: 'Attendance record created in Cloud SQL and Firestore.', id });`;

if (code.includes(postAttNewTarget)) {
  code = code.replace(postAttNewTarget, postAttNewReplacement);
  console.log("Patched POST /attendance (new)");
}

// 7. Patch PUT /attendance/:id to sync to Firestore
const putAttTarget = `await logAudit(req, 'UPDATE', 'Attendance Management', id, \`Updated attendance record for \${targetWorker} on \${targetDate}\`);
    return res.json({ success: true, message: 'Attendance updated successfully.' });`;

const putAttReplacement = `await syncDocToFirestore('attendance', id, {
      id,
      workerId: targetWorker,
      worker_id: targetWorker,
      date: targetDate,
      timeIn: targetStatus === 'Absent' ? null : (timeIn !== undefined ? timeIn : current.timeIn),
      time_in: targetStatus === 'Absent' ? null : (timeIn !== undefined ? timeIn : current.timeIn),
      timeOut: targetStatus === 'Absent' ? null : (timeOut !== undefined ? timeOut : current.timeOut),
      time_out: targetStatus === 'Absent' ? null : (timeOut !== undefined ? timeOut : current.timeOut),
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
      remarks: remarks !== undefined ? remarks : current.remarks
    });

    await logAudit(req, 'UPDATE', 'Attendance Management', id, \`Updated attendance record for \${targetWorker} on \${targetDate}\`);
    return res.json({ success: true, message: 'Attendance updated successfully in Cloud SQL and Firestore.' });`;

if (code.includes(putAttTarget)) {
  code = code.replace(putAttTarget, putAttReplacement);
  console.log("Patched PUT /attendance/:id");
}

// 8. Patch DELETE /attendance/:id to delete from Firestore
const delAttTarget = `await db.delete(attendance).where(eq(attendance.id, id));`;
const delAttReplacement = `await db.delete(attendance).where(eq(attendance.id, id));
    await deleteDocFromFirestore('attendance', id);`;
if (code.includes(delAttTarget)) {
  code = code.replace(delAttTarget, delAttReplacement);
  console.log("Patched DELETE /attendance/:id");
}

// 9. Patch POST /assignments to sync to Firestore
const postAsnExistingTarget = `await logAudit(req, 'UPDATE', 'Daily Labor Assignment', existing.id, \`Updated assignment for \${worker.completeName} on \${targetDate} to \${targetActivityId}\`);
      return res.status(200).json({ success: true, message: \`Labor assignment updated for worker \${targetWorkerId} on \${targetDate}.\`, id: existing.id });`;

const postAsnExistingReplacement = `await syncDocToFirestore('assignments', existing.id, {
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

      await logAudit(req, 'UPDATE', 'Daily Labor Assignment', existing.id, \`Updated assignment for \${worker.completeName} on \${targetDate} to \${targetActivityId}\`);
      return res.status(200).json({ success: true, message: \`Labor assignment updated for worker \${targetWorkerId} on \${targetDate}.\`, id: existing.id });`;

if (code.includes(postAsnExistingTarget)) {
  code = code.replace(postAsnExistingTarget, postAsnExistingReplacement);
  console.log("Patched POST /assignments (existing)");
}

const postAsnNewTarget = `await logAudit(req, 'CREATE', 'Daily Labor Assignment', id, \`Assigned \${worker.completeName} to \${targetActivityId} on \${targetDate}\`);
    return res.status(201).json({ success: true, message: 'Labor assignment created successfully in Cloud SQL.', id });`;

const postAsnNewReplacement = `await syncDocToFirestore('assignments', id, {
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

    await logAudit(req, 'CREATE', 'Daily Labor Assignment', id, \`Assigned \${worker.completeName} to \${targetActivityId} on \${targetDate}\`);
    return res.status(201).json({ success: true, message: 'Labor assignment created successfully in Cloud SQL and Firestore.', id });`;

if (code.includes(postAsnNewTarget)) {
  code = code.replace(postAsnNewTarget, postAsnNewReplacement);
  console.log("Patched POST /assignments (new)");
}

// 10. Patch PUT /assignments/:id to sync to Firestore
const putAsnTarget = `await logAudit(req, 'UPDATE', 'Daily Labor Assignment', id, \`Updated assignment \${id}\`);
    return res.json({ success: true, message: 'Assignment updated successfully.' });`;

const putAsnReplacement = `await syncDocToFirestore('assignments', id, {
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

    await logAudit(req, 'UPDATE', 'Daily Labor Assignment', id, \`Updated assignment \${id}\`);
    return res.json({ success: true, message: 'Assignment updated successfully in Cloud SQL and Firestore.' });`;

if (code.includes(putAsnTarget)) {
  code = code.replace(putAsnTarget, putAsnReplacement);
  console.log("Patched PUT /assignments/:id");
}

// 11. Patch DELETE /assignments/:id to delete from Firestore
const delAsnTarget = `await db.delete(dailyLaborAssignments).where(eq(dailyLaborAssignments.id, id));`;
const delAsnReplacement = `await db.delete(dailyLaborAssignments).where(eq(dailyLaborAssignments.id, id));
    await deleteDocFromFirestore('assignments', id);`;
if (code.includes(delAsnTarget)) {
  code = code.replace(delAsnTarget, delAsnReplacement);
  console.log("Patched DELETE /assignments/:id");
}

// 12. Patch POST /accomplishments to sync to Firestore
const postAccTarget = `await logAudit(req, 'CREATE', 'Daily Accomplishment Records', id, \`Recorded accomplishment for \${act.activityName} on \${date}: \${actual}/\${planned} \${act.unitOfMeasurement} (\${perfStatus})\`);
    return res.status(201).json({ success: true, message: 'Accomplishment recorded successfully in Cloud SQL.', id });`;

const postAccReplacement = `await syncDocToFirestore('accomplishments', id, {
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

    await logAudit(req, 'CREATE', 'Daily Accomplishment Records', id, \`Recorded accomplishment for \${act.activityName} on \${date}: \${actual}/\${planned} \${act.unitOfMeasurement} (\${perfStatus})\`);
    return res.status(201).json({ success: true, message: 'Accomplishment recorded successfully in Cloud SQL and Firestore.', id });`;

if (code.includes(postAccTarget)) {
  code = code.replace(postAccTarget, postAccReplacement);
  console.log("Patched POST /accomplishments");
}

// 13. Patch PUT /accomplishments/:id to sync to Firestore
const putAccTarget = `await logAudit(req, 'UPDATE', 'Daily Accomplishment Records', id, \`Updated accomplishment \${id}: \${actual}/\${planned} \${targetUnit} (\${perfStatus})\`);
    return res.json({ success: true, message: 'Accomplishment updated successfully.' });`;

const putAccReplacement = `await syncDocToFirestore('accomplishments', id, {
      id,
      date: targetDate,
      activityId: targetActivityId,
      activity_id: targetActivityId,
      workAreaId: targetWorkAreaId,
      work_area_id: targetWorkAreaId,
      plannedQuantity: planned,
      planned_quantity: planned,
      actualQuantity: actual,
      actual_quantity: actual,
      unitOfMeasurement: targetUnit,
      unit_of_measurement: targetUnit,
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
      remarks: remarks !== undefined ? remarks : current.remarks
    });

    await logAudit(req, 'UPDATE', 'Daily Accomplishment Records', id, \`Updated accomplishment \${id}: \${actual}/\${planned} \${targetUnit} (\${perfStatus})\`);
    return res.json({ success: true, message: 'Accomplishment updated successfully in Cloud SQL and Firestore.' });`;

if (code.includes(putAccTarget)) {
  code = code.replace(putAccTarget, putAccReplacement);
  console.log("Patched PUT /accomplishments/:id");
}

// 14. Patch DELETE /accomplishments/:id to delete from Firestore
const delAccTarget = `await db.delete(dailyAccomplishments).where(eq(dailyAccomplishments.id, id));`;
const delAccReplacement = `await db.delete(dailyAccomplishments).where(eq(dailyAccomplishments.id, id));
    await deleteDocFromFirestore('accomplishments', id);`;
if (code.includes(delAccTarget)) {
  code = code.replace(delAccTarget, delAccReplacement);
  console.log("Patched DELETE /accomplishments/:id");
}

fs.writeFileSync('server/routes.ts', code);
console.log('Successfully wrote updated server/routes.ts');
