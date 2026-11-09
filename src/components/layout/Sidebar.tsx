import React from 'react';
import {
  LayoutDashboard,
  Users,
  Clock,
  Briefcase,
  Layers,
  Award,
  BarChart3,
  UserCog,
  FileText,
  Settings,
  BookOpen,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type PageId =
  | 'dashboard'
  | 'workers'
  | 'attendance'
  | 'assignments'
  | 'activities'
  | 'accomplishments'
  | 'reports'
  | 'users'
  | 'audit'
  | 'settings'
  | 'docs';

interface SidebarProps {
  activePage: PageId;
  onSelectPage: (page: PageId) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activePage,
  onSelectPage,
  isCollapsed,
  onToggleCollapse
}) => {
  const { hasPermission, user } = useAuth();

  const navItems: Array<{
    id: PageId;
    label: string;
    icon: React.ReactNode;
    moduleKey: string;
    section: string;
    requiresAdmin?: boolean;
  }> = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: <LayoutDashboard className="w-4 h-4" />,
      moduleKey: 'dashboard',
      section: 'OVERVIEW'
    },
    {
      id: 'attendance',
      label: 'Attendance',
      icon: <Clock className="w-4 h-4" />,
      moduleKey: 'attendance',
      section: 'OPERATIONS'
    },
    {
      id: 'assignments',
      label: 'Labor Assignments',
      icon: <Briefcase className="w-4 h-4" />,
      moduleKey: 'assignments',
      section: 'OPERATIONS'
    },
    {
      id: 'accomplishments',
      label: 'Accomplishments',
      icon: <Award className="w-4 h-4" />,
      moduleKey: 'accomplishments',
      section: 'OPERATIONS'
    },
    {
      id: 'workers',
      label: 'Worker Master',
      icon: <Users className="w-4 h-4" />,
      moduleKey: 'workers',
      section: 'MASTER DATA'
    },
    {
      id: 'activities',
      label: 'Work Activities',
      icon: <Layers className="w-4 h-4" />,
      moduleKey: 'activities',
      section: 'MASTER DATA'
    },
    {
      id: 'reports',
      label: 'Reports & Analytics',
      icon: <BarChart3 className="w-4 h-4" />,
      moduleKey: 'reports',
      section: 'INSIGHTS'
    },
    {
      id: 'users',
      label: 'User Management',
      icon: <UserCog className="w-4 h-4" />,
      moduleKey: 'users',
      section: 'ADMINISTRATION',
      requiresAdmin: true
    },
    {
      id: 'audit',
      label: 'Audit Log',
      icon: <FileText className="w-4 h-4" />,
      moduleKey: 'audit',
      section: 'ADMINISTRATION'
    },
    {
      id: 'settings',
      label: 'System Settings',
      icon: <Settings className="w-4 h-4" />,
      moduleKey: 'settings',
      section: 'ADMINISTRATION'
    },
    {
      id: 'docs',
      label: 'Documentation & ERD',
      icon: <BookOpen className="w-4 h-4" />,
      moduleKey: 'docs',
      section: 'SUBMISSION'
    }
  ];

  // Group items by section
  const sections = ['OVERVIEW', 'OPERATIONS', 'MASTER DATA', 'INSIGHTS', 'ADMINISTRATION', 'SUBMISSION'];

  return (
    <aside
      className={`
        bg-slate-900 text-slate-300 flex flex-col shrink-0 transition-all duration-300 z-20 border-r border-slate-800
        ${isCollapsed ? 'w-16' : 'w-64'}
      `}
    >
      {/* Sidebar Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-slate-800/80">
        {!isCollapsed && (
          <div className="flex items-center gap-2">
            <span className="font-bold text-sm tracking-wider text-white">CONSTRUCTION LMS</span>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          className="p-1.5 text-slate-400 hover:text-white rounded-md hover:bg-slate-800 transition-colors mx-auto"
          title={isCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>

      {/* Nav List */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-6">
        {sections.map(section => {
          const items = navItems.filter(item => {
            if (item.section !== section) return false;
            if (item.id === 'docs') return true;
            if (item.requiresAdmin && user?.role !== 'admin') return false;
            return hasPermission(item.moduleKey, 'view');
          });

          if (items.length === 0) return null;

          return (
            <div key={section} className="space-y-1">
              {!isCollapsed && (
                <p className="px-3 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
                  {section}
                </p>
              )}
              {items.map(item => {
                const isActive = activePage === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => onSelectPage(item.id)}
                    className={`
                      w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all text-left
                      ${isActive
                        ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                        : 'text-slate-300 hover:bg-slate-800/70 hover:text-white'
                      }
                      ${isCollapsed ? 'justify-center px-0' : ''}
                    `}
                    title={isCollapsed ? item.label : undefined}
                  >
                    <span className={`shrink-0 ${isActive ? 'text-slate-950' : 'text-slate-400'}`}>
                      {item.icon}
                    </span>
                    {!isCollapsed && (
                      <span className="truncate">{item.label}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-slate-800 text-[11px] text-slate-500">
        {!isCollapsed && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-slate-400">
              <span>Database Engine:</span>
              <span className="font-mono text-emerald-400 font-semibold">Cloud SQL (PG)</span>
            </div>
            <p className="text-[10px] text-slate-500">PostgreSQL 18.6 Verified</p>
          </div>
        )}
      </div>
    </aside>
  );
};
