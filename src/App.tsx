import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { LoginPage } from './pages/LoginPage';
import { Navbar } from './components/layout/Navbar';
import { Sidebar, PageId } from './components/layout/Sidebar';
import { DashboardPage } from './pages/DashboardPage';
import { WorkersPage } from './pages/WorkersPage';
import { AttendancePage } from './pages/AttendancePage';
import { AssignmentsPage } from './pages/AssignmentsPage';
import { ActivitiesPage } from './pages/ActivitiesPage';
import { AccomplishmentsPage } from './pages/AccomplishmentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { AuditLogPage } from './pages/AuditLogPage';
import { SettingsPage } from './pages/SettingsPage';
import { DocumentationPage } from './pages/DocumentationPage';

const AppContent: React.FC = () => {
  const { user, isLoading, hasPermission } = useAuth();
  const [activePage, setActivePage] = useState<PageId>('dashboard');
  const [currentDate, setCurrentDate] = useState<string>('2026-10-24');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [pageFilter, setPageFilter] = useState<any>(null);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-amber-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-xs text-slate-400 font-mono">Initializing BuildPulse LMS Session...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  const handleNavigate = (page: PageId, filter?: any) => {
    setPageFilter(filter || null);
    setActivePage(page);
  };

  const getPageTitle = (page: PageId): string => {
    switch (page) {
      case 'dashboard': return 'Labor Performance Dashboard';
      case 'workers': return 'Worker Master Data';
      case 'attendance': return 'Daily Attendance Management';
      case 'assignments': return 'Daily Labor Assignments';
      case 'activities': return 'Work Activity Master Data';
      case 'accomplishments': return 'Daily Accomplishment Records';
      case 'reports': return 'Reports & Analytics';
      case 'users': return 'User Management Control Panel';
      case 'audit': return 'System Audit Logs';
      case 'settings': return 'System Configuration';
      case 'docs': return 'Academic Documentation & ERD';
      default: return 'BuildPulse LMS';
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-row overflow-x-hidden text-slate-900 font-sans">
      {/* Sidebar */}
      <div className="no-print shrink-0">
        <Sidebar
          activePage={activePage}
          onSelectPage={(p) => {
            setPageFilter(null);
            setActivePage(p);
          }}
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
        />
      </div>

      {/* Main Viewport */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen overflow-y-auto">
        <div className="no-print">
          <Navbar
            currentDate={currentDate}
            onDateChange={setCurrentDate}
            activePageTitle={getPageTitle(activePage)}
            onOpenDoc={() => setActivePage('docs')}
          />
        </div>

        <main className="flex-1 p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto">
          {activePage === 'dashboard' && (
            <DashboardPage
              currentDate={currentDate}
              onNavigate={handleNavigate}
            />
          )}

          {activePage === 'workers' && <WorkersPage />}

          {activePage === 'attendance' && (
            <AttendancePage
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              initialFilter={pageFilter}
            />
          )}

          {activePage === 'assignments' && (
            <AssignmentsPage
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              initialFilter={pageFilter}
            />
          )}

          {activePage === 'activities' && <ActivitiesPage />}

          {activePage === 'accomplishments' && (
            <AccomplishmentsPage
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              initialFilter={pageFilter}
            />
          )}

          {activePage === 'reports' && <ReportsPage />}

          {activePage === 'users' && (
            user.role === 'admin' ? (
              <UserManagementPage />
            ) : (
              <div className="p-8 text-center bg-white rounded-xl border border-red-200 text-red-700">
                <p className="font-semibold text-sm">Access Restricted</p>
                <p className="text-xs text-slate-500 mt-1">
                  Administrator role is required to access the User Management Control Panel.
                </p>
              </div>
            )
          )}

          {activePage === 'audit' && (
            hasPermission('audit', 'view') ? (
              <AuditLogPage />
            ) : (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-600">
                <p className="font-semibold text-sm">Permission Required</p>
                <p className="text-xs text-slate-500 mt-1">You do not have permission to view the audit log.</p>
              </div>
            )
          )}

          {activePage === 'settings' && (
            hasPermission('settings', 'view') ? (
              <SettingsPage />
            ) : (
              <div className="p-8 text-center bg-white rounded-xl border border-slate-200 text-slate-600">
                <p className="font-semibold text-sm">Permission Required</p>
                <p className="text-xs text-slate-500 mt-1">You do not have permission to view system settings.</p>
              </div>
            )
          )}

          {activePage === 'docs' && <DocumentationPage />}
        </main>
      </div>
    </div>
  );
};

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ThemeProvider>
  );
}
