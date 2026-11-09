import React, { useState, useEffect } from 'react';
import {
  BarChart3,
  Calendar,
  Download,
  Printer,
  FileSpreadsheet,
  Clock,
  DollarSign,
  Award,
  Users,
  AlertTriangle
} from 'lucide-react';
import { api } from '../services/api';
import { AttendanceRecord, Worker, WorkActivity, DailyAccomplishment, LaborAssignment } from '../types';

type ReportTab = 'attendance' | 'payroll' | 'productivity' | 'manpower';

export const ReportsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('attendance');
  const [isLoading, setIsLoading] = useState(true);

  // Raw dataset
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [activities, setActivities] = useState<WorkActivity[]>([]);
  const [accomplishments, setAccomplishments] = useState<DailyAccomplishment[]>([]);
  const [assignments, setAssignments] = useState<LaborAssignment[]>([]);

  // Filter state
  const [selectedPeriod, setSelectedPeriod] = useState('all');

  const sampleDates = [
    { value: 'all', label: 'Complete 5-Day Demonstration Cycle (Oct 20-24, 2026)' },
    { value: '2026-10-20', label: 'Day 1: Oct 20, 2026' },
    { value: '2026-10-21', label: 'Day 2: Oct 21, 2026' },
    { value: '2026-10-22', label: 'Day 3: Oct 22, 2026' },
    { value: '2026-10-23', label: 'Day 4: Oct 23, 2026' },
    { value: '2026-10-24', label: 'Day 5: Oct 24, 2026' },
  ];

  useEffect(() => {
    setIsLoading(true);
    Promise.all([
      api.getAttendance(),
      api.getWorkers(),
      api.getActivities(),
      api.getAccomplishments(),
      api.getAssignments()
    ]).then(([attData, wrkData, actData, accData, asData]) => {
      setAttendance(attData);
      setWorkers(wrkData);
      setActivities(actData);
      setAccomplishments(accData);
      setAssignments(asData);
      setIsLoading(false);
    }).catch(err => {
      console.error('Failed to load report datasets:', err);
      setIsLoading(false);
    });
  }, []);

  const handlePrint = () => {
    window.print();
  };

  // Filter attendance by period
  const filteredAttendance = selectedPeriod === 'all'
    ? attendance
    : attendance.filter(a => a.date === selectedPeriod);

  // Filter accomplishments by period
  const filteredAccomplishments = selectedPeriod === 'all'
    ? accomplishments
    : accomplishments.filter(a => a.date === selectedPeriod);

  // Aggregated Payroll calculation by Trade
  const tradePayroll = workers.reduce((acc, w) => {
    if (!acc[w.trade]) {
      acc[w.trade] = { count: 0, regularHours: 0, otHours: 0, totalPay: 0, totalHours: 0 };
    }
    acc[w.trade].count++;

    const workerAtts = filteredAttendance.filter(a => a.worker_id === w.id);
    for (const a of workerAtts) {
      acc[w.trade].regularHours += a.regular_hours;
      acc[w.trade].otHours += a.overtime_hours;
      acc[w.trade].totalHours += a.total_hours_worked;
      acc[w.trade].totalPay += a.calculated_pay;
    }
    return acc;
  }, {} as Record<string, { count: number; regularHours: number; otHours: number; totalPay: number; totalHours: number }>);

  // Export handlers
  const handleExportCSV = () => {
    let headers: string[] = [];
    let rows: any[][] = [];
    let filename = `report_${activeTab}_${selectedPeriod}.csv`;

    if (activeTab === 'attendance') {
      headers = ['Date', 'Worker ID', 'Name', 'Trade', 'Status', 'Time In', 'Time Out', 'Total Hours', 'Regular Hours', 'Overtime', 'Calculated Pay (PHP)'];
      rows = filteredAttendance.map(a => [
        a.date, a.worker_id, `"${a.worker_name || ''}"`, `"${a.worker_trade || ''}"`, a.attendance_status,
        a.time_in || 'N/A', a.time_out || 'N/A', a.total_hours_worked, a.regular_hours, a.overtime_hours, a.calculated_pay
      ]);
    } else if (activeTab === 'payroll') {
      headers = ['Trade', 'Workers Count', 'Total Hours Worked', 'Regular Hours', 'Overtime Hours', 'Total Labor Cost (PHP)'];
      rows = Object.entries(tradePayroll).map(([trade, stat]) => [
        `"${trade}"`, stat.count, stat.totalHours.toFixed(1), stat.regularHours.toFixed(1), stat.otHours.toFixed(1), stat.totalPay.toFixed(2)
      ]);
    } else if (activeTab === 'productivity') {
      headers = ['Date', 'Activity', 'Work Area', 'Planned', 'Actual', 'Unit', 'Labor Hours', 'Actual Rate', 'Target Rate', 'Prod Achieve %', 'Performance Status'];
      rows = filteredAccomplishments.map(a => [
        a.date, `"${a.activity_name || ''}"`, `"${a.area_name || ''}"`, a.planned_quantity, a.actual_quantity,
        a.unit_of_measurement, a.actual_labor_hours, a.actual_productivity_rate, a.target_productivity_rate || 'N/A',
        a.productivity_achievement_percent, a.performance_status
      ]);
    } else {
      headers = ['Worker ID', 'Name', 'Trade', 'Employment Type', 'Wage Rate (PHP)', 'Status', 'Hired Date'];
      rows = workers.map(w => [
        w.id, `"${w.complete_name}"`, `"${w.trade}"`, w.employment_type, w.daily_wage_rate, w.employment_status, w.date_hired
      ]);
    }

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 no-print">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-amber-500" />
            Reports & Labor Performance Analytics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit-ready workforce attendance histories, payroll ledgers, and activity productivity evaluations.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCSV}
            className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Download CSV</span>
          </button>
          <button
            onClick={handlePrint}
            className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Report Type Selector & Date Filter */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 flex flex-wrap items-center justify-between gap-4 no-print">
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg">
          <button
            onClick={() => setActiveTab('attendance')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'attendance' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Attendance & Hours
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'payroll' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Labor Cost & Payroll
          </button>
          <button
            onClick={() => setActiveTab('productivity')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'productivity' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Productivity Analysis
          </button>
          <button
            onClick={() => setActiveTab('manpower')}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
              activeTab === 'manpower' ? 'bg-white text-slate-900 shadow-2xs font-semibold' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Manpower Roster
          </button>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500 font-medium">Evaluation Period:</span>
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 bg-white focus:outline-none"
          >
            {sampleDates.map(d => (
              <option key={d.value} value={d.value}>{d.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Printable Report Header */}
      <div className="print-only mb-6 border-b pb-4">
        <h1 className="text-xl font-bold text-slate-900">BuildPulse Construction LMS - Official Report</h1>
        <p className="text-xs text-slate-600 mt-1">Project: Metro Heights Commercial Complex Phase 2 | Evaluation Period: {selectedPeriod}</p>
        <p className="text-[10px] text-slate-500 mt-0.5">Generated: {new Date().toLocaleString()}</p>
      </div>

      {/* Tab 1: Attendance & Labor Hours Summary */}
      {activeTab === 'attendance' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Worker Attendance & Labor Hours Audit</h3>
              <p className="text-xs text-slate-500">Summary of recorded shifts, lateness, overtime, and calculated compensation</p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-slate-100 rounded text-slate-700">
              {filteredAttendance.length} records in scope
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Worker ID</th>
                  <th className="py-2.5 px-3">Name</th>
                  <th className="py-2.5 px-3">Trade</th>
                  <th className="py-2.5 px-3 text-center">Status</th>
                  <th className="py-2.5 px-3 text-center">Time In</th>
                  <th className="py-2.5 px-3 text-center">Time Out</th>
                  <th className="py-2.5 px-3 text-right">Total Hours</th>
                  <th className="py-2.5 px-3 text-right">Overtime</th>
                  <th className="py-2.5 px-3 text-right">Calculated Pay</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAttendance.map(a => (
                  <tr key={a.id} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono text-slate-600">{a.date}</td>
                    <td className="py-2 px-3 font-mono text-slate-700">{a.worker_id}</td>
                    <td className="py-2 px-3 font-semibold text-slate-900">{a.worker_name}</td>
                    <td className="py-2 px-3 text-slate-600">{a.worker_trade}</td>
                    <td className="py-2 px-3 text-center">
                      <span className="font-semibold text-[11px] text-slate-800">{a.attendance_status}</span>
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-slate-600">{a.time_in || '—'}</td>
                    <td className="py-2 px-3 text-center font-mono text-slate-600">{a.time_out || '—'}</td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {a.total_hours_worked.toFixed(1)}h
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums text-amber-600">
                      {a.overtime_hours > 0 ? `+${a.overtime_hours.toFixed(1)}h` : '—'}
                    </td>
                    <td className="py-2 px-3 text-right font-mono tabular-nums font-bold text-slate-900">
                      ₱{a.calculated_pay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 font-bold border-t border-slate-200">
                <tr>
                  <td colSpan={7} className="py-2.5 px-3 text-right text-slate-800">Totals:</td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                    {filteredAttendance.reduce((s, a) => s + a.total_hours_worked, 0).toFixed(1)}h
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-amber-600">
                    +{filteredAttendance.reduce((s, a) => s + a.overtime_hours, 0).toFixed(1)}h
                  </td>
                  <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-900">
                    ₱{filteredAttendance.reduce((s, a) => s + a.calculated_pay, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Labor Cost & Payroll Breakdown */}
      {activeTab === 'payroll' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Trade Payroll Ledger & Cost Breakdown</h3>
              <p className="text-xs text-slate-500">Regular labor cost and 1.25x overtime distribution grouped by trade</p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-800 rounded">
              Total Payroll: ₱{Object.values(tradePayroll).reduce((s, t) => s + t.totalPay, 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Trade Specialization</th>
                  <th className="py-2.5 px-4 text-center">Headcount</th>
                  <th className="py-2.5 px-4 text-right">Regular Hours</th>
                  <th className="py-2.5 px-4 text-right">Overtime Hours</th>
                  <th className="py-2.5 px-4 text-right">Total Hours</th>
                  <th className="py-2.5 px-4 text-right">Cumulative Labor Cost</th>
                  <th className="py-2.5 px-4 text-right">% of Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {Object.entries(tradePayroll).map(([trade, stat]) => {
                  const totalSum = Object.values(tradePayroll).reduce((s, t) => s + t.totalPay, 0);
                  const percent = totalSum > 0 ? (stat.totalPay / totalSum) * 100 : 0;
                  return (
                    <tr key={trade} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{trade}</td>
                      <td className="py-2.5 px-4 text-center font-mono">{stat.count}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{stat.regularHours.toFixed(1)}h</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-600">{stat.otHours.toFixed(1)}h</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-800">{stat.totalHours.toFixed(1)}h</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">
                        ₱{stat.totalPay.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500">{percent.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Productivity Performance */}
      {activeTab === 'productivity' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Activity Productivity Performance Report</h3>
              <p className="text-xs text-slate-500">Variance between planned vs actual physical output and benchmark labor rates</p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 rounded">
              {filteredAccomplishments.filter(a => a.performance_status === 'Below Target').length} Below Target
            </span>
          </div>

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
                  <th className="py-2.5 px-4 text-right">Productivity Ach %</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredAccomplishments.map(acc => (
                  <tr key={acc.id} className={`hover:bg-slate-50/70 ${acc.performance_status === 'Below Target' ? 'bg-red-50/20' : ''}`}>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{acc.date}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{acc.activity_name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{acc.area_name}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{acc.planned_quantity} {acc.unit_of_measurement}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold text-slate-900">{acc.actual_quantity} {acc.unit_of_measurement}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums">{acc.actual_labor_hours.toFixed(1)}h</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold">{acc.actual_productivity_rate.toFixed(2)}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500">{acc.target_productivity_rate ? acc.target_productivity_rate.toFixed(2) : '—'}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-bold">
                      <span className={
                        acc.productivity_achievement_percent >= 105 ? 'text-emerald-600' :
                        acc.productivity_achievement_percent >= 95 ? 'text-slate-800' : 'text-red-600'
                      }>
                        {acc.productivity_achievement_percent.toFixed(1)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        acc.performance_status === 'Below Target' ? 'bg-red-100 text-red-800' :
                        acc.performance_status === 'Above Target' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {acc.performance_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Manpower Roster */}
      {activeTab === 'manpower' && (
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs space-y-4 p-5">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">Master Workforce Roster</h3>
              <p className="text-xs text-slate-500">Complete listing of 15 certified construction workers and daily wage schedule</p>
            </div>
            <span className="text-xs font-mono font-semibold px-2.5 py-1 bg-slate-100 rounded text-slate-700">
              15 Active Workers
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Worker ID</th>
                  <th className="py-2.5 px-4">Complete Name</th>
                  <th className="py-2.5 px-4">Trade Specialization</th>
                  <th className="py-2.5 px-4">Employment Type</th>
                  <th className="py-2.5 px-4 text-right">Daily Wage Rate</th>
                  <th className="py-2.5 px-4">Date Hired</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {workers.map(w => (
                  <tr key={w.id} className="hover:bg-slate-50/70">
                    <td className="py-2.5 px-4 font-mono font-medium text-slate-700">{w.id}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{w.complete_name}</td>
                    <td className="py-2.5 px-4 text-slate-700 font-medium">{w.trade}</td>
                    <td className="py-2.5 px-4 text-slate-600">{w.employment_type}</td>
                    <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">₱{w.daily_wage_rate.toFixed(2)}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{w.date_hired}</td>
                    <td className="py-2.5 px-4 text-center">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        {w.employment_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
