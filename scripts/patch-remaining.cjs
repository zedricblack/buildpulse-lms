const fs = require('fs');

// Patch server/routes.ts
let code = fs.readFileSync('server/routes.ts', 'utf8');

// 1. activities PUT
const actAuditLog = `await logAudit(req, 'UPDATE', 'Work Activity Master Data', id, \`Updated work activity \${activityName || activity.activityName}\`);`;
if (code.includes(actAuditLog)) {
  const syncAct = `await syncDocToFirestore('activities', id, {
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
    });\n    ` + actAuditLog;
  code = code.replace(actAuditLog, syncAct);
  console.log("Patched activities PUT sync");
}

// 2. activities PATCH status
const actStatusLog = `await logAudit(req, status === 'Active' ? 'ACTIVATE' : 'DEACTIVATE', 'Work Activity Master Data', id, \`Set activity \${activity.activityName} to \${status}\`);`;
if (code.includes(actStatusLog)) {
  const syncActStatus = `await syncDocToFirestore('activities', id, {
      id,
      activityStatus: status,
      activity_status: status
    });\n    ` + actStatusLog;
  code = code.replace(actStatusLog, syncActStatus);
  console.log("Patched activities status PATCH sync");
}

// 3. attendance PUT
const attAuditLog = `await logAudit(req, 'UPDATE', 'Attendance Management', id, \`Updated attendance record for \${targetWorker} on \${targetDate}\`);`;
if (code.includes(attAuditLog)) {
  const syncAtt = `await syncDocToFirestore('attendance', id, {
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
    });\n    ` + attAuditLog;
  code = code.replace(attAuditLog, syncAtt);
  console.log("Patched attendance PUT sync");
}

// 4. accomplishments PUT
const accAuditLog = `await logAudit(req, 'UPDATE', 'Daily Accomplishment Records', id, \`Updated accomplishment \${id}: \${actual}/\${planned} \${targetUnit} (\${perfStatus})\`);`;
if (code.includes(accAuditLog)) {
  const syncAcc = `await syncDocToFirestore('accomplishments', id, {
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
    });\n    ` + accAuditLog;
  code = code.replace(accAuditLog, syncAcc);
  console.log("Patched accomplishments PUT sync");
}

fs.writeFileSync('server/routes.ts', code);
console.log("Successfully updated server/routes.ts");

// 5. Patch src/pages/UserManagementPage.tsx
let uiCode = fs.readFileSync('src/pages/UserManagementPage.tsx', 'utf8');

uiCode = uiCode.replace(
  'const { user: currentUser } = useAuth();',
  'const { user: currentUser, refreshUser } = useAuth();'
);

const oldSaveEdit = `      await api.updateUser(editingUser.id, {
        fullName: editFullName.trim(),
        role: editRole,
        permissions: editPerms
      });
      setEditingUser(null);
      loadUsers();`;

const newSaveEdit = `      await api.updateUser(editingUser.id, {
        fullName: editFullName.trim(),
        role: editRole,
        permissions: editPerms
      });
      setEditingUser(null);
      await loadUsers();
      if (currentUser?.id === editingUser.id) {
        await refreshUser();
      }`;

if (uiCode.includes(oldSaveEdit)) {
  uiCode = uiCode.replace(oldSaveEdit, newSaveEdit);
  console.log("Patched UserManagementPage handleSaveEdit");
} else {
  console.warn("Could not find oldSaveEdit in UserManagementPage.tsx");
}

fs.writeFileSync('src/pages/UserManagementPage.tsx', uiCode);
console.log("Successfully updated src/pages/UserManagementPage.tsx");
