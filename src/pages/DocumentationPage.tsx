import React, { useState } from 'react';
import {
  BookOpen,
  Printer,
  Database,
  Layers,
  CheckCircle,
  ExternalLink,
  Shield,
  FileText,
  Workflow,
  Sparkles,
  Camera
} from 'lucide-react';

export const DocumentationPage: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('all');

  const handlePrint = () => {
    window.print();
  };

  // The actual deployed URLs provided in system context
  const devUrl = 'https://ais-dev-y4solt7wmu2cswqt7pjb5r-865516357214.asia-southeast1.run.app';
  const sharedUrl = 'https://ais-pre-y4solt7wmu2cswqt7pjb5r-865516357214.asia-southeast1.run.app';

  return (
    <div className="space-y-8 pb-16 max-w-5xl mx-auto">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-slate-200 no-print">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-amber-500" />
            Project Documentation & Academic Submission Report
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Complete technical specification, normalized relational schema ERD, mathematical formulas, and verified deployment guide.
          </p>
        </div>
        <button
          onClick={handlePrint}
          className="px-4 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg flex items-center gap-2 shadow-sm cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Export / Print as PDF</span>
        </button>
      </div>

      {/* Cover / Title Block for Print and Screen */}
      <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b pb-4">
          <div>
            <span className="text-[11px] font-bold tracking-wider text-amber-600 uppercase font-mono">Academic Submission Deliverable</span>
            <h1 className="text-2xl font-black text-slate-900 mt-1">
              Construction Labor Management System (LMS)
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Production System Architecture, Normalized Relational Database, and Workforce Productivity Analytics
            </p>
          </div>
          <div className="text-right hidden sm:block">
            <span className="text-xs font-mono text-slate-500 block">Version 1.0 (Production)</span>
            <span className="text-[11px] text-slate-400 font-mono">Academic Year 2026</span>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs pt-2">
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Author / Submitter</span>
            <span className="font-semibold text-slate-800">Site Management Team</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Evaluation Project</span>
            <span className="font-semibold text-slate-800">Metro Heights Commercial Complex Phase 2</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Database Engine</span>
            <span className="font-semibold text-slate-800 font-mono">Google Cloud SQL (PostgreSQL 18)</span>
          </div>
          <div>
            <span className="text-slate-400 block text-[10px] uppercase font-semibold">Backend Runtime</span>
            <span className="font-semibold text-slate-800 font-mono">Node.js Express + TSX</span>
          </div>
        </div>
      </div>

      {/* SECTION A: PROJECT OVERVIEW */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" />
          Section A: Project Overview & Objectives
        </h3>
        <p className="text-xs text-slate-700 leading-relaxed">
          The <strong>BuildPulse Construction Labor Management System (LMS)</strong> is a database-driven enterprise application designed to resolve traditional labor tracking inefficiencies, unrecorded overtime discrepancies, and undocumented productivity deficits on large-scale construction jobsites.
        </p>
        <p className="text-xs text-slate-700 leading-relaxed">
          In construction operations, labor constitutes between 35% and 50% of direct project expenses. Without centralized verification, companies suffer from ghost personnel, undocumented absences, and inaccurate productivity rates. This system demonstrates end-to-end workforce control: recording certified worker master records, capturing daily clock-in/out timestamps, assigning laborers to specific project zones, tracking physical accomplishments against established engineering targets, and calculating daily and month-to-date payroll costs.
        </p>
      </section>

      {/* SECTION B: DATABASE FEATURES */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" />
          Section B: Core Database Features & Capabilities
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1.5">
            <h4 className="font-bold text-slate-900">1. Worker Master Directory</h4>
            <p className="text-slate-600 leading-relaxed">
              Maintains complete worker identities, verified contact details, certified trade specializations, employment categories (Regular, Contractual, Daily Wage), and baseline daily wage rates. Deactivation protects historical shifts while preventing new labor assignments.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1.5">
            <h4 className="font-bold text-slate-900">2. Attendance & Overtime Engine</h4>
            <p className="text-slate-600 leading-relaxed">
              Enforces a strict unique composite constraint <code className="font-mono bg-slate-200 px-1 rounded">(worker_id, date)</code> to prevent duplicate entries. Automatically deducts unpaid meal breaks and calculates overtime exceeding the 8.0-hour threshold.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1.5">
            <h4 className="font-bold text-slate-900">3. Daily Labor Assignment</h4>
            <p className="text-slate-600 leading-relaxed">
              Directly links active workers to Work Activity Master records, physical Work Areas (e.g. Foundation Zone A, Tower 1), and assigned Site Supervisors, preventing unassigned floating personnel.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 rounded-lg border border-slate-200/80 space-y-1.5">
            <h4 className="font-bold text-slate-900">4. Daily Accomplishments & Productivity</h4>
            <p className="text-slate-600 leading-relaxed">
              Monitors actual physical progress against planned engineering quotas. Calculates output per labor-hour and flags activities performing below benchmark rates (&lt;95% of target).
            </p>
          </div>
        </div>
      </section>

      {/* SECTION C: DATABASE STRUCTURE & INTERACTIVE ERD */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" />
          Section C: Database Structure & Entity Relationship Diagram (ERD)
        </h3>
        <p className="text-xs text-slate-600">
          The normalized relational database consists of 12 tables enforcing referential integrity with cascading updates, foreign keys, uniqueness constraints, and index optimizations.
        </p>

        {/* Interactive ERD Diagram Container */}
        <div className="bg-slate-950 text-slate-100 p-6 rounded-xl border border-slate-800 overflow-x-auto">
          <div className="text-center pb-4 border-b border-slate-800">
            <span className="text-[10px] font-mono tracking-widest text-amber-400 uppercase">Interactive Architectural Schema</span>
            <h4 className="text-sm font-bold text-white mt-0.5">Relational Entity-Relationship Diagram</h4>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 text-[11px] font-mono">
            {/* Table 1: workers */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-1.5 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-amber-400 font-bold">
                <span>workers</span>
                <span className="text-[9px] text-slate-500">[Master Data]</span>
              </div>
              <div className="text-slate-300 space-y-1">
                <div className="text-amber-300 font-semibold">PK: id (TEXT)</div>
                <div>complete_name (TEXT)</div>
                <div>trade (TEXT)</div>
                <div>employment_type (TEXT)</div>
                <div>daily_wage_rate (REAL)</div>
                <div>employment_status (TEXT)</div>
                <div>date_hired (TEXT)</div>
              </div>
            </div>

            {/* Table 2: attendance */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-1.5 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-emerald-400 font-bold">
                <span>attendance</span>
                <span className="text-[9px] text-slate-500">[Transactions]</span>
              </div>
              <div className="text-slate-300 space-y-1">
                <div className="text-amber-300 font-semibold">PK: id (TEXT)</div>
                <div className="text-blue-300">FK: worker_id → workers.id</div>
                <div>date (TEXT)</div>
                <div>time_in (TEXT) / time_out (TEXT)</div>
                <div>attendance_status (TEXT)</div>
                <div>total_hours_worked (REAL)</div>
                <div>overtime_hours (REAL)</div>
                <div>calculated_pay (REAL)</div>
                <div className="text-[10px] text-slate-500">UNIQUE(worker_id, date)</div>
              </div>
            </div>

            {/* Table 3: daily_labor_assignments */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-1.5 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-blue-400 font-bold">
                <span>daily_labor_assignments</span>
                <span className="text-[9px] text-slate-500">[Assignments]</span>
              </div>
              <div className="text-slate-300 space-y-1">
                <div className="text-amber-300 font-semibold">PK: id (TEXT)</div>
                <div>date (TEXT)</div>
                <div className="text-blue-300">FK: worker_id → workers.id</div>
                <div className="text-blue-300">FK: activity_id → activities.id</div>
                <div className="text-blue-300">FK: work_area_id → areas.id</div>
                <div className="text-blue-300">FK: supervisor_id → supervisors.id</div>
                <div>assignment_status (TEXT)</div>
              </div>
            </div>

            {/* Table 4: work_activities */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-1.5 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-purple-400 font-bold">
                <span>work_activities</span>
                <span className="text-[9px] text-slate-500">[Master Data]</span>
              </div>
              <div className="text-slate-300 space-y-1">
                <div className="text-amber-300 font-semibold">PK: id (TEXT)</div>
                <div>activity_name (TEXT)</div>
                <div>description_of_work (TEXT)</div>
                <div>unit_of_measurement (TEXT)</div>
                <div>target_productivity_rate (REAL)</div>
                <div>activity_status (TEXT)</div>
              </div>
            </div>

            {/* Table 5: daily_accomplishments */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-1.5 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-rose-400 font-bold">
                <span>daily_accomplishments</span>
                <span className="text-[9px] text-slate-500">[Accomplishment]</span>
              </div>
              <div className="text-slate-300 space-y-1">
                <div className="text-amber-300 font-semibold">PK: id (TEXT)</div>
                <div>date (TEXT)</div>
                <div className="text-blue-300">FK: activity_id → activities.id</div>
                <div className="text-blue-300">FK: work_area_id → areas.id</div>
                <div>planned_quantity (REAL)</div>
                <div>actual_quantity (REAL)</div>
                <div>actual_labor_hours (REAL)</div>
                <div>actual_productivity_rate (REAL)</div>
                <div>performance_status (TEXT)</div>
              </div>
            </div>

            {/* Table 6: accomplishment_participants */}
            <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 space-y-1.5 shadow-md">
              <div className="flex items-center justify-between border-b border-slate-800 pb-1 text-cyan-400 font-bold">
                <span>accomplishment_participants</span>
                <span className="text-[9px] text-slate-500">[Junction Table]</span>
              </div>
              <div className="text-slate-300 space-y-1">
                <div className="text-amber-300 font-semibold">PK: id (TEXT)</div>
                <div className="text-blue-300">FK: accomplishment_id (CASCADE)</div>
                <div className="text-blue-300">FK: worker_id → workers.id</div>
                <div>hours_contributed (REAL)</div>
                <div className="text-[10px] text-slate-500">Supports Worker Teams</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION D: DASHBOARD FEATURES & FORMULAS */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" />
          Section D: Dashboard Features & Automated Mathematical Formulas
        </h3>
        <p className="text-xs text-slate-600">
          All dashboard indicators, summary metrics, and report totals are computed strictly from database records using the following validated mathematical rules:
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <span className="font-bold text-slate-800 block text-[11px] font-sans">1. Shift Hours & Net Work Time</span>
            <div className="p-2.5 bg-white rounded border border-slate-200 text-slate-900">
              Elapsed Hours = Time Out − Time In<br/>
              Total Hours Worked = Elapsed Hours − Unpaid Break (1.0 hr)
            </div>
            <p className="text-[11px] text-slate-500 font-sans">
              *Unpaid break deduction applies whenever shift elapsed ≥ 5.0 hours.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <span className="font-bold text-slate-800 block text-[11px] font-sans">2. Overtime Hours Calculation</span>
            <div className="p-2.5 bg-white rounded border border-slate-200 text-slate-900">
              Overtime Hours = Max(0, Total Hours Worked − 8.0)
            </div>
            <p className="text-[11px] text-slate-500 font-sans">
              *Hours up to 8.0 are regular hours; remaining hours are overtime.
            </p>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <span className="font-bold text-slate-800 block text-[11px] font-sans">3. Labor Cost & Payroll Formula</span>
            <div className="p-2.5 bg-white rounded border border-slate-200 text-slate-900">
              Hourly Rate = Daily Wage Rate ÷ 8.0<br/>
              Regular Pay = Regular Hours × Hourly Rate<br/>
              Overtime Pay = OT Hours × Hourly Rate × 1.25<br/>
              Total Labor Cost = Regular Pay + Overtime Pay
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
            <span className="font-bold text-slate-800 block text-[11px] font-sans">4. Physical Productivity & Achievement</span>
            <div className="p-2.5 bg-white rounded border border-slate-200 text-slate-900">
              Actual Productivity = Actual Output ÷ Labor Hours<br/>
              Productivity Ach % = (Actual Rate ÷ Target Rate) × 100<br/>
              Planned Ach % = (Actual Output ÷ Planned Output) × 100
            </div>
            <p className="text-[11px] text-slate-500 font-sans">
              *Flagged as <strong>Below Target</strong> whenever Actual Rate &lt; 95% of Target Rate.
            </p>
          </div>
        </div>
      </section>

      {/* SECTION E: SCREENSHOTS & CAPTURE CHECKLIST */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-4">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" />
          Section E: Screenshots Checklist & Interface Verification
        </h3>
        <p className="text-xs text-slate-600">
          For academic report submission, use the live system to capture genuine screenshots of all 11 required system views:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
          {[
            { id: 1, title: 'Login Page', desc: 'Authentication screen with branding and quick demo logins' },
            { id: 2, title: 'Labor Management Dashboard', desc: 'All 6 sections A through F with charts and KPIs' },
            { id: 3, title: 'Worker Master Data Table', desc: '15 certified construction workers with trade filters' },
            { id: 4, title: 'Add Worker Form Modal', desc: 'Modal input form with age and daily wage validation' },
            { id: 5, title: 'Attendance Management Sheet', desc: '75 records across 5 sample days with OT calculations' },
            { id: 6, title: 'Daily Labor Assignments', desc: '75 assignments linked to work areas and supervisors' },
            { id: 7, title: 'Work Activity Master Data', desc: '10 unique construction activities with target rates' },
            { id: 8, title: 'Daily Accomplishments Records', desc: 'Physical quantities with Below Target alert badges' },
            { id: 9, title: 'Reports & Analytics Hub', desc: 'Trade payroll ledgers and printable summary tables' },
            { id: 10, title: 'User Management Control Panel', desc: 'Admin 10-module RBAC permissions configuration matrix' },
            { id: 11, title: 'System Settings & Audit Log', desc: 'Configurable shift thresholds and immutable audit trail' }
          ].map(item => (
            <div key={item.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50/50 flex items-start gap-2.5">
              <Camera className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-slate-900">{item.id}. {item.title}</span>
                <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* SECTION F: SYSTEM FUNCTIONALITY & DATA FLOW */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" />
          Section F: System Functionality & Operational Lifecycle
        </h3>
        <p className="text-xs text-slate-700 leading-relaxed">
          The operational workflow follows a strict chronological pipeline on a construction project:
        </p>
        <ol className="list-decimal list-inside text-xs text-slate-700 space-y-2 leading-relaxed">
          <li>
            <strong>Pre-Shift Assignment:</strong> The Site Civil Engineer accesses the Daily Labor Assignment module, allocating active workers from the Worker Master directory to verified work activities and physical jobsite zones under designated supervisors.
          </li>
          <li>
            <strong>Shift Attendance & Ingestion:</strong> As workers arrive on site, the Time In is recorded. If clocking in after 08:00, the record is flagged as Late. At shift completion (17:00 or 19:00 for overtime shifts), Time Out is recorded, immediately computing Total Hours Worked (net of 1h lunch) and Overtime Hours.
          </li>
          <li>
            <strong>Physical Accomplishment Recording:</strong> Supervisors record the actual physical quantity completed (e.g. 760 kg rebar or 32 m² formwork) and attribute the labor-hours. The system calculates the actual productivity rate and flags any activity falling short of the benchmark.
          </li>
          <li>
            <strong>Executive Analytics & Payroll Reconciliation:</strong> The Project Manager views the 6-section Dashboard and Reports Hub. Daily and month-to-date labor costs are instantly refreshed without manual spreadsheet recalculations.
          </li>
        </ol>
      </section>

      {/* SECTION G: DATABASE ACCESS & DEPLOYMENT */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" />
          Section G: Verified Database System Access Link & Credentials
        </h3>
        <p className="text-xs text-slate-700 leading-relaxed">
          The application is fully compiled, deployed, and live at the following verified application URLs:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs font-mono">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-sans block">Primary Production URL</span>
            <a
              href={sharedUrl}
              target="_blank"
              rel="noreferrer"
              className="text-amber-700 hover:underline break-all font-semibold flex items-center gap-1.5"
            >
              <span>{sharedUrl}</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
            <p className="text-[11px] text-slate-500 font-sans">
              Google Cloud Run managed production container.
            </p>
          </div>

          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <span className="text-[10px] uppercase font-bold text-slate-500 font-sans block">Development Preview URL</span>
            <a
              href={devUrl}
              target="_blank"
              rel="noreferrer"
              className="text-blue-700 hover:underline break-all font-semibold flex items-center gap-1.5"
            >
              <span>{devUrl}</span>
              <ExternalLink className="w-3.5 h-3.5 shrink-0" />
            </a>
            <p className="text-[11px] text-slate-500 font-sans">
              Live development sandbox with real-time API proxies.
            </p>
          </div>
        </div>

        {/* Firebase Console & Cloud SQL Direct Links */}
        <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-xs font-mono">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-slate-600 font-sans block">
              Active Databases: Firebase Firestore & Google Cloud SQL
            </span>
            <span className="text-[11px] text-emerald-700 font-sans font-semibold">Region: asia-southeast1 (Singapore)</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-3 bg-amber-500/10 border border-amber-300 rounded space-y-1">
              <span className="font-sans font-bold text-slate-900 block text-xs flex items-center gap-1.5">
                <Database className="w-3.5 h-3.5 text-amber-600" />
                Firebase Console (Firestore Data Explorer)
              </span>
              <p className="font-sans text-[11px] text-slate-600 pb-1">
                Database: <code className="bg-white px-1 font-mono text-[10px]">ai-studio-buildpulselmscon-929e2a11-8a72-44f1-aa18-057c20c23bc9</code>
              </p>
              <a
                href="https://console.firebase.google.com/project/isometric-decorator-k01dl/firestore/databases/ai-studio-buildpulselmscon-929e2a11-8a72-44f1-aa18-057c20c23bc9/data"
                target="_blank"
                rel="noreferrer"
                className="text-amber-800 hover:underline break-all font-bold flex items-center gap-1 text-xs"
              >
                <span>Open Firebase Console Data</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>

            <div className="p-3 bg-white rounded border border-slate-200 space-y-1">
              <span className="font-sans font-semibold text-slate-800 block text-xs">Cloud SQL Studio (PostgreSQL Query Editor)</span>
              <p className="font-sans text-[11px] text-slate-500 pb-1">
                Instance: <code className="bg-slate-100 px-1 font-mono text-[10px]">ai-studio-929e2a11</code> | DB: <code className="bg-slate-100 px-1 font-mono text-[10px]">cloud_sql_development_database</code>
              </p>
              <a
                href="https://console.cloud.google.com/sql/instances/ai-studio-929e2a11/studio?project=isometric-decorator-k01dl"
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline break-all font-semibold flex items-center gap-1"
              >
                <span>Open Cloud SQL Studio</span>
                <ExternalLink className="w-3.5 h-3.5 shrink-0" />
              </a>
            </div>
          </div>
        </div>

        {/* Credentials Box */}
        <div className="p-4 bg-slate-900 text-slate-100 rounded-lg space-y-2 text-xs font-mono">
          <span className="text-amber-400 font-bold font-sans text-xs uppercase tracking-wider block">
            Pre-Configured Demonstration Credentials
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="p-2.5 bg-slate-800 rounded border border-slate-700">
              <span className="text-amber-300 font-semibold font-sans block">1. Administrator Account (Full Control)</span>
              <div>Email: admin@buildpulse.lms</div>
              <div>Password: AdminPass123!</div>
            </div>
            <div className="p-2.5 bg-slate-800 rounded border border-slate-700">
              <span className="text-blue-300 font-semibold font-sans block">2. Standard User (Site Engineer)</span>
              <div>Email: user@buildpulse.lms</div>
              <div>Password: UserPass123!</div>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION H: SUGGESTED ADVANCEMENTS */}
      <section className="bg-white p-6 rounded-xl border border-slate-200 shadow-2xs space-y-3">
        <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider flex items-center gap-2 border-b pb-2">
          <span className="w-2.5 h-2.5 bg-amber-500 rounded-sm" />
          Section H: Realistic Future Advancements
        </h3>
        <p className="text-xs text-slate-700 leading-relaxed">
          While the current LMS satisfies all mandatory requirements for the academic submission, the following scalable advancements represent practical enterprise roadmap extensions:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <h4 className="font-semibold text-slate-900">1. QR-Code & NFC Field Clocking</h4>
            <p className="text-slate-600 leading-relaxed">
              Equip hardhat stickers with encrypted QR codes or NFC tags for turnstile or mobile scanning at jobsite access gates.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <h4 className="font-semibold text-slate-900">2. Multi-Tier Timesheet Approval</h4>
            <p className="text-slate-600 leading-relaxed">
              Formalize sign-off stages where Foremen endorse daily hours, Site Civil Engineers review, and Project Accountants certify before export.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <h4 className="font-semibold text-slate-900">3. Equipment-Labor Pairing</h4>
            <p className="text-slate-600 leading-relaxed">
              Track heavy equipment utilization (e.g. backhoes, tower cranes) synchronized directly with operator labor hours to calculate composite machine-labor productivity.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-1">
            <h4 className="font-semibold text-slate-900">4. Predictive Weather & Schedule Modeling</h4>
            <p className="text-slate-600 leading-relaxed">
              Integrate weather radar feeds to automatically adjust expected productivity rates during adverse conditions like heavy tropical rainfall.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
};
