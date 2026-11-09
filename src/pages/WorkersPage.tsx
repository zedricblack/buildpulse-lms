import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Filter,
  Edit2,
  Trash2,
  UserCheck,
  UserX,
  AlertCircle,
  HardHat,
  Download,
  RefreshCw,
  Check
} from 'lucide-react';
import { api } from '../services/api';
import { Worker } from '../types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';

const TRADES = [
  'Mason',
  'Carpenter',
  'Electrician',
  'Plumber',
  'General Laborer',
  'Welder',
  'Steelman',
  'Painter',
  'Tile Setter',
  'Heavy Equipment Operator'
];

const EMPLOYMENT_TYPES = ['Regular', 'Contractual', 'Daily Wage'];

export const WorkersPage: React.FC = () => {
  const { hasPermission } = useAuth();
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters & Search
  const [searchTerm, setSearchTerm] = useState('');
  const [tradeFilter, setTradeFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<Worker | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Form Fields
  const [workerId, setWorkerId] = useState('');
  const [completeName, setCompleteName] = useState('');
  const [age, setAge] = useState<number | ''>(30);
  const [contactNumber, setContactNumber] = useState('');
  const [trade, setTrade] = useState('Mason');
  const [employmentType, setEmploymentType] = useState<'Regular' | 'Contractual' | 'Daily Wage'>('Regular');
  const [dailyWageRate, setDailyWageRate] = useState<number | ''>(650);
  const [employmentStatus, setEmploymentStatus] = useState<'Active' | 'Inactive'>('Active');
  const [dateHired, setDateHired] = useState(new Date().toISOString().substring(0, 10));

  // Delete / Deactivate dialog
  const [workerToDelete, setWorkerToDelete] = useState<Worker | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadWorkers = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await api.getWorkers({
        search: searchTerm.trim() || undefined,
        trade: tradeFilter !== 'all' ? tradeFilter : undefined,
        type: typeFilter !== 'all' ? typeFilter : undefined,
        status: statusFilter !== 'all' ? statusFilter : undefined
      });
      setWorkers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      console.error('Failed to load workers:', err);
      setLoadError(err.message || 'Failed to load workers from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadWorkers();
  }, [searchTerm, tradeFilter, typeFilter, statusFilter]);

  const handleOpenCreate = () => {
    setEditingWorker(null);
    setWorkerId(`WRK-${1000 + workers.length + 1}`);
    setCompleteName('');
    setAge(32);
    setContactNumber('+63 917 ');
    setTrade('Mason');
    setEmploymentType('Regular');
    setDailyWageRate(650);
    setEmploymentStatus('Active');
    setDateHired(new Date().toISOString().substring(0, 10));
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (worker: Worker) => {
    setEditingWorker(worker);
    setWorkerId(worker.id);
    setCompleteName(worker.complete_name || (worker as any).completeName || '');
    setAge(worker.age);
    setContactNumber(worker.contact_number || (worker as any).contactNumber || '');
    setTrade(worker.trade);
    setEmploymentType((worker.employment_type || (worker as any).employmentType || 'Regular') as any);
    setDailyWageRate(Number(worker.daily_wage_rate ?? (worker as any).dailyWageRate ?? 650));
    setEmploymentStatus((worker.employment_status || (worker as any).employmentStatus || 'Active') as any);
    setDateHired(worker.date_hired || (worker as any).dateHired || '');
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId.trim() || !completeName.trim() || !age || !contactNumber.trim() || !dailyWageRate || !dateHired) {
      setFormError('Please complete all required fields.');
      return;
    }

    if (Number(age) < 18 || Number(age) > 70) {
      setFormError('Worker age must be between 18 and 70.');
      return;
    }

    if (Number(dailyWageRate) <= 0) {
      setFormError('Daily wage rate must be greater than zero.');
      return;
    }

    setIsSaving(true);
    setFormError(null);

    try {
      const payload = {
        id: workerId.trim(),
        complete_name: completeName.trim(),
        completeName: completeName.trim(),
        age: Number(age),
        contact_number: contactNumber.trim(),
        contactNumber: contactNumber.trim(),
        trade,
        employment_type: employmentType,
        employmentType: employmentType,
        daily_wage_rate: Number(dailyWageRate),
        dailyWageRate: Number(dailyWageRate),
        employment_status: employmentStatus,
        employmentStatus: employmentStatus,
        date_hired: dateHired,
        dateHired: dateHired
      };

      if (editingWorker) {
        await api.updateWorker(editingWorker.id, payload);
      } else {
        await api.createWorker(payload);
      }
      setIsFormOpen(false);
      loadWorkers();
    } catch (err: any) {
      setFormError(err.message || 'Error saving worker record.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (worker: Worker) => {
    const currentStatus = worker.employment_status || (worker as any).employmentStatus;
    const nextStatus = currentStatus === 'Active' ? 'Inactive' : 'Active';
    try {
      await api.updateWorkerStatus(worker.id, nextStatus);
      loadWorkers();
    } catch (err: any) {
      alert(err.message || 'Failed to update worker status.');
    }
  };

  const handleDeleteWorker = async () => {
    if (!workerToDelete) return;
    try {
      await api.deleteWorker(workerToDelete.id);
      setWorkerToDelete(null);
      setDeleteError(null);
      loadWorkers();
    } catch (err: any) {
      setDeleteError(err.message || 'Failed to delete worker.');
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headers = ['Worker ID', 'Complete Name', 'Trade', 'Employment Type', 'Daily Wage', 'Status', 'Date Hired', 'Contact Number', 'Age'];
    const rows = workers.map(w => [
      w.id,
      `"${w.complete_name || (w as any).completeName || ''}"`,
      `"${w.trade}"`,
      w.employment_type || (w as any).employmentType || '',
      Number(w.daily_wage_rate ?? (w as any).dailyWageRate ?? 0).toFixed(2),
      w.employment_status || (w as any).employmentStatus || '',
      w.date_hired || (w as any).dateHired || '',
      `"${w.contact_number || (w as any).contactNumber || ''}"`,
      w.age
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `workers_master_data_${new Date().toISOString().substring(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const [isSyncingFirebase, setIsSyncingFirebase] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);

  const handleSyncToFirebase = async () => {
    setIsSyncingFirebase(true);
    setSyncNotice(null);
    try {
      const res = await api.syncFirestore();
      setSyncNotice(res.message);
      setTimeout(() => setSyncNotice(null), 5000);
    } catch (err: any) {
      setSyncNotice('Sync failed: ' + (err.message || 'Unknown error'));
      setTimeout(() => setSyncNotice(null), 5000);
    } finally {
      setIsSyncingFirebase(false);
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <HardHat className="w-5 h-5 text-amber-500" />
            Worker Master Data
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Registered construction workforce directory synced to Cloud SQL & Firebase Firestore.
          </p>
          {syncNotice && (
            <p className="text-[11px] text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <Check className="w-3.5 h-3.5" />
              <span>{syncNotice}</span>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleSyncToFirebase}
            disabled={isSyncingFirebase}
            className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            title="Synchronize all workers to Firebase Firestore"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncingFirebase ? 'animate-spin' : ''}`} />
            <span>{isSyncingFirebase ? 'Syncing...' : 'Sync to Firebase'}</span>
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export CSV</span>
          </button>
          {hasPermission('workers', 'create') && (
            <button
              onClick={handleOpenCreate}
              className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Add Worker</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by worker ID or full name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>

        <select
          value={tradeFilter}
          onChange={(e) => setTradeFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none"
        >
          <option value="all">All Trades / Specializations</option>
          {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none"
        >
          <option value="all">All Employment Types</option>
          {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none"
        >
          <option value="all">All Statuses</option>
          <option value="Active">Active Only</option>
          <option value="Inactive">Inactive Only</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading worker records...</div>
        ) : loadError ? (
          <div className="p-8 text-center">
            <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs inline-flex flex-col items-center gap-2 max-w-md mx-auto">
              <AlertCircle className="w-5 h-5 text-red-600" />
              <p className="font-semibold">Unable to load workers from database</p>
              <p className="text-[11px] text-red-700">{loadError}</p>
              <button
                onClick={loadWorkers}
                className="mt-2 px-3 py-1 bg-red-600 hover:bg-red-700 text-white rounded text-xs font-medium cursor-pointer"
              >
                Retry Loading
              </button>
            </div>
          </div>
        ) : workers.length === 0 ? (
          <EmptyState
            title="No worker records found"
            description="No workers match the specified filters or search criteria."
            actionLabel={hasPermission('workers', 'create') ? 'Add First Worker' : undefined}
            onAction={handleOpenCreate}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Worker ID</th>
                  <th className="py-2.5 px-4">Complete Name</th>
                  <th className="py-2.5 px-4">Trade</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4 text-right">Daily Wage</th>
                  <th className="py-2.5 px-4">Contact</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                  <th className="py-2.5 px-4">Hired Date</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workers.map((w) => {
                  const compName = w.complete_name || (w as any).completeName || 'Unnamed Worker';
                  const empType = w.employment_type || (w as any).employmentType || 'Regular';
                  const wageRate = Number(w.daily_wage_rate ?? (w as any).dailyWageRate ?? 0);
                  const contact = w.contact_number || (w as any).contactNumber || '—';
                  const status = w.employment_status || (w as any).employmentStatus || 'Active';
                  const hired = w.date_hired || (w as any).dateHired || '—';

                  return (
                    <tr key={w.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-800">{w.id}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{compName}</td>
                      <td className="py-2.5 px-4 text-slate-700">
                        <span className="font-medium text-slate-800">{w.trade}</span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{empType}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        ₱{wageRate.toFixed(2)}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono text-[11px]">{contact}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          status === 'Active'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono">{hired}</td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {hasPermission('workers', 'edit') && (
                            <>
                              <button
                                onClick={() => handleToggleStatus(w)}
                                className={`p-1.5 rounded transition-colors cursor-pointer ${
                                  status === 'Active'
                                    ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50'
                                    : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                                }`}
                                title={status === 'Active' ? 'Deactivate Worker' : 'Activate Worker'}
                              >
                                {status === 'Active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
                              </button>
                              <button
                                onClick={() => handleOpenEdit(w)}
                                className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                                title="Edit Worker Profile"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                          {hasPermission('workers', 'delete') && (
                            <button
                              onClick={() => {
                                setWorkerToDelete(w);
                                setDeleteError(null);
                              }}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                              title="Delete Worker (Protected)"
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
          <span>Showing <strong>{workers.length}</strong> registered construction workers</span>
          <span className="font-mono text-[11px]">Database Source: workers table</span>
        </div>
      </div>

      {/* Add / Edit Worker Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingWorker ? `Edit Worker: ${editingWorker.id}` : 'Register New Construction Worker'}
        description="Fill in all mandatory profile fields, trade specializations, and daily wage rates."
        maxWidth="xl"
      >
        <form onSubmit={handleSubmitForm} className="space-y-4">
          {formError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{formError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Worker ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={workerId}
                onChange={(e) => setWorkerId(e.target.value)}
                disabled={Boolean(editingWorker)}
                required
                placeholder="e.g. WRK-1016"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Complete Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={completeName}
                onChange={(e) => setCompleteName(e.target.value)}
                required
                placeholder="First and Last Name"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Trade / Specialization <span className="text-red-500">*</span>
              </label>
              <select
                value={trade}
                onChange={(e) => setTrade(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {TRADES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Employment Type <span className="text-red-500">*</span>
              </label>
              <select
                value={employmentType}
                onChange={(e) => setEmploymentType(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                {EMPLOYMENT_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Daily Wage Rate (₱) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                step="0.01"
                min="100"
                value={dailyWageRate}
                onChange={(e) => setDailyWageRate(e.target.value === '' ? '' : Number(e.target.value))}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Age (18 - 70) <span className="text-red-500">*</span>
              </label>
              <input
                type="number"
                min="18"
                max="70"
                value={age}
                onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Contact Number <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={contactNumber}
                onChange={(e) => setContactNumber(e.target.value)}
                required
                placeholder="+63 9xx xxx xxxx"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Date Hired <span className="text-red-500">*</span>
              </label>
              <input
                type="date"
                value={dateHired}
                onChange={(e) => setDateHired(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Employment Status
              </label>
              <select
                value={employmentStatus}
                onChange={(e) => setEmploymentStatus(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? 'Saving...' : editingWorker ? 'Update Worker' : 'Save Worker Record'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Delete / Referential integrity dialog */}
      <ConfirmDialog
        isOpen={Boolean(workerToDelete)}
        onClose={() => setWorkerToDelete(null)}
        onConfirm={handleDeleteWorker}
        title={`Delete Worker ${workerToDelete?.id}`}
        message={
          deleteError
            ? deleteError
            : `Are you sure you want to delete "${workerToDelete?.complete_name}"? Note that if this worker has linked attendance, assignments, or accomplishment records, deletion will be blocked by referential integrity constraints.`
        }
        confirmLabel="Proceed with Deletion"
        isDestructive
      />
    </div>
  );
};
