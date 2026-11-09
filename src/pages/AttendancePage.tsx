import React, { useState, useEffect } from 'react';
import {
  Clock,
  Plus,
  Search,
  Filter,
  Calendar,
  Download,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { AttendanceRecord, Worker } from '../types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';

interface AttendancePageProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  initialFilter?: any;
}

export const AttendancePage: React.FC<AttendancePageProps> = ({
  currentDate,
  onDateChange,
  initialFilter
}) => {
  const { hasPermission } = useAuth();
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState(initialFilter?.status || 'all');
  const [tradeFilter, setTradeFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [formWorkerId, setFormWorkerId] = useState('');
  const [formDate, setFormDate] = useState(currentDate);
  const [formStatus, setFormStatus] = useState<'Present' | 'Absent' | 'Late' | 'Half-Day'>('Present');
  const [formTimeIn, setFormTimeIn] = useState('08:00');
  const [formTimeOut, setFormTimeOut] = useState('17:00');
  const [formRemarks, setFormRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [recordToDelete, setRecordToDelete] = useState<AttendanceRecord | null>(null);

  // Quick 5 sample days
  const sampleDates = [
    { date: '2026-10-20', label: 'Day 1 (Mon)' },
    { date: '2026-10-21', label: 'Day 2 (Tue)' },
    { date: '2026-10-22', label: 'Day 3 (Wed)' },
    { date: '2026-10-23', label: 'Day 4 (Thu)' },
    { date: '2026-10-24', label: 'Day 5 (Fri)' },
  ];

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [attData, workersData] = await Promise.all([
        api.getAttendance({
          date: currentDate,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          trade: tradeFilter !== 'all' ? tradeFilter : undefined
        }),
        api.getWorkers()
      ]);
      setRecords(attData);
      setWorkers(workersData);
    } catch (err) {
      console.error('Failed to load attendance:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentDate, statusFilter, tradeFilter]);

  const handleOpenCreate = () => {
    setEditingRecord(null);
    setFormWorkerId(workers[0]?.id || '');
    setFormDate(currentDate);
    setFormStatus('Present');
    setFormTimeIn('08:00');
    setFormTimeOut('17:00');
    setFormRemarks('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (rec: AttendanceRecord) => {
    setEditingRecord(rec);
    setFormWorkerId(rec.worker_id);
    setFormDate(rec.date);
    setFormStatus(rec.attendance_status);
    setFormTimeIn(rec.time_in || '08:00');
    setFormTimeOut(rec.time_out || '17:00');
    setFormRemarks(rec.remarks || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Preview hours calculation in the modal form
  const computePreviewHours = () => {
    if (formStatus === 'Absent') return { total: 0, regular: 0, ot: 0 };
    if (formStatus === 'Half-Day') return { total: 4.0, regular: 4.0, ot: 0 };
    if (!formTimeIn || !formTimeOut) return { total: 0, regular: 0, ot: 0 };

    const [inH, inM] = formTimeIn.split(':').map(Number);
    const [outH, outM] = formTimeOut.split(':').map(Number);
    let elapsed = (outH * 60 + outM) - (inH * 60 + inM);
    if (elapsed < 0) elapsed = 0;
    if (elapsed >= 300) elapsed = Math.max(0, elapsed - 60); // 1 hr lunch break
    const total = Math.round((elapsed / 60) * 10) / 10;
    const regular = Math.min(total, 8.0);
    const ot = Math.max(0, Math.round((total - 8.0) * 10) / 10);
    return { total, regular, ot };
  };

  const preview = computePreviewHours();

  const handleSaveAttendance = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWorkerId || !formDate || !formStatus) {
      setFormError('Please select a worker, date, and attendance status.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingRecord) {
        await api.updateAttendance(editingRecord.id, {
          workerId: formWorkerId,
          date: formDate,
          attendanceStatus: formStatus,
          timeIn: formStatus === 'Absent' ? null : formTimeIn,
          timeOut: formStatus === 'Absent' ? null : formTimeOut,
          remarks: formRemarks
        });
      } else {
        await api.createAttendance({
          workerId: formWorkerId,
          date: formDate,
          attendanceStatus: formStatus,
          timeIn: formStatus === 'Absent' ? null : formTimeIn,
          timeOut: formStatus === 'Absent' ? null : formTimeOut,
          remarks: formRemarks
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save attendance record.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!recordToDelete) return;
    try {
      await api.deleteAttendance(recordToDelete.id);
      setRecordToDelete(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete attendance record.');
    }
  };

  // Filter records by search
  const filteredRecords = records.filter(r => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      r.worker_id.toLowerCase().includes(s) ||
      (r.worker_name && r.worker_name.toLowerCase().includes(s)) ||
      (r.worker_trade && r.worker_trade.toLowerCase().includes(s))
    );
  });

  // Calculate day totals
  const totalHoursWorked = filteredRecords.reduce((sum, r) => sum + r.total_hours_worked, 0);
  const totalOvertimeHours = filteredRecords.reduce((sum, r) => sum + r.overtime_hours, 0);
  const totalDailyPay = filteredRecords.reduce((sum, r) => sum + r.calculated_pay, 0);

  const handleExportCSV = () => {
    const headers = ['Attendance ID', 'Date', 'Worker ID', 'Worker Name', 'Trade', 'Status', 'Time In', 'Time Out', 'Total Hours', 'Regular Hours', 'Overtime Hours', 'Calculated Pay (PHP)', 'Remarks'];
    const rows = filteredRecords.map(r => [
      r.id,
      r.date,
      r.worker_id,
      `"${r.worker_name || ''}"`,
      `"${r.worker_trade || ''}"`,
      r.attendance_status,
      r.time_in || 'N/A',
      r.time_out || 'N/A',
      r.total_hours_worked,
      r.regular_hours,
      r.overtime_hours,
      r.calculated_pay,
      `"${r.remarks || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `daily_attendance_${currentDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Clock className="w-5 h-5 text-amber-500" />
            Attendance Management
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily clock-in/out records, automated work hour calculations, overtime tracking, and payroll computation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          {hasPermission('attendance', 'create') && (
            <button
              onClick={handleOpenCreate}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Attendance</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Switcher & Day Tabs */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <span className="text-xs font-medium text-slate-500 pr-1 shrink-0">Sample Cycle:</span>
          {sampleDates.map(d => (
            <button
              key={d.date}
              onClick={() => onDateChange(d.date)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors shrink-0 cursor-pointer ${
                currentDate === d.date
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Custom Date:</span>
          <input
            type="date"
            value={currentDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="border border-slate-200 rounded px-2 py-1 text-slate-800 text-xs font-mono"
          />
        </div>
      </div>

      {/* Daily Summary Metric Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200">
          <span className="text-[11px] text-slate-500 font-medium">Logged Workers</span>
          <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">{filteredRecords.length} / 15</p>
          <span className="text-[10px] text-slate-400">Total roster deployed</span>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-slate-200">
          <span className="text-[11px] text-slate-500 font-medium">Total Labor-Hours</span>
          <p className="text-lg font-bold font-mono text-slate-900 mt-0.5">{totalHoursWorked.toFixed(1)} hrs</p>
          <span className="text-[10px] text-slate-400">Net of 1h lunch breaks</span>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-slate-200">
          <span className="text-[11px] text-slate-500 font-medium">Overtime Hours</span>
          <p className="text-lg font-bold font-mono text-amber-600 mt-0.5">{totalOvertimeHours.toFixed(1)} hrs</p>
          <span className="text-[10px] text-slate-400">Hours exceeding 8.0h</span>
        </div>
        <div className="bg-white p-3.5 rounded-lg border border-slate-200">
          <span className="text-[11px] text-slate-500 font-medium">Daily Payroll Total</span>
          <p className="text-lg font-bold font-mono text-emerald-700 mt-0.5">₱{totalDailyPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
          <span className="text-[10px] text-slate-400">Regular + 1.25x Overtime</span>
        </div>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by worker name, ID, or trade..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="Present">Present</option>
          <option value="Late">Late</option>
          <option value="Half-Day">Half-Day</option>
          <option value="Absent">Absent</option>
        </select>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading daily attendance records...</div>
        ) : filteredRecords.length === 0 ? (
          <EmptyState
            title="No attendance records found"
            description={`No attendance logged for ${currentDate} with the selected filters.`}
            actionLabel={hasPermission('attendance', 'create') ? 'Record Attendance' : undefined}
            onAction={handleOpenCreate}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Worker ID</th>
                  <th className="py-2.5 px-4">Worker Name</th>
                  <th className="py-2.5 px-4">Trade</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-center">Time In</th>
                  <th className="py-2.5 px-4 text-center">Time Out</th>
                  <th className="py-2.5 px-4 text-right">Total Hours</th>
                  <th className="py-2.5 px-4 text-right">Overtime</th>
                  <th className="py-2.5 px-4 text-right">Calculated Pay</th>
                  <th className="py-2.5 px-4">Remarks</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredRecords.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-700">{r.worker_id}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{r.worker_name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{r.worker_trade}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                        r.attendance_status === 'Present'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : r.attendance_status === 'Late'
                          ? 'bg-amber-100 text-amber-800 border border-amber-200'
                          : r.attendance_status === 'Half-Day'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-red-100 text-red-800 border border-red-200'
                      }`}>
                        {r.attendance_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-slate-600">
                      {r.time_in || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-center font-mono text-slate-600">
                      {r.time_out || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {r.total_hours_worked.toFixed(1)}h
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-600 font-medium">
                      {r.overtime_hours > 0 ? `+${r.overtime_hours.toFixed(1)}h` : '0.0h'}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      ₱{r.calculated_pay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] max-w-[180px] truncate" title={r.remarks || ''}>
                      {r.remarks || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {hasPermission('attendance', 'edit') && (
                          <button
                            onClick={() => handleOpenEdit(r)}
                            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="Edit Attendance Entry"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {hasPermission('attendance', 'delete') && (
                          <button
                            onClick={() => setRecordToDelete(r)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Delete Attendance Entry"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Record Attendance Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingRecord ? `Edit Attendance: ${editingRecord.id}` : 'Record Daily Worker Attendance'}
        description="Select worker and shift hours. Hours worked and overtime are calculated automatically."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveAttendance} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Select Worker <span className="text-red-500">*</span>
              </label>
              <select
                value={formWorkerId}
                onChange={(e) => setFormWorkerId(e.target.value)}
                disabled={Boolean(editingRecord)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {workers.map(w => (
                  <option key={w.id} value={w.id}>
                    {w.id} - {w.complete_name} ({w.trade})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Attendance Status <span className="text-red-500">*</span>
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="Present">Present (Full Shift)</option>
                <option value="Late">Late Arrival</option>
                <option value="Half-Day">Half-Day (4.0 hrs)</option>
                <option value="Absent">Absent (0.0 hrs)</option>
              </select>
            </div>

            {formStatus !== 'Absent' && (
              <>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Time In (24h)
                  </label>
                  <input
                    type="time"
                    value={formTimeIn}
                    onChange={(e) => setFormTimeIn(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Time Out (24h)
                  </label>
                  <input
                    type="time"
                    value={formTimeOut}
                    onChange={(e) => setFormTimeOut(e.target.value)}
                    required
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </>
            )}

            <div className={formStatus === 'Absent' ? 'sm:col-span-2' : ''}>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Remarks / Overtime Reason
              </label>
              <input
                type="text"
                value={formRemarks}
                onChange={(e) => setFormRemarks(e.target.value)}
                placeholder="e.g. Overtime for tower pour, medical excuse, etc."
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          </div>

          {/* Automatic Calculation Preview Box */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              <span>Automated Calculation Engine:</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
              <div>
                <span className="text-[10px] text-slate-500 block">Total Shift Hours:</span>
                <span className="font-bold text-slate-900">{preview.total.toFixed(1)} hrs</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Regular Hours:</span>
                <span className="font-bold text-slate-900">{preview.regular.toFixed(1)} hrs</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Overtime Hours:</span>
                <span className="font-bold text-amber-600">+{preview.ot.toFixed(1)} hrs</span>
              </div>
            </div>
            <p className="text-[10px] text-slate-400 pt-1">
              *Applies 1 hour unpaid lunch break deduction when shift elapsed ≥ 5 hours.
            </p>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Calculating & Saving...' : editingRecord ? 'Update Record' : 'Record Attendance'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(recordToDelete)}
        onClose={() => setRecordToDelete(null)}
        onConfirm={handleDeleteRecord}
        title="Delete Attendance Record"
        message={`Are you sure you want to delete attendance record ${recordToDelete?.id} for worker ${recordToDelete?.worker_name} on ${recordToDelete?.date}?`}
        isDestructive
        confirmLabel="Delete Record"
      />
    </div>
  );
};
