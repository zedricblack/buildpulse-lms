import React, { useState, useEffect } from 'react';
import {
  Briefcase,
  Plus,
  Search,
  Filter,
  Download,
  Edit2,
  Trash2,
  CheckCircle,
  Clock,
  PlayCircle,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { LaborAssignment, Worker, WorkActivity, WorkArea, Supervisor } from '../types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';

interface AssignmentsPageProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  initialFilter?: any;
}

export const AssignmentsPage: React.FC<AssignmentsPageProps> = ({
  currentDate,
  onDateChange,
  initialFilter
}) => {
  const { hasPermission } = useAuth();
  const [assignments, setAssignments] = useState<LaborAssignment[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [activities, setActivities] = useState<WorkActivity[]>([]);
  const [areas, setAreas] = useState<WorkArea[]>([]);
  const [supervisors, setSupervisors] = useState<Supervisor[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState(initialFilter?.status || 'all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [supervisorFilter, setSupervisorFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<LaborAssignment | null>(null);
  const [formWorkerId, setFormWorkerId] = useState('');
  const [formDate, setFormDate] = useState(currentDate);
  const [formActivityId, setFormActivityId] = useState('');
  const [formAreaId, setFormAreaId] = useState('');
  const [formSupervisorId, setFormSupervisorId] = useState('');
  const [formStatus, setFormStatus] = useState<'Assigned' | 'In Progress' | 'Completed'>('Assigned');
  const [formNotes, setFormNotes] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [assignmentToDelete, setAssignmentToDelete] = useState<LaborAssignment | null>(null);

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
      const [asnData, wrkData, actData, areaData, supData] = await Promise.all([
        api.getAssignments({
          date: currentDate,
          status: statusFilter !== 'all' ? statusFilter : undefined,
          activityId: activityFilter !== 'all' ? activityFilter : undefined,
          areaId: areaFilter !== 'all' ? areaFilter : undefined,
          supervisorId: supervisorFilter !== 'all' ? supervisorFilter : undefined
        }),
        api.getWorkers(),
        api.getActivities(),
        api.getWorkAreas(),
        api.getSupervisors()
      ]);
      setAssignments(asnData);
      setWorkers(wrkData);
      setActivities(actData);
      setAreas(areaData);
      setSupervisors(supData);
    } catch (err) {
      console.error('Failed to load assignments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [currentDate, statusFilter, activityFilter, areaFilter, supervisorFilter]);

  const handleOpenCreate = () => {
    setEditingAssignment(null);
    setFormWorkerId(workers.find(w => w.employment_status === 'Active')?.id || '');
    setFormDate(currentDate);
    setFormActivityId(activities[0]?.id || '');
    setFormAreaId(areas[0]?.id || '');
    setFormSupervisorId(supervisors[0]?.id || '');
    setFormStatus('Assigned');
    setFormNotes('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (asn: LaborAssignment) => {
    setEditingAssignment(asn);
    setFormWorkerId(asn.worker_id);
    setFormDate(asn.date);
    setFormActivityId(asn.activity_id);
    setFormAreaId(asn.work_area_id);
    setFormSupervisorId(asn.supervisor_id);
    setFormStatus(asn.assignment_status);
    setFormNotes(asn.notes || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveAssignment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formWorkerId || !formDate || !formActivityId || !formAreaId || !formSupervisorId) {
      setFormError('Please fill in all required assignment references.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingAssignment) {
        await api.updateAssignment(editingAssignment.id, {
          workerId: formWorkerId,
          date: formDate,
          activityId: formActivityId,
          workAreaId: formAreaId,
          supervisorId: formSupervisorId,
          assignmentStatus: formStatus,
          notes: formNotes
        });
      } else {
        await api.createAssignment({
          workerId: formWorkerId,
          date: formDate,
          activityId: formActivityId,
          workAreaId: formAreaId,
          supervisorId: formSupervisorId,
          assignmentStatus: formStatus,
          notes: formNotes
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Error saving assignment.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleQuickStatusChange = async (id: string, nextStatus: string) => {
    try {
      await api.updateAssignmentStatus(id, nextStatus);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to update assignment status.');
    }
  };

  const handleDeleteAssignment = async () => {
    if (!assignmentToDelete) return;
    try {
      await api.deleteAssignment(assignmentToDelete.id);
      setAssignmentToDelete(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete assignment.');
    }
  };

  const filteredAssignments = assignments.filter(a => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      a.worker_id.toLowerCase().includes(s) ||
      (a.worker_name && a.worker_name.toLowerCase().includes(s)) ||
      (a.activity_name && a.activity_name.toLowerCase().includes(s)) ||
      (a.area_name && a.area_name.toLowerCase().includes(s)) ||
      (a.supervisor_name && a.supervisor_name.toLowerCase().includes(s))
    );
  });

  const handleExportCSV = () => {
    const headers = ['Assignment ID', 'Date', 'Worker ID', 'Worker Name', 'Trade', 'Activity Name', 'Work Area', 'Supervisor', 'Status', 'Notes'];
    const rows = filteredAssignments.map(a => [
      a.id,
      a.date,
      a.worker_id,
      `"${a.worker_name || ''}"`,
      `"${a.worker_trade || ''}"`,
      `"${a.activity_name || ''}"`,
      `"${a.area_name || ''}"`,
      `"${a.supervisor_name || ''}"`,
      a.assignment_status,
      `"${a.notes || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `labor_assignments_${currentDate}.csv`);
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
            <Briefcase className="w-5 h-5 text-amber-500" />
            Daily Labor Assignment
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Worker task scheduling, jobsite location routing, and supervisor oversight allocation.
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
          {hasPermission('assignments', 'create') && (
            <button
              onClick={handleOpenCreate}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Assign Worker</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Switcher */}
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

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by worker, activity, or area..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>

        <select
          value={activityFilter}
          onChange={(e) => setActivityFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none"
        >
          <option value="all">All Activities</option>
          {activities.map(a => <option key={a.id} value={a.id}>{a.activity_name}</option>)}
        </select>

        <select
          value={areaFilter}
          onChange={(e) => setAreaFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none"
        >
          <option value="all">All Work Areas</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.area_name}</option>)}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="Assigned">Assigned</option>
          <option value="In Progress">In Progress</option>
          <option value="Completed">Completed</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading daily assignments...</div>
        ) : filteredAssignments.length === 0 ? (
          <EmptyState
            title="No labor assignments found"
            description={`No worker assignments recorded for ${currentDate} with the selected filters.`}
            actionLabel={hasPermission('assignments', 'create') ? 'Create Assignment' : undefined}
            onAction={handleOpenCreate}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Worker ID</th>
                  <th className="py-2.5 px-4">Worker Name & Trade</th>
                  <th className="py-2.5 px-4">Assigned Work Activity</th>
                  <th className="py-2.5 px-4">Jobsite Work Area</th>
                  <th className="py-2.5 px-4">Supervisor</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4">Notes</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAssignments.map((a) => (
                  <tr key={a.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-700">{a.worker_id}</td>
                    <td className="py-2.5 px-4">
                      <p className="font-semibold text-slate-900 leading-snug">{a.worker_name}</p>
                      <span className="text-[11px] text-slate-500">{a.worker_trade}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <p className="font-medium text-slate-800 leading-snug">{a.activity_name}</p>
                      <span className="text-[10px] text-slate-400 font-mono">Unit: {a.unit_of_measurement}</span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-700">{a.area_name}</td>
                    <td className="py-2.5 px-4 text-slate-600 font-medium">{a.supervisor_name}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                        a.assignment_status === 'Completed'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : a.assignment_status === 'In Progress'
                          ? 'bg-blue-100 text-blue-800 border border-blue-200'
                          : 'bg-slate-100 text-slate-700 border border-slate-200'
                      }`}>
                        {a.assignment_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500 text-[11px] max-w-[180px] truncate" title={a.notes || ''}>
                      {a.notes || '—'}
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {hasPermission('assignments', 'edit') && (
                          <>
                            {a.assignment_status !== 'Completed' && (
                              <button
                                onClick={() => handleQuickStatusChange(a.id, 'Completed')}
                                className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                title="Mark Assignment Completed"
                              >
                                <CheckCircle className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              onClick={() => handleOpenEdit(a)}
                              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Edit Assignment"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                        {hasPermission('assignments', 'delete') && (
                          <button
                            onClick={() => setAssignmentToDelete(a)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Delete Assignment"
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
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>Total Assigned Workforce for {currentDate}: <strong>{filteredAssignments.length}</strong></span>
          <span className="font-mono text-[11px]">Database Source: daily_labor_assignments</span>
        </div>
      </div>

      {/* Add / Edit Assignment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAssignment ? `Edit Assignment: ${editingAssignment.id}` : 'Create Daily Labor Assignment'}
        description="Assign a construction worker to a validated activity, work zone, and site supervisor."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveAssignment} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
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
                disabled={Boolean(editingAssignment)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {workers.map(w => (
                  <option key={w.id} value={w.id} disabled={w.employment_status !== 'Active'}>
                    {w.id} - {w.complete_name} ({w.trade}) {w.employment_status !== 'Active' ? '[INACTIVE]' : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Assignment Date <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={formDate}
                onChange={(e) => setFormDate(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Work Activity Master <span className="text-red-500">*</span>
              </label>
              <select
                value={formActivityId}
                onChange={(e) => setFormActivityId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {activities.map(act => (
                  <option key={act.id} value={act.id}>
                    {act.id} - {act.activity_name} (Target: {act.target_productivity_rate} {act.unit_of_measurement}/h)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Project Location / Work Area <span className="text-red-500">*</span>
              </label>
              <select
                value={formAreaId}
                onChange={(e) => setFormAreaId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {areas.map(area => (
                  <option key={area.id} value={area.id}>
                    {area.id} - {area.area_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Assigned Supervisor <span className="text-red-500">*</span>
              </label>
              <select
                value={formSupervisorId}
                onChange={(e) => setFormSupervisorId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {supervisors.map(sup => (
                  <option key={sup.id} value={sup.id}>
                    {sup.full_name} ({sup.role_title})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Assignment Status
              </label>
              <select
                value={formStatus}
                onChange={(e) => setFormStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="Assigned">Assigned</option>
                <option value="In Progress">In Progress</option>
                <option value="Completed">Completed</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Task Scope Notes
              </label>
              <input
                type="text"
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                placeholder="Specific instructions or area grid"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
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
              {isSaving ? 'Assigning...' : editingAssignment ? 'Update Assignment' : 'Save Assignment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(assignmentToDelete)}
        onClose={() => setAssignmentToDelete(null)}
        onConfirm={handleDeleteAssignment}
        title="Delete Labor Assignment"
        message={`Are you sure you want to delete assignment ${assignmentToDelete?.id} for worker ${assignmentToDelete?.worker_name} on ${assignmentToDelete?.date}?`}
        isDestructive
        confirmLabel="Delete Assignment"
      />
    </div>
  );
};
