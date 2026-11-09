import React, { useState, useEffect } from 'react';
import {
  FileText,
  Search,
  Filter,
  Shield,
  Download,
  Clock,
  User,
  Activity
} from 'lucide-react';
import { api } from '../services/api';
import { AuditLog } from '../types';
import { EmptyState } from '../components/common/EmptyState';

const MODULES = [
  'Authentication',
  'Worker Master Data',
  'Attendance Management',
  'Daily Labor Assignment',
  'Work Activity Master Data',
  'Daily Accomplishment Records',
  'User Management',
  'System Settings'
];

const ACTIONS = [
  'LOGIN',
  'LOGOUT',
  'CREATE',
  'UPDATE',
  'DELETE',
  'ACTIVATE',
  'DEACTIVATE',
  'STATUS_CHANGE',
  'RESET_PASSWORD',
  'RESET_REQUEST',
  'SETTINGS_UPDATE',
  'SEED_RESET'
];

export const AuditLogPage: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [moduleFilter, setModuleFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  const loadLogs = async () => {
    setIsLoading(true);
    try {
      const data = await api.getAuditLogs({
        module: moduleFilter !== 'all' ? moduleFilter : undefined,
        action: actionFilter !== 'all' ? actionFilter : undefined,
        search: searchTerm || undefined
      });
      setLogs(data);
    } catch (err) {
      console.error('Failed to load audit logs:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadLogs();
  }, [moduleFilter, actionFilter, searchTerm]);

  const handleExportCSV = () => {
    const headers = ['Audit ID', 'Timestamp', 'User', 'Action', 'Module', 'Record ID', 'Change Details'];
    const rows = logs.map(l => [
      l.id,
      l.created_at,
      `"${l.user_name || 'System'}"`,
      l.action,
      `"${l.module}"`,
      `"${l.record_id || ''}"`,
      `"${l.details.replace(/"/g, '""')}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `system_audit_logs_${new Date().toISOString().substring(0, 10)}.csv`);
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
            <FileText className="w-5 h-5 text-amber-500" />
            System Audit & Accountability Logs
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Immutable, server-recorded trail of security events, administrative adjustments, and operational transactions.
          </p>
        </div>
        <button
          onClick={handleExportCSV}
          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5 text-slate-500" />
          <span>Export Logs CSV</span>
        </button>
      </div>

      {/* Filter / Search Bar */}
      <div className="bg-white p-4 rounded-lg border border-slate-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="relative lg:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search details, actor, or record ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>

        <select
          value={moduleFilter}
          onChange={(e) => setModuleFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none"
        >
          <option value="all">All Modules</option>
          {MODULES.map(m => <option key={m} value={m}>{m}</option>)}
        </select>

        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="text-xs border border-slate-200 rounded-lg px-3 py-1.5 text-slate-700 bg-white focus:outline-none"
        >
          <option value="all">All Action Types</option>
          {ACTIONS.map(a => <option key={a} value={a}>{a}</option>)}
        </select>
      </div>

      {/* Audit Log Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading audit records...</div>
        ) : logs.length === 0 ? (
          <EmptyState
            title="No audit log entries found"
            description="No system activities match the specified filter criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Audit ID</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">User / Actor</th>
                  <th className="py-2.5 px-4 text-center">Action</th>
                  <th className="py-2.5 px-4">Module</th>
                  <th className="py-2.5 px-4">Record Ref</th>
                  <th className="py-2.5 px-4">Action Summary & Change Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2.5 px-4 text-slate-500">{log.id}</td>
                    <td className="py-2.5 px-4 text-slate-600 font-sans">
                      {new Date(log.created_at).toLocaleString()}
                    </td>
                    <td className="py-2.5 px-4 font-sans font-medium text-slate-800">
                      {log.user_name || 'System'}
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${
                        log.action === 'CREATE' ? 'bg-emerald-100 text-emerald-800' :
                        log.action === 'UPDATE' ? 'bg-blue-100 text-blue-800' :
                        log.action === 'DELETE' ? 'bg-red-100 text-red-800' :
                        log.action === 'LOGIN' ? 'bg-slate-100 text-slate-800' :
                        'bg-amber-100 text-amber-800'
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 font-sans font-semibold text-slate-800">{log.module}</td>
                    <td className="py-2.5 px-4 text-slate-500">{log.record_id || '—'}</td>
                    <td className="py-2.5 px-4 font-sans text-slate-700 leading-relaxed">{log.details}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 text-xs text-slate-500 flex items-center justify-between">
          <span>Displaying <strong>{logs.length}</strong> logged transactions</span>
          <span className="font-mono text-[11px]">Protected Database Table: audit_logs</span>
        </div>
      </div>
    </div>
  );
};
