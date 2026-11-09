import React, { useState, useEffect } from 'react';
import {
  Layers,
  Plus,
  Search,
  Edit2,
  CheckCircle,
  XCircle,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { WorkActivity } from '../types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { EmptyState } from '../components/common/EmptyState';

const UNITS = ['m³', 'm²', 'm', 'kg', 'pcs', 'tons'];

export const ActivitiesPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const [activities, setActivities] = useState<WorkActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Add / Edit Modal
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<WorkActivity | null>(null);
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formUnit, setFormUnit] = useState('m²');
  const [formTarget, setFormTarget] = useState<number | ''>(2.0);
  const [formStatus, setFormStatus] = useState<'Active' | 'Inactive'>('Active');
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadActivities = async () => {
    setIsLoading(true);
    try {
      const data = await api.getActivities();
      setActivities(data);
    } catch (err) {
      console.error('Failed to load activities:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadActivities();
  }, []);

  const handleOpenCreate = () => {
    setEditingActivity(null);
    setFormId(`ACT-${String(activities.length + 1).padStart(2, '0')}`);
    setFormName('');
    setFormDesc('');
    setFormUnit('m²');
    setFormTarget(2.5);
    setFormStatus('Active');
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleOpenEdit = (act: WorkActivity) => {
    setEditingActivity(act);
    setFormId(act.id);
    setFormName(act.activity_name);
    setFormDesc(act.description_of_work);
    setFormUnit(act.unit_of_measurement);
    setFormTarget(act.target_productivity_rate);
    setFormStatus(act.activity_status);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSaveActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formId.trim() || !formName.trim() || !formUnit.trim() || !formTarget) {
      setFormError('Activity ID, Name, Unit, and Target Rate are required.');
      return;
    }

    if (Number(formTarget) <= 0) {
      setFormError('Target productivity rate must be greater than zero.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const payload = {
        id: formId.trim(),
        activity_name: formName.trim(),
        activityName: formName.trim(),
        description_of_work: formDesc.trim(),
        descriptionOfWork: formDesc.trim(),
        unit_of_measurement: formUnit.trim(),
        unitOfMeasurement: formUnit.trim(),
        target_productivity_rate: Number(formTarget),
        targetProductivityRate: Number(formTarget),
        activity_status: formStatus,
        activityStatus: formStatus
      };

      if (editingActivity) {
        await api.updateActivity(editingActivity.id, payload);
      } else {
        await api.createActivity(payload);
      }
      setIsModalOpen(false);
      loadActivities();
    } catch (err: any) {
      setFormError(err.message || 'Error saving work activity.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (act: WorkActivity) => {
    const nextStatus = act.activity_status === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.updateActivityStatus(act.id, nextStatus);
      loadActivities();
    } catch (err: any) {
      alert(err.message || 'Failed to update status.');
    }
  };

  const filteredActivities = activities.filter(a => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      a.id.toLowerCase().includes(s) ||
      a.activity_name.toLowerCase().includes(s) ||
      a.description_of_work.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-500" />
            Work Activity Master Data
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Catalog of construction activities, work scope definitions, standard units, and benchmark productivity rates.
          </p>
        </div>
        {hasPermission('activities', 'create') && (
          <button
            onClick={handleOpenCreate}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Work Activity</span>
          </button>
        )}
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search activities by code, name, or description..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
      </div>

      {/* Activities Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading work activities catalog...</div>
        ) : filteredActivities.length === 0 ? (
          <EmptyState
            title="No activities found"
            description="No work activities found matching your search term."
            actionLabel={hasPermission('activities', 'create') ? 'Add Activity' : undefined}
            onAction={handleOpenCreate}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Activity ID</th>
                  <th className="py-2.5 px-4">Activity Name</th>
                  <th className="py-2.5 px-4">Description of Work Scope</th>
                  <th className="py-2.5 px-4 text-center">Unit</th>
                  <th className="py-2.5 px-4 text-right">Target Productivity Rate</th>
                  <th className="py-2.5 px-4 text-center">Linked Records</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredActivities.map((act) => (
                  <tr key={act.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-700">{act.id}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{act.activity_name}</td>
                    <td className="py-2.5 px-4 text-slate-600 max-w-sm leading-relaxed">{act.description_of_work}</td>
                    <td className="py-2.5 px-4 text-center font-mono font-medium text-slate-800 bg-slate-50/60">
                      {act.unit_of_measurement}
                    </td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {act.target_productivity_rate.toFixed(2)} {act.unit_of_measurement} / labor-hr
                    </td>
                    <td className="py-2.5 px-4 text-center text-slate-500 font-mono text-[11px]">
                      {act.assignment_count || 0} assignments
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                        act.activity_status === 'Active'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}>
                        {act.activity_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-right">
                      {hasPermission('activities', 'edit') && (
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleToggleStatus(act)}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title={act.activity_status === 'Active' ? 'Deactivate Activity' : 'Activate Activity'}
                          >
                            {act.activity_status === 'Active' ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => handleOpenEdit(act)}
                            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="Edit Activity"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>Total Registered Construction Activities: <strong>{filteredActivities.length}</strong> (Minimum required: 10)</span>
          <span className="font-mono text-[11px]">Database Source: work_activities</span>
        </div>
      </div>

      {/* Add / Edit Activity Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        title={editingActivity ? `Edit Activity: ${editingActivity.id}` : 'Create New Work Activity'}
        description="Configure construction trade activity, unit of measurement, and target output benchmark."
        maxWidth="lg"
      >
        <form onSubmit={handleSaveActivity} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Activity ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formId}
                onChange={(e) => setFormId(e.target.value)}
                disabled={Boolean(editingActivity)}
                required
                placeholder="e.g. ACT-11"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 disabled:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Activity Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                required
                placeholder="e.g. Scaffolding Dismantling"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Description of Work Scope
              </label>
              <textarea
                value={formDesc}
                onChange={(e) => setFormDesc(e.target.value)}
                rows={2}
                placeholder="Detailed scope, materials involved, and methodology"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Unit of Measurement <span className="text-red-500">*</span>
              </label>
              <select
                value={formUnit}
                onChange={(e) => setFormUnit(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Target Productivity Rate (unit / labor-hr) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.1"
                min="0.1"
                value={formTarget}
                onChange={(e) => setFormTarget(e.target.value === '' ? '' : Number(e.target.value))}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            {editingActivity && (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Status
                </label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>
            )}
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
              {isSaving ? 'Saving...' : editingActivity ? 'Update Activity' : 'Save Work Activity'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
