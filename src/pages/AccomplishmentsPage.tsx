import React, { useState, useEffect } from 'react';
import {
  Award,
  Plus,
  Search,
  Filter,
  Download,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  Edit2,
  Trash2,
  Info
} from 'lucide-react';
import { api } from '../services/api';
import { DailyAccomplishment, WorkActivity, WorkArea, Worker } from '../types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';

interface AccomplishmentsPageProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  initialFilter?: any;
}

export const AccomplishmentsPage: React.FC<AccomplishmentsPageProps> = ({
  currentDate,
  onDateChange,
  initialFilter
}) => {
  const { hasPermission } = useAuth();
  const [accomplishments, setAccomplishments] = useState<DailyAccomplishment[]>([]);
  const [activities, setActivities] = useState<WorkActivity[]>([]);
  const [areas, setAreas] = useState<WorkArea[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters
  const [selectedDateFilter, setSelectedDateFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState(initialFilter?.status || 'all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [areaFilter, setAreaFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccomplishment, setEditingAccomplishment] = useState<DailyAccomplishment | null>(null);
  const [formDate, setFormDate] = useState(currentDate);
  const [formActivityId, setFormActivityId] = useState('');
  const [formAreaId, setFormAreaId] = useState('');
  const [formPlanned, setFormPlanned] = useState<number | ''>(100);
  const [formActual, setFormActual] = useState<number | ''>(110);
  const [formHours, setFormHours] = useState<number | ''>(16);
  const [formSelectedWorkers, setFormSelectedWorkers] = useState<string[]>([]);
  const [formRemarks, setFormRemarks] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Delete dialog
  const [accToDelete, setAccToDelete] = useState<DailyAccomplishment | null>(null);

  const sampleDates = [
    { date: 'all', label: 'All 5 Sample Days' },
    { date: '2026-10-20', label: 'Day 1 (Mon)' },
    { date: '2026-10-21', label: 'Day 2 (Tue)' },
    { date: '2026-10-22', label: 'Day 3 (Wed)' },
    { date: '2026-10-23', label: 'Day 4 (Thu)' },
    { date: '2026-10-24', label: 'Day 5 (Fri)' },
  ];

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [accData, actData, areaData, wrkData] = await Promise.all([
        api.getAccomplishments({
          date: selectedDateFilter !== 'all' ? selectedDateFilter : undefined,
          activityId: activityFilter !== 'all' ? activityFilter : undefined,
          areaId: areaFilter !== 'all' ? areaFilter : undefined,
          status: statusFilter !== 'all' ? statusFilter : undefined
        }),
        api.getActivities(),
        api.getWorkAreas(),
        api.getWorkers()
      ]);
      setAccomplishments(accData);
      setActivities(actData);
      setAreas(areaData);
      setWorkers(wrkData);
    } catch (err) {
      console.error('Failed to load accomplishments:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedDateFilter, activityFilter, areaFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingAccomplishment(null);
    setFormDate(currentDate);
    const firstAct = activities[0];
    setFormActivityId(firstAct?.id || '');
    setFormAreaId(areas[0]?.id || '');
    setFormPlanned(100);
    setFormActual(105);
    setFormHours(16);
    setFormSelectedWorkers(workers.slice(0, 2).map(w => w.id));
    setFormRemarks('');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (acc: DailyAccomplishment) => {
    setEditingAccomplishment(acc);
    setFormDate(acc.date);
    setFormActivityId(acc.activity_id);
    setFormAreaId(acc.work_area_id);
    setFormPlanned(acc.planned_quantity);
    setFormActual(acc.actual_quantity);
    setFormHours(acc.actual_labor_hours);
    setFormSelectedWorkers(acc.participants?.map(p => p.workerId) || []);
    setFormRemarks(acc.remarks || '');
    setFormError(null);
    setIsModalOpen(true);
  };

  // Preview productivity calculations in modal
  const selectedActivity = activities.find(a => a.id === formActivityId);
  const actualQtyNum = Number(formActual) || 0;
  const hoursNum = Number(formHours) || 0;
  const plannedQtyNum = Number(formPlanned) || 0;
  const previewActualRate = hoursNum > 0 ? Math.round((actualQtyNum / hoursNum) * 100) / 100 : 0;
  const previewProdPercent = selectedActivity?.target_productivity_rate
    ? Math.round((previewActualRate / selectedActivity.target_productivity_rate) * 1000) / 10
    : 0;
  const previewPlanPercent = plannedQtyNum > 0 ? Math.round((actualQtyNum / plannedQtyNum) * 1000) / 10 : 0;
  const isBelowTarget = previewProdPercent < 95.0 && hoursNum > 0;

  const handleSaveAccomplishment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formDate || !formActivityId || !formAreaId || formPlanned === '' || formActual === '' || !formHours) {
      setFormError('Please complete all fields.');
      return;
    }

    if (Number(formHours) <= 0) {
      setFormError('Labor hours must be greater than zero.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      if (editingAccomplishment) {
        await api.updateAccomplishment(editingAccomplishment.id, {
          date: formDate,
          activityId: formActivityId,
          workAreaId: formAreaId,
          plannedQuantity: Number(formPlanned),
          actualQuantity: Number(formActual),
          actualLaborHours: Number(formHours),
          workerIds: formSelectedWorkers,
          remarks: formRemarks
        });
      } else {
        await api.createAccomplishment({
          date: formDate,
          activityId: formActivityId,
          workAreaId: formAreaId,
          plannedQuantity: Number(formPlanned),
          actualQuantity: Number(formActual),
          actualLaborHours: Number(formHours),
          workerIds: formSelectedWorkers,
          remarks: formRemarks
        });
      }
      setIsModalOpen(false);
      loadData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save accomplishment record.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteAccomplishment = async () => {
    if (!accToDelete) return;
    try {
      await api.deleteAccomplishment(accToDelete.id);
      setAccToDelete(null);
      loadData();
    } catch (err: any) {
      alert(err.message || 'Failed to delete accomplishment.');
    }
  };

  const toggleWorkerSelection = (wId: string) => {
    if (formSelectedWorkers.includes(wId)) {
      setFormSelectedWorkers(formSelectedWorkers.filter(id => id !== wId));
    } else {
      setFormSelectedWorkers([...formSelectedWorkers, wId]);
    }
  };

  const filteredAccomplishments = accomplishments.filter(acc => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      acc.id.toLowerCase().includes(s) ||
      (acc.activity_name && acc.activity_name.toLowerCase().includes(s)) ||
      (acc.area_name && acc.area_name.toLowerCase().includes(s)) ||
      (acc.remarks && acc.remarks.toLowerCase().includes(s))
    );
  });

  const belowTargetCount = filteredAccomplishments.filter(a => a.performance_status === 'Below Target').length;

  const handleExportCSV = () => {
    const headers = ['Accomplishment ID', 'Date', 'Activity', 'Work Area', 'Planned Qty', 'Actual Qty', 'Unit', 'Labor Hours', 'Actual Rate', 'Target Rate', 'Prod Ach %', 'Plan Ach %', 'Performance Status', 'Assigned Workers', 'Remarks'];
    const rows = filteredAccomplishments.map(a => [
      a.id,
      a.date,
      `"${a.activity_name || ''}"`,
      `"${a.area_name || ''}"`,
      a.planned_quantity,
      a.actual_quantity,
      a.unit_of_measurement,
      a.actual_labor_hours,
      a.actual_productivity_rate,
      a.target_productivity_rate || 'N/A',
      a.productivity_achievement_percent,
      a.planned_achievement_percent,
      a.performance_status,
      `"${a.participants?.map(p => p.name).join('; ') || ''}"`,
      `"${a.remarks || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `daily_accomplishments_${new Date().toISOString().substring(0, 10)}.csv`);
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
            <Award className="w-5 h-5 text-amber-500" />
            Daily Accomplishment Records
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Physical work accomplishment tracking, labor hours attribution, and automated productivity rate analytics.
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
          {hasPermission('accomplishments', 'create') && (
            <button
              onClick={handleOpenCreate}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Record Accomplishment</span>
            </button>
          )}
        </div>
      </div>

      {/* Date Switcher Tabs */}
      <div className="bg-white p-3 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1.5 overflow-x-auto py-1">
          <span className="text-xs font-medium text-slate-500 pr-1 shrink-0">Filter Date:</span>
          {sampleDates.map(d => (
            <button
              key={d.date}
              onClick={() => setSelectedDateFilter(d.date)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors shrink-0 cursor-pointer ${
                selectedDateFilter === d.date
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {d.label}
            </button>
          ))}
        </div>

        {belowTargetCount > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-semibold">
            <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
            <span>{belowTargetCount} Records Below Target Benchmark</span>
          </div>
        )}
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search activity, area, or remarks..."
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
          <option value="all">All Performance Levels</option>
          <option value="Above Target">Above Target (≥ 105%)</option>
          <option value="Met Target">Met Target (95% - 104%)</option>
          <option value="Below Target">Below Target (&lt; 95%)</option>
        </select>
      </div>

      {/* Accomplishments Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading daily accomplishments...</div>
        ) : filteredAccomplishments.length === 0 ? (
          <EmptyState
            title="No accomplishment records found"
            description="No records match your selected date or performance filter."
            actionLabel={hasPermission('accomplishments', 'create') ? 'Record Accomplishment' : undefined}
            onAction={handleOpenCreate}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Activity Name</th>
                  <th className="py-2.5 px-4">Work Location</th>
                  <th className="py-2.5 px-4 text-right">Planned</th>
                  <th className="py-2.5 px-4 text-right">Actual Qty</th>
                  <th className="py-2.5 px-4 text-right">Labor Hours</th>
                  <th className="py-2.5 px-4 text-right">Actual Rate</th>
                  <th className="py-2.5 px-4 text-right">Target Rate</th>
                  <th className="py-2.5 px-4 text-right">Achieve %</th>
                  <th className="py-2.5 px-4 text-center">Performance Status</th>
                  <th className="py-2.5 px-4">Participating Team</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccomplishments.map((acc) => {
                  const isUnder = acc.performance_status === 'Below Target';
                  return (
                    <tr
                      key={acc.id}
                      className={`hover:bg-slate-50/70 transition-colors ${isUnder ? 'bg-amber-50/20' : ''}`}
                    >
                      <td className="py-2.5 px-4 font-mono text-slate-600">{acc.date}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {acc.activity_name}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{acc.area_name}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                        {acc.planned_quantity} {acc.unit_of_measurement}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        {acc.actual_quantity} {acc.unit_of_measurement}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-700">
                        {acc.actual_labor_hours.toFixed(1)}h
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {acc.actual_productivity_rate.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500">
                        {acc.target_productivity_rate ? acc.target_productivity_rate.toFixed(2) : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold">
                        <span className={
                          acc.productivity_achievement_percent >= 105
                            ? 'text-emerald-600'
                            : acc.productivity_achievement_percent >= 95
                            ? 'text-slate-800'
                            : 'text-red-600'
                        }>
                          {acc.productivity_achievement_percent.toFixed(1)}%
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          acc.performance_status === 'Below Target'
                            ? 'bg-red-100 text-red-800 border border-red-200'
                            : acc.performance_status === 'Above Target'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-800 border border-slate-200'
                        }`}>
                          {acc.performance_status === 'Below Target' ? (
                            <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                          ) : (
                            <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                          )}
                          {acc.performance_status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4">
                        {acc.participants && acc.participants.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {acc.participants.map(p => (
                              <span key={p.workerId} className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px]">
                                {p.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasPermission('accomplishments', 'edit') && (
                            <button
                              onClick={() => handleOpenEdit(acc)}
                              className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                              title="Edit Accomplishment"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {hasPermission('accomplishments', 'delete') && (
                            <button
                              onClick={() => setAccToDelete(acc)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="Delete Accomplishment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>Showing <strong>{filteredAccomplishments.length}</strong> daily accomplishment entries across 5-day cycle</span>
          <span className="font-mono text-[11px]">Database Source: daily_accomplishments & accomplishment_participants</span>
        </div>
      </div>

      {/* Add / Edit Accomplishment Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingAccomplishment ? `Edit Accomplishment: ${editingAccomplishment.id}` : 'Record Daily Work Accomplishment'}
        description="Enter actual work output against target productivity benchmarks and attribute labor hours."
        maxWidth="2xl"
      >
        <form onSubmit={handleSaveAccomplishment} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                Work Area <span className="text-red-500">*</span>
              </label>
              <select
                value={formAreaId}
                onChange={(e) => setFormAreaId(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {areas.map(area => (
                  <option key={area.id} value={area.id}>{area.area_name}</option>
                ))}
              </select>
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
                    {act.id} - {act.activity_name} (Unit: {act.unit_of_measurement}, Target Rate: {act.target_productivity_rate} {act.unit_of_measurement}/h)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Planned Quantity ({selectedActivity?.unit_of_measurement || 'units'}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={formPlanned}
                onChange={(e) => setFormPlanned(e.target.value === '' ? '' : Number(e.target.value))}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Actual Accomplished Quantity ({selectedActivity?.unit_of_measurement || 'units'}) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formActual}
                onChange={(e) => setFormActual(e.target.value === '' ? '' : Number(e.target.value))}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Attributable Actual Labor Hours <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0.5"
                value={formHours}
                onChange={(e) => setFormHours(e.target.value === '' ? '' : Number(e.target.value))}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Supervisor Remarks / Variance Cause
              </label>
              <input
                type="text"
                value={formRemarks}
                onChange={(e) => setFormRemarks(e.target.value)}
                placeholder="e.g. Rain stoppage, extra rock excavation"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {/* Participating Workers Team Selection */}
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1.5">
                Participating Workers / Team Members ({formSelectedWorkers.length} selected)
              </label>
              <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-lg p-2 grid grid-cols-2 sm:grid-cols-3 gap-1.5 bg-slate-50/50">
                {workers.map(w => {
                  const isSelected = formSelectedWorkers.includes(w.id);
                  return (
                    <button
                      type="button"
                      key={w.id}
                      onClick={() => toggleWorkerSelection(w.id)}
                      className={`px-2 py-1.5 rounded text-left text-xs transition-colors cursor-pointer border ${
                        isSelected
                          ? 'bg-amber-500 text-slate-950 border-amber-600 font-semibold shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <span className="block truncate font-mono text-[10px]">{w.id}</span>
                      <span className="block truncate">{w.complete_name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Productivity Preview Engine Box */}
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-1 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-slate-700">
              <Info className="w-3.5 h-3.5 text-blue-600" />
              <span>Real-Time Productivity Rate Computation:</span>
            </div>
            <div className="grid grid-cols-3 gap-2 pt-1 font-mono">
              <div>
                <span className="text-[10px] text-slate-500 block">Actual Productivity:</span>
                <span className="font-bold text-slate-900">
                  {previewActualRate.toFixed(2)} {selectedActivity?.unit_of_measurement}/h
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Target Benchmark:</span>
                <span className="font-bold text-slate-900">
                  {selectedActivity?.target_productivity_rate || 0} {selectedActivity?.unit_of_measurement}/h
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block">Achievement %:</span>
                <span className={`font-bold ${isBelowTarget ? 'text-red-600' : 'text-emerald-600'}`}>
                  {previewProdPercent.toFixed(1)}% {isBelowTarget ? '(Below Target)' : '(On/Above)'}
                </span>
              </div>
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
              {isSaving ? 'Calculating & Saving...' : editingAccomplishment ? 'Update Accomplishment' : 'Save Accomplishment'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete Dialog */}
      <ConfirmDialog
        isOpen={Boolean(accToDelete)}
        onClose={() => setAccToDelete(null)}
        onConfirm={handleDeleteAccomplishment}
        title="Delete Accomplishment Record"
        message={`Are you sure you want to delete accomplishment ${accToDelete?.id} for ${accToDelete?.activity_name} on ${accToDelete?.date}?`}
        isDestructive
        confirmLabel="Delete Accomplishment"
      />
    </div>
  );
};
