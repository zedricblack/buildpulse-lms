import React, { useState, useEffect } from 'react';
import {
  Users,
  Clock,
  DollarSign,
  Briefcase,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  BarChart2,
  PieChart as PieIcon,
  Layers,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import { api } from '../services/api';
import { DashboardStats } from '../types';
import { StatCard } from '../components/common/StatCard';
import { PageId } from '../components/layout/Sidebar';

interface DashboardPageProps {
  currentDate: string;
  onNavigate: (page: PageId, filter?: any) => void;
}

const TRADE_COLORS = [
  '#0284c7', '#0d9488', '#f59e0b', '#8b5cf6',
  '#ec4899', '#10b981', '#64748b', '#f97316',
  '#6366f1', '#14b8a6'
];

export const DashboardPage: React.FC<DashboardPageProps> = ({
  currentDate,
  onNavigate
}) => {
  const [data, setData] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [tradeChartType, setTradeChartType] = useState<'bar' | 'pie'>('bar');
  const [costTab, setCostTab] = useState<'trade' | 'worker'>('trade');

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);

    api.getDashboardStats(currentDate)
      .then(stats => {
        if (isMounted) {
          setData(stats);
          setIsLoading(false);
        }
      })
      .catch(err => {
        console.error('Failed to load dashboard:', err);
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentDate]);

  if (isLoading || !data) {
    return (
      <div className="flex items-center justify-center min-h-[500px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-500 font-medium">Computing labor analytics from database...</p>
        </div>
      </div>
    );
  }

  const { workforce, hours, costs, workforceByTrade, manpowerStatus, productivity, currencySymbol } = data;

  return (
    <div className="space-y-8 pb-12">
      {/* Page Title & Context Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">
            Labor Performance & Operations Dashboard
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time workforce deployment, attendance verification, payroll computations, and productivity monitoring.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-slate-500">Evaluating Date:</span>
          <span className="font-mono font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-md">
            {currentDate}
          </span>
        </div>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* SECTION A: TODAY'S WORKFORCE */}
      {/* --------------------------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-900" />
              Section A: Today's Workforce
            </h3>
            <p className="text-xs text-slate-500">Scheduled labor assignments versus recorded daily attendance</p>
          </div>
          <button
            onClick={() => onNavigate('attendance', { date: currentDate })}
            className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
          >
            <span>View Attendance Sheet</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3.5">
          <StatCard
            title="Scheduled Workforce"
            value={workforce.scheduled}
            subtitle="Assigned via Daily Assignments"
            icon={<Briefcase className="w-4 h-4" />}
            onClick={() => onNavigate('assignments', { date: currentDate })}
          />
          <StatCard
            title="Workers Present"
            value={workforce.present}
            subtitle="Full 8-hour shift logged"
            icon={<CheckCircle className="w-4 h-4" />}
            highlight
            onClick={() => onNavigate('attendance', { date: currentDate, status: 'Present' })}
          />
          <StatCard
            title="Workers Late"
            value={workforce.late}
            subtitle="Logged after 08:00 start"
            icon={<Clock className="w-4 h-4" />}
            alert={workforce.late > 0}
            onClick={() => onNavigate('attendance', { date: currentDate, status: 'Late' })}
          />
          <StatCard
            title="Half-Day Shifts"
            value={workforce.halfDay}
            subtitle="4.0 hours worked threshold"
            icon={<Clock className="w-4 h-4" />}
            onClick={() => onNavigate('attendance', { date: currentDate, status: 'Half-Day' })}
          />
          <StatCard
            title="Workers Absent"
            value={workforce.absent}
            subtitle="0 shift hours attributable"
            icon={<AlertTriangle className="w-4 h-4" />}
            alert={workforce.absent > 0}
            onClick={() => onNavigate('attendance', { date: currentDate, status: 'Absent' })}
          />
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* SECTION B: LABOR HOURS */}
      {/* --------------------------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-900" />
              Section B: Labor Hours
            </h3>
            <p className="text-xs text-slate-500">Elapsed shift hours less 1-hour unpaid lunch break</p>
          </div>
          <span className="text-xs font-mono text-slate-500">
            5-Day Period: {data.samplePeriod.start} to {data.samplePeriod.end}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          <StatCard
            title="Today's Total Labor-Hours"
            value={`${hours.todayTotal.toFixed(1)} hrs`}
            subtitle={`Regular: ${hours.todayRegular.toFixed(1)}h | OT: ${hours.todayOvertime.toFixed(1)}h`}
            icon={<Clock className="w-4 h-4" />}
          />
          <StatCard
            title="Today's Overtime Hours"
            value={`${hours.todayOvertime.toFixed(1)} hrs`}
            subtitle="Hours exceeding 8.0h threshold"
            icon={<TrendingUp className="w-4 h-4" />}
            highlight={hours.todayOvertime > 0}
          />
          <StatCard
            title="5-Day Cumulative Hours"
            value={`${hours.periodTotal.toFixed(1)} hrs`}
            subtitle={`Total OT across cycle: ${hours.periodOvertime.toFixed(1)} hrs`}
            icon={<BarChart2 className="w-4 h-4" />}
          />
        </div>

        {/* 5-Day Trend Chart */}
        <div className="bg-white p-5 rounded-lg border border-slate-200">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
                5-Day Labor Hours Deployment Trend
              </h4>
              <p className="text-[11px] text-slate-500">Daily total labor-hours and overtime distribution</p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-slate-800" /> Total Hours
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-sm bg-amber-500" /> Overtime Hours
              </span>
            </div>
          </div>
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hours.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} />
                <Tooltip
                  formatter={(val: any, name?: any) => [
                    `${val} hrs`,
                    name === 'total_hours' ? 'Total Hours' : 'Overtime'
                  ]}
                  labelStyle={{ fontWeight: 'bold', color: '#0f172a' }}
                />
                <Bar dataKey="total_hours" name="Total Hours" fill="#1e293b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="ot_hours" name="Overtime" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* SECTION C: LABOR COST */}
      {/* --------------------------------------------------------------------- */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-900" />
              Section C: Labor Cost
            </h3>
            <p className="text-xs text-slate-500">Automated payroll calculation: Regular Pay + Overtime Pay (1.25x)</p>
          </div>
          <button
            onClick={() => onNavigate('reports')}
            className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
          >
            <span>Full Payroll Report</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
          <StatCard
            title="Total Daily Labor Cost"
            value={`${currencySymbol}${costs.dailyCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle={`Calculated for active shift on ${currentDate}`}
            icon={<DollarSign className="w-4 h-4" />}
            highlight
          />
          <StatCard
            title="Month-to-Date (MTD) Labor Cost"
            value={`${currencySymbol}${costs.mtdCost.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            subtitle="Cumulative payroll cost across 5-day cycle"
            icon={<DollarSign className="w-4 h-4" />}
          />
        </div>

        {/* Cost Breakdown Table / Tabs */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-slate-200 bg-slate-50/50">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCostTab('trade')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  costTab === 'trade'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cost by Trade
              </button>
              <button
                onClick={() => setCostTab('worker')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  costTab === 'worker'
                    ? 'bg-slate-900 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Cost by Individual Worker
              </button>
            </div>
            <span className="text-xs text-slate-500 font-mono">Date: {currentDate}</span>
          </div>

          <div className="overflow-x-auto">
            {costTab === 'trade' ? (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Trade / Specialization</th>
                    <th className="py-2.5 px-4 text-center">Workers</th>
                    <th className="py-2.5 px-4 text-right">Total Hours</th>
                    <th className="py-2.5 px-4 text-right">Total Daily Cost</th>
                    <th className="py-2.5 px-4 text-right">% of Daily Cost</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {costs.perTrade.map((t) => {
                    const percent = costs.dailyCost > 0 ? (t.total_cost / costs.dailyCost) * 100 : 0;
                    return (
                      <tr key={t.trade} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-4 font-semibold text-slate-800">{t.trade}</td>
                        <td className="py-2.5 px-4 text-center font-mono">{t.worker_count}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums">{t.total_hours.toFixed(1)} hrs</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {currencySymbol}{t.total_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-500">
                          {percent.toFixed(1)}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-4">Worker ID</th>
                    <th className="py-2.5 px-4">Name</th>
                    <th className="py-2.5 px-4">Trade</th>
                    <th className="py-2.5 px-4 text-right">Daily Wage</th>
                    <th className="py-2.5 px-4 text-right">Hours</th>
                    <th className="py-2.5 px-4 text-right">OT</th>
                    <th className="py-2.5 px-4 text-right">Calculated Pay</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {costs.perWorker.map((w) => (
                    <tr key={w.worker_id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-mono text-slate-600">{w.worker_id}</td>
                      <td className="py-2.5 px-4 font-medium text-slate-900">{w.complete_name}</td>
                      <td className="py-2.5 px-4 text-slate-600">{w.trade}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{currencySymbol}{w.daily_wage_rate.toFixed(2)}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">{w.total_hours.toFixed(1)}h</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-amber-600">{w.ot_hours.toFixed(1)}h</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {currencySymbol}{w.labor_cost.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------------- */}
      {/* SECTION D: WORKFORCE BY TRADE & SECTION E: MANPOWER STATUS */}
      {/* --------------------------------------------------------------------- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SECTION D */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-900" />
                Section D: Workforce by Trade
              </h3>
              <p className="text-xs text-slate-500">Distribution of certified trades across workforce</p>
            </div>
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-md border border-slate-200">
              <button
                onClick={() => setTradeChartType('bar')}
                className={`p-1.5 rounded transition-colors cursor-pointer ${tradeChartType === 'bar' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                title="Bar Chart"
              >
                <BarChart2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setTradeChartType('pie')}
                className={`p-1.5 rounded transition-colors cursor-pointer ${tradeChartType === 'pie' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'}`}
                title="Pie Chart"
              >
                <PieIcon className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 h-80 flex flex-col justify-between">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                {tradeChartType === 'bar' ? (
                  <BarChart data={workforceByTrade} layout="vertical" margin={{ top: 5, right: 20, left: 40, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" />
                    <XAxis type="number" tick={{ fontSize: 10, fill: '#64748b' }} allowDecimals={false} />
                    <YAxis dataKey="trade" type="category" tick={{ fontSize: 10, fill: '#64748b' }} width={90} />
                    <Tooltip formatter={(val: any) => [`${val} workers`, 'Headcount']} />
                    <Bar dataKey="count" fill="#1e293b" radius={[0, 4, 4, 0]}>
                      {workforceByTrade.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={TRADE_COLORS[index % TRADE_COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                ) : (
                  <PieChart>
                    <Pie
                      data={workforceByTrade}
                      dataKey="count"
                      nameKey="trade"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }: any) => `${name} (${(percent * 100).toFixed(0)}%)`}
                      labelLine={false}
                    >
                      {workforceByTrade.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={TRADE_COLORS[index % TRADE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(val: any) => [`${val} workers`, 'Headcount']} />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>Total Active Trades: <strong>{workforceByTrade.length}</strong></span>
              <button
                onClick={() => onNavigate('workers')}
                className="text-amber-600 hover:text-amber-700 font-medium cursor-pointer"
              >
                Inspect All Workers →
              </button>
            </div>
          </div>
        </section>

        {/* SECTION E */}
        <section className="space-y-3">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-900" />
              Section E: Manpower Status
            </h3>
            <p className="text-xs text-slate-500">Employment status and daily assignment allocation</p>
          </div>

          <div className="bg-white p-5 rounded-lg border border-slate-200 h-80 flex flex-col justify-between">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] text-slate-500 font-medium">Active Roster</span>
                <p className="text-xl font-bold font-mono text-slate-900">{manpowerStatus.active}</p>
                <span className="text-[10px] text-emerald-600">Eligible for shifts</span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200/80">
                <span className="text-[11px] text-slate-500 font-medium">Inactive Roster</span>
                <p className="text-xl font-bold font-mono text-slate-900">{manpowerStatus.inactive}</p>
                <span className="text-[10px] text-slate-400">On leave / archived</span>
              </div>
              <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-200">
                <span className="text-[11px] text-blue-700 font-medium">Assigned Today</span>
                <p className="text-xl font-bold font-mono text-blue-900">{manpowerStatus.assigned}</p>
                <span className="text-[10px] text-blue-600">Active tasks allocated</span>
              </div>
              <div className="p-3 rounded-lg bg-amber-50/50 border border-amber-200">
                <span className="text-[11px] text-amber-700 font-medium">Unassigned Today</span>
                <p className="text-xl font-bold font-mono text-amber-900">{manpowerStatus.unassigned}</p>
                <span className="text-[10px] text-amber-600">Available reserve</span>
              </div>
            </div>

            {/* Attendance breakdown strip */}
            <div className="pt-3 border-t border-slate-100">
              <span className="text-xs font-semibold text-slate-700 block mb-2">
                Today's Attendance Allocation Rate:
              </span>
              <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  style={{ width: `${(manpowerStatus.present / (manpowerStatus.active || 1)) * 100}%` }}
                  className="bg-emerald-500 h-full"
                  title={`Present: ${manpowerStatus.present}`}
                />
                <div
                  style={{ width: `${(manpowerStatus.late / (manpowerStatus.active || 1)) * 100}%` }}
                  className="bg-amber-500 h-full"
                  title={`Late: ${manpowerStatus.late}`}
                />
                <div
                  style={{ width: `${(manpowerStatus.halfDay / (manpowerStatus.active || 1)) * 100}%` }}
                  className="bg-blue-400 h-full"
                  title={`Half-Day: ${manpowerStatus.halfDay}`}
                />
                <div
                  style={{ width: `${(manpowerStatus.absent / (manpowerStatus.active || 1)) * 100}%` }}
                  className="bg-red-400 h-full"
                  title={`Absent: ${manpowerStatus.absent}`}
                />
              </div>
              <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Present ({manpowerStatus.present})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> Late ({manpowerStatus.late})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400" /> Half-Day ({manpowerStatus.halfDay})</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-400" /> Absent ({manpowerStatus.absent})</span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* --------------------------------------------------------------------- */}
      {/* SECTION F: PRODUCTIVITY PER ACTIVITY */}
      {/* --------------------------------------------------------------------- */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-900" />
              Section F: Productivity per Activity
            </h3>
            <p className="text-xs text-slate-500">
              Actual Output ÷ Actual Labor Hours compared against Target Productivity Benchmarks
            </p>
          </div>
          <div className="flex items-center gap-2">
            {productivity.belowTargetCount > 0 && (
              <span className="px-2.5 py-1 rounded-md text-xs font-semibold bg-red-50 text-red-700 border border-red-200 flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
                {productivity.belowTargetCount} Activities Below Target
              </span>
            )}
            <button
              onClick={() => onNavigate('accomplishments')}
              className="text-xs font-medium text-amber-600 hover:text-amber-700 flex items-center gap-1 cursor-pointer"
            >
              <span>Manage Accomplishments</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Productivity Comparison Table */}
        <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">Activity Name</th>
                  <th className="py-2.5 px-4">Unit</th>
                  <th className="py-2.5 px-4 text-right">Planned Qty</th>
                  <th className="py-2.5 px-4 text-right">Actual Qty</th>
                  <th className="py-2.5 px-4 text-right">Labor Hours</th>
                  <th className="py-2.5 px-4 text-right">Target Rate</th>
                  <th className="py-2.5 px-4 text-right">Actual Rate</th>
                  <th className="py-2.5 px-4 text-right">Productivity %</th>
                  <th className="py-2.5 px-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {productivity.activities.map((act) => {
                  return (
                    <tr
                      key={act.activityId}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        act.isBelowTarget ? 'bg-amber-50/20' : ''
                      }`}
                    >
                      <td className="py-2.5 px-4 font-semibold text-slate-800">
                        {act.activityName}
                      </td>
                      <td className="py-2.5 px-4 text-slate-500 font-mono">{act.unit}</td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {act.totalPlanned > 0 ? act.totalPlanned.toLocaleString() : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-medium text-slate-900">
                        {act.totalActual > 0 ? act.totalActual.toLocaleString() : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {act.totalLaborHours > 0 ? `${act.totalLaborHours.toFixed(1)}h` : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums text-slate-600">
                        {act.targetRate.toFixed(2)} {act.unit}/h
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-slate-900">
                        {act.totalLaborHours > 0 ? `${act.actualRate.toFixed(2)} ${act.unit}/h` : '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono tabular-nums">
                        {act.totalLaborHours > 0 ? (
                          <span className={`font-semibold ${
                            act.prodAchievementPercent >= 105
                              ? 'text-emerald-600'
                              : act.prodAchievementPercent >= 95
                              ? 'text-slate-700'
                              : 'text-red-600'
                          }`}>
                            {act.prodAchievementPercent.toFixed(1)}%
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        {act.totalLaborHours === 0 ? (
                          <span className="text-[11px] text-slate-400">No Data</span>
                        ) : act.isBelowTarget ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-red-100 text-red-800 border border-red-200">
                            <AlertTriangle className="w-3 h-3 text-red-600 shrink-0" />
                            Below Target
                          </span>
                        ) : act.prodAchievementPercent >= 105 ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            <CheckCircle className="w-3 h-3 text-emerald-600 shrink-0" />
                            Above Target
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                            Met Target
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Selected Day Accomplishments Spotlight */}
        {productivity.dayAccomplishments.length > 0 && (
          <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
              Specific Activity Accomplishments for {currentDate}
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {productivity.dayAccomplishments.map(acc => (
                <div key={acc.id} className="bg-white p-3.5 rounded-lg border border-slate-200 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-900">{acc.activity_name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      acc.performance_status === 'Below Target'
                        ? 'bg-red-100 text-red-800'
                        : acc.performance_status === 'Above Target'
                        ? 'bg-emerald-100 text-emerald-800'
                        : 'bg-slate-100 text-slate-800'
                    }`}>
                      {acc.performance_status} ({acc.productivity_achievement_percent}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-slate-600 text-[11px] font-mono">
                    <span>Accomplished: {acc.actual_quantity} / {acc.planned_quantity} {acc.unit_of_measurement}</span>
                    <span>Rate: {acc.actual_productivity_rate} {acc.unit_of_measurement}/h</span>
                  </div>
                  {acc.remarks && (
                    <p className="text-slate-500 text-[11px] italic pt-1 border-t border-slate-100">
                      "{acc.remarks}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
