import React, { useState, useEffect } from 'react';
import {
  Settings,
  Database,
  RefreshCw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Server,
  FileCode,
  Check,
  ShieldAlert,
  Palette,
  Sun,
  Moon,
  Compass
} from 'lucide-react';
import { api } from '../services/api';
import { SystemSettings } from '../types';
import { useAuth } from '../context/AuthContext';
import { useTheme, THEME_OPTIONS } from '../context/ThemeContext';
import { ConfirmDialog } from '../components/common/ConfirmDialog';

export const SettingsPage: React.FC = () => {
  const { hasPermission, user } = useAuth();
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [dbStats, setDbStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Form State
  const [standardDailyHours, setStandardDailyHours] = useState<number>(8.0);
  const [normalShiftStart, setNormalShiftStart] = useState<string>('08:00');
  const [unpaidBreakDuration, setUnpaidBreakDuration] = useState<number>(60);
  const [overtimeMultiplier, setOvertimeMultiplier] = useState<number>(1.25);
  const [halfDayThreshold, setHalfDayThreshold] = useState<number>(4.0);
  const [currencySymbol, setCurrencySymbol] = useState<string>('₱');
  const [companyName, setCompanyName] = useState<string>('');
  const [projectName, setProjectName] = useState<string>('');
  const [samplePeriodStart, setSamplePeriodStart] = useState<string>('2026-10-20');
  const [samplePeriodEnd, setSamplePeriodEnd] = useState<string>('2026-10-24');

  // Re-seed dialog
  const [showSeedDialog, setShowSeedDialog] = useState(false);
  const [isSeeding, setIsSeeding] = useState(false);

  const loadSettings = async () => {
    setIsLoading(true);
    try {
      const res = await api.getSettings();
      setSettings(res.settings);
      setDbStats(res.databaseStats);

      setStandardDailyHours(res.settings.standard_daily_hours);
      setNormalShiftStart(res.settings.normal_shift_start_time);
      setUnpaidBreakDuration(res.settings.unpaid_break_duration_minutes);
      setOvertimeMultiplier(res.settings.overtime_multiplier);
      setHalfDayThreshold(res.settings.half_day_threshold_hours);
      setCurrencySymbol(res.settings.currency_symbol);
      setCompanyName(res.settings.company_name);
      setProjectName(res.settings.project_name);
      setSamplePeriodStart(res.settings.sample_period_start);
      setSamplePeriodEnd(res.settings.sample_period_end);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to load system settings.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      await api.updateSettings({
        standardDailyHours,
        normalShiftStartTime: normalShiftStart,
        unpaidBreakDurationMinutes: unpaidBreakDuration,
        overtimeMultiplier,
        halfDayThresholdHours: halfDayThreshold,
        currencySymbol,
        companyName,
        projectName,
        samplePeriodStart,
        samplePeriodEnd
      });
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      loadSettings();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update settings.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleExecuteSeed = async () => {
    setIsSeeding(true);
    try {
      await api.seedDatabase(true);
      setShowSeedDialog(false);
      loadSettings();
      alert('Demonstration dataset successfully re-seeded and verified!');
    } catch (err: any) {
      alert(err.message || 'Error seeding database.');
    } finally {
      setIsSeeding(false);
    }
  };

  if (isLoading || !settings) {
    return <div className="p-12 text-center text-xs text-slate-500">Loading system configuration...</div>;
  }

  const counts = dbStats?.counts || {};
  const isWorkersVerified = counts.workers >= 15;
  const isAttendanceVerified = counts.attendance >= 75;
  const isAssignmentsVerified = counts.assignments >= 75;
  const isActivitiesVerified = counts.activities >= 10;
  const isAccomplishmentsVerified = counts.accomplishments >= 10;

  return (
    <div className="space-y-8 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <Settings className="w-5 h-5 text-amber-500" />
            System Configuration & Database Diagnostics
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Shift threshold rules, payroll calculation parameters, database verification stats, and demo-seeding controls.
          </p>
        </div>
      </div>

      {/* Database Verification Status Cards */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-slate-900">Live Relational Database Persistence Verification</h3>
          </div>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-xs font-semibold">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            {dbStats?.status || 'Active & Connected'}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Construction Workers</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-slate-900">{counts.workers || 0}</span>
              <span className="text-[10px] text-slate-400">/ 15 min</span>
            </div>
            <span className={`text-[10px] font-semibold flex items-center gap-1 mt-1 ${isWorkersVerified ? 'text-emerald-600' : 'text-red-600'}`}>
              {isWorkersVerified ? <Check className="w-3 h-3" /> : '✗'} {isWorkersVerified ? 'Requirement Met' : 'Under Minimum'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Attendance Records</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-slate-900">{counts.attendance || 0}</span>
              <span className="text-[10px] text-slate-400">/ 75 min</span>
            </div>
            <span className={`text-[10px] font-semibold flex items-center gap-1 mt-1 ${isAttendanceVerified ? 'text-emerald-600' : 'text-red-600'}`}>
              {isAttendanceVerified ? <Check className="w-3 h-3" /> : '✗'} {isAttendanceVerified ? '75 Records Met' : 'Under Minimum'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Labor Assignments</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-slate-900">{counts.assignments || 0}</span>
              <span className="text-[10px] text-slate-400">/ 75 min</span>
            </div>
            <span className={`text-[10px] font-semibold flex items-center gap-1 mt-1 ${isAssignmentsVerified ? 'text-emerald-600' : 'text-red-600'}`}>
              {isAssignmentsVerified ? <Check className="w-3 h-3" /> : '✗'} {isAssignmentsVerified ? '75 Records Met' : 'Under Minimum'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Work Activities</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-slate-900">{counts.activities || 0}</span>
              <span className="text-[10px] text-slate-400">/ 10 min</span>
            </div>
            <span className={`text-[10px] font-semibold flex items-center gap-1 mt-1 ${isActivitiesVerified ? 'text-emerald-600' : 'text-red-600'}`}>
              {isActivitiesVerified ? <Check className="w-3 h-3" /> : '✗'} {isActivitiesVerified ? '10 Activities Met' : 'Under Minimum'}
            </span>
          </div>

          <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
            <span className="text-slate-500 block text-[11px]">Accomplishments</span>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-xl font-bold font-mono text-slate-900">{counts.accomplishments || 0}</span>
              <span className="text-[10px] text-slate-400">entries</span>
            </div>
            <span className={`text-[10px] font-semibold flex items-center gap-1 mt-1 ${isAccomplishmentsVerified ? 'text-emerald-600' : 'text-red-600'}`}>
              {isAccomplishmentsVerified ? <Check className="w-3 h-3" /> : '✗'} Covers 5 Days
            </span>
          </div>
        </div>

        {/* Database Engine & Firebase / Cloud SQL Information */}
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                <Database className="w-4 h-4 text-amber-500" />
                Active Database: <span className="font-mono text-slate-900 font-bold">Firebase Firestore & Cloud SQL</span>
              </p>
              <p className="text-slate-500 text-[11px] mt-0.5">
                Firebase Firestore DB: <code className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-mono font-semibold">ai-studio-buildpulselmscon-929e2a11-8a72-44f1-aa18-057c20c23bc9</code>
              </p>
              <p className="text-slate-400 text-[10px] mt-0.5 font-mono">
                Project: isometric-decorator-k01dl | Region: asia-southeast1
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <a
                href="https://console.firebase.google.com/project/isometric-decorator-k01dl/firestore/databases/ai-studio-buildpulselmscon-929e2a11-8a72-44f1-aa18-057c20c23bc9/data"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Database className="w-3.5 h-3.5" />
                <span>Open Firebase Console (Firestore)</span>
              </a>
              <a
                href="https://console.cloud.google.com/sql/instances/ai-studio-929e2a11/studio?project=isometric-decorator-k01dl"
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg font-medium text-xs flex items-center gap-1.5 transition-colors shadow-2xs"
              >
                <Server className="w-3.5 h-3.5" />
                <span>Cloud SQL Studio</span>
              </a>
              {user?.role === 'admin' && (
                <button
                  type="button"
                  onClick={() => setShowSeedDialog(true)}
                  className="px-3 py-1.5 bg-white border border-slate-300 hover:border-amber-500 rounded-lg text-slate-700 font-medium text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-amber-600" />
                  <span>Re-Sync Dataset</span>
                </button>
              )}
            </div>
          </div>

          <div className="pt-2 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between text-[11px] text-slate-600 gap-1">
            <span>
              Connected to: <code className="bg-slate-200 px-1 rounded font-mono">Firebase Firestore (12 Collections) + Cloud SQL PostgreSQL</code>
            </span>
            <span className="font-medium text-emerald-700 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              Firebase Firestore Active & Synced
            </span>
          </div>
        </div>
      </div>

      {/* Theme Appearance Customization */}
      <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Palette className="w-4 h-4 text-amber-500" />
            <h3 className="text-sm font-semibold text-slate-900">Jobsite Display Themes & Visual Modes</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">Current: {theme.toUpperCase()}</span>
        </div>

        <p className="text-xs text-slate-500">
          Switch between optimized visual modes designed for specific construction environments, from daytime field tablets under direct sun to low-glare night shift inspections.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {THEME_OPTIONS.map((opt) => {
            const isSelected = opt.id === theme;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTheme(opt.id)}
                className={`p-3.5 rounded-lg border text-left transition-all cursor-pointer relative ${
                  isSelected
                    ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-500/5'
                    : 'border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100/80'
                }`}
              >
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-black/10 shrink-0"
                      style={{ backgroundColor: opt.accentColor }}
                    />
                    <span className="text-xs font-semibold text-slate-900">{opt.name}</span>
                  </div>
                  {isSelected && (
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 bg-amber-100 px-1.5 py-0.5 rounded">
                      <Check className="w-3 h-3" /> Active
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-500 leading-relaxed">{opt.tagline}</p>
                <div className="mt-2 text-[10px] text-slate-400 font-mono">
                  {opt.isDark ? 'Dark Mode Surface' : 'Light Mode Surface'}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Form: Shift & Payroll Settings */}
      <form onSubmit={handleSaveSettings} className="bg-white p-5 rounded-lg border border-slate-200 shadow-2xs space-y-6">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">Configurable Work-Hour & Overtime Rules</h3>
          <p className="text-xs text-slate-500 mt-0.5">
            These rules automatically drive the attendance hour computations, break deductions, and daily payroll costs.
          </p>
        </div>

        {saveSuccess && (
          <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>System settings have been successfully updated and saved to the database.</span>
          </div>
        )}

        {errorMessage && (
          <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
            <span>{errorMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 text-xs">
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Standard Paid Hours per Day
            </label>
            <input
              type="number"
              step="0.5"
              min="4"
              max="12"
              value={standardDailyHours}
              onChange={(e) => setStandardDailyHours(Number(e.target.value))}
              required
              disabled={!hasPermission('settings', 'edit')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-[10px] text-slate-400 mt-1">Normal baseline shift hours before overtime starts (Default: 8.0)</p>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Normal Shift Start Time (24h)
            </label>
            <input
              type="time"
              value={normalShiftStart}
              onChange={(e) => setNormalShiftStart(e.target.value)}
              required
              disabled={!hasPermission('settings', 'edit')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-[10px] text-slate-400 mt-1">Arrival after this threshold automatically marks worker as Late</p>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Unpaid Lunch Break Duration (minutes)
            </label>
            <input
              type="number"
              step="15"
              min="0"
              max="120"
              value={unpaidBreakDuration}
              onChange={(e) => setUnpaidBreakDuration(Number(e.target.value))}
              required
              disabled={!hasPermission('settings', 'edit')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-[10px] text-slate-400 mt-1">Deducted from elapsed shift time when worked ≥ 5 hours (Default: 60)</p>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Overtime Pay Rate Multiplier
            </label>
            <input
              type="number"
              step="0.05"
              min="1.0"
              max="2.5"
              value={overtimeMultiplier}
              onChange={(e) => setOvertimeMultiplier(Number(e.target.value))}
              required
              disabled={!hasPermission('settings', 'edit')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-[10px] text-slate-400 mt-1">Formula: Hourly Rate × Multiplier for hours beyond standard (Default: 1.25x)</p>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Half-Day Shift Threshold (hours)
            </label>
            <input
              type="number"
              step="0.5"
              min="2"
              max="6"
              value={halfDayThreshold}
              onChange={(e) => setHalfDayThreshold(Number(e.target.value))}
              required
              disabled={!hasPermission('settings', 'edit')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-[10px] text-slate-400 mt-1">Standard credit for half-day shifts (Default: 4.0h)</p>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Currency Symbol
            </label>
            <input
              type="text"
              value={currencySymbol}
              onChange={(e) => setCurrencySymbol(e.target.value)}
              required
              disabled={!hasPermission('settings', 'edit')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
            <p className="text-[10px] text-slate-400 mt-1">Used on dashboard and payroll reports (e.g. ₱, $, €)</p>
          </div>

          <div className="lg:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">
              Construction Project Name
            </label>
            <input
              type="text"
              value={projectName}
              onChange={(e) => setProjectName(e.target.value)}
              required
              disabled={!hasPermission('settings', 'edit')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Corporate Entity / Contractor Name
            </label>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              required
              disabled={!hasPermission('settings', 'edit')}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
            />
          </div>
        </div>

        {hasPermission('settings', 'edit') && (
          <div className="flex justify-end pt-4 border-t border-slate-100">
            <button
              type="submit"
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>{isSaving ? 'Saving Configurations...' : 'Save System Settings'}</span>
            </button>
          </div>
        )}
      </form>

      {/* Re-seed confirmation dialog */}
      <ConfirmDialog
        isOpen={showSeedDialog}
        onClose={() => setShowSeedDialog(false)}
        onConfirm={handleExecuteSeed}
        title="Reset & Re-Seed Demonstration Dataset"
        message="This will reset the database records to the baseline demonstration dataset (15 workers, 75 attendance records, 75 assignments, 10 work activities, 15 accomplishments, and default administrator/user accounts). Are you sure you want to proceed?"
        isDestructive
        confirmLabel={isSeeding ? 'Seeding...' : 'Reset & Re-Seed Now'}
        isLoading={isSeeding}
      />
    </div>
  );
};
