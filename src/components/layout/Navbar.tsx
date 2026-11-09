import React, { useState, useEffect } from 'react';
import { Calendar, Bell, LogOut, User as UserIcon, Shield, ChevronDown, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import { AuditLog } from '../../types';
import { ThemeSwitcher } from '../common/ThemeSwitcher';

interface NavbarProps {
  currentDate: string;
  onDateChange: (date: string) => void;
  activePageTitle: string;
  onOpenDoc?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentDate,
  onDateChange,
  activePageTitle
}) => {
  const { user, logout, loginDemo } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [recentLogs, setRecentLogs] = useState<AuditLog[]>([]);

  useEffect(() => {
    if (showNotifications) {
      api.getAuditLogs().then(logs => {
        setRecentLogs(logs.slice(0, 5));
      }).catch(() => {});
    }
  }, [showNotifications]);

  const sampleDates = [
    { date: '2026-10-20', label: 'Day 1: Mon, Oct 20, 2026' },
    { date: '2026-10-21', label: 'Day 2: Tue, Oct 21, 2026' },
    { date: '2026-10-22', label: 'Day 3: Wed, Oct 22, 2026' },
    { date: '2026-10-23', label: 'Day 4: Thu, Oct 23, 2026' },
    { date: '2026-10-24', label: 'Day 5: Fri, Oct 24, 2026' },
  ];

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between gap-6 px-6 py-3.5 bg-white border-b border-slate-200">
      {/* Zone 1: Brand & Page Context */}
      <div className="flex items-center gap-4 shrink-0">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white font-bold text-sm tracking-tight shadow-2xs">
            BP
          </div>
          <div className="hidden sm:block">
            <h1 className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">
              BuildPulse LMS
            </h1>
            <p className="text-[11px] text-slate-500 whitespace-nowrap">Metro Heights Phase 2</p>
          </div>
        </div>

        <div className="h-4 w-px bg-slate-200 hidden md:block" />

        <div className="hidden md:flex items-center gap-2 text-xs text-slate-600">
          <span className="text-slate-400">Section:</span>
          <span className="font-semibold text-slate-800">{activePageTitle}</span>
        </div>
      </div>

      {/* Zone 2: Date Selector (5-day sample cycle) */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 rounded-lg border border-slate-200 text-xs">
          <Calendar className="w-3.5 h-3.5 text-slate-500" />
          <span className="text-slate-500 hidden lg:inline">Active Date:</span>
          <select
            value={currentDate}
            onChange={(e) => onDateChange(e.target.value)}
            className="bg-transparent font-medium text-slate-900 focus:outline-none cursor-pointer pr-1"
          >
            {sampleDates.map(d => (
              <option key={d.date} value={d.date}>
                {d.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Zone 3: User controls & Quick Account switcher */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Quick Role Switcher (Academic Evaluation Convenience) */}
        <div className="hidden xl:flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-xs">
          <button
            onClick={() => loginDemo('admin')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              user?.role === 'admin'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Switch to Administrator (Full Control)"
          >
            Admin View
          </button>
          <button
            onClick={() => loginDemo('user')}
            className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
              user?.role === 'user'
                ? 'bg-white text-slate-900 shadow-2xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Switch to Standard Site Engineer (RBAC Restricted)"
          >
            Site Engr View
          </button>
        </div>

        {/* Theme Switcher */}
        <ThemeSwitcher />

        {/* Notifications Popover */}
        <div className="relative">
          <button
            onClick={() => {
              setShowNotifications(!showNotifications);
              setShowUserMenu(false);
            }}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors relative"
            title="Activity Notifications"
          >
            <Bell className="w-4 h-4" />
          </button>

          {showNotifications && (
            <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50 animate-in fade-in zoom-in-95 duration-100">
              <div className="px-4 py-2 border-b border-slate-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">Recent Audit Actions</span>
                <span className="text-[10px] text-slate-500 font-mono">Live Logs</span>
              </div>
              <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
                {recentLogs.length > 0 ? (
                  recentLogs.map(log => (
                    <div key={log.id} className="p-3 text-xs hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between text-[11px] text-slate-500 mb-0.5">
                        <span className="font-semibold text-slate-700">{log.module}</span>
                        <span className="font-mono">{new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                      <p className="text-slate-600 line-clamp-2 leading-relaxed">{log.details}</p>
                    </div>
                  ))
                ) : (
                  <p className="p-4 text-xs text-center text-slate-400">No recent activity logs.</p>
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Account Menu */}
        <div className="relative">
          <button
            onClick={() => {
              setShowUserMenu(!showUserMenu);
              setShowNotifications(false);
            }}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
          >
            <div className="w-6 h-6 rounded-md bg-slate-200 flex items-center justify-center text-slate-700 font-semibold text-xs">
              {user?.fullName?.charAt(0) || 'U'}
            </div>
            <div className="text-left hidden sm:block">
              <p className="text-xs font-medium text-slate-800 leading-none truncate max-w-[130px]">
                {user?.fullName?.split(' ')[0] || 'User'}
              </p>
              <span className={`text-[10px] font-semibold tracking-wide uppercase ${user?.role === 'admin' ? 'text-amber-600' : 'text-blue-600'}`}>
                {user?.role === 'admin' ? 'Administrator' : 'Site Engineer'}
              </span>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
          </button>

          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-slate-200 py-2 z-50">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-xs font-semibold text-slate-900">{user?.fullName}</p>
                <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                <div className="mt-2 inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
                  <Shield className="w-3 h-3 text-slate-500" />
                  Role: <span className="capitalize font-semibold">{user?.role}</span>
                </div>
              </div>

              <div className="p-1">
                <button
                  onClick={() => {
                    setShowUserMenu(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg transition-colors text-left"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
