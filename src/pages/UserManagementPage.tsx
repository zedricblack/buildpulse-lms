import React, { useState, useEffect } from 'react';
import {
  UserCog,
  Plus,
  Search,
  Shield,
  KeyRound,
  Edit2,
  Lock,
  UserCheck,
  UserX,
  AlertCircle,
  Check,
  X
} from 'lucide-react';
import { api } from '../services/api';
import { User, UserPermission } from '../types';
import { useAuth } from '../context/AuthContext';
import { Modal } from '../components/common/Modal';
import { ConfirmDialog } from '../components/common/ConfirmDialog';
import { EmptyState } from '../components/common/EmptyState';

const MODULES = [
  { key: 'dashboard', name: 'Dashboard' },
  { key: 'attendance', name: 'Attendance Management' },
  { key: 'assignments', name: 'Daily Labor Assignment' },
  { key: 'accomplishments', name: 'Daily Accomplishment' },
  { key: 'workers', name: 'Worker Master Data' },
  { key: 'activities', name: 'Work Activity Master' },
  { key: 'reports', name: 'Reports & Analytics' },
  { key: 'users', name: 'User Management (Admin Only)' },
  { key: 'audit', name: 'System Audit Logs' },
  { key: 'settings', name: 'System Settings' }
];

export const UserManagementPage: React.FC = () => {
  const { user: currentUser, refreshUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // Create User Modal
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newFullName, setNewFullName] = useState('');
  const [newRole, setNewRole] = useState<'admin' | 'user'>('user');
  const [newPerms, setNewPerms] = useState<Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>>({});
  const [createError, setCreateError] = useState<string | null>(null);

  // Edit Permissions Modal
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [editFullName, setEditFullName] = useState('');
  const [editRole, setEditRole] = useState<'admin' | 'user'>('user');
  const [editPerms, setEditPerms] = useState<Record<string, { canView: boolean; canCreate: boolean; canEdit: boolean; canDelete: boolean }>>({});
  const [editError, setEditError] = useState<string | null>(null);

  // Reset Password Modal
  const [resetUser, setResetUser] = useState<User | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState('');
  const [resetSuccess, setResetSuccess] = useState<string | null>(null);

  const loadUsers = async () => {
    setIsLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (err) {
      console.error('Failed to load users:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleOpenCreate = () => {
    setNewEmail('');
    setNewPassword('');
    setNewFullName('');
    setNewRole('user');
    const defaultPerms: any = {};
    for (const m of MODULES) {
      defaultPerms[m.key] = {
        canView: m.key !== 'users' && m.key !== 'settings' && m.key !== 'audit',
        canCreate: m.key === 'attendance' || m.key === 'assignments' || m.key === 'accomplishments',
        canEdit: m.key === 'attendance' || m.key === 'assignments' || m.key === 'accomplishments',
        canDelete: false
      };
    }
    setNewPerms(defaultPerms);
    setCreateError(null);
    setIsCreateOpen(true);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newPassword.trim() || !newFullName.trim()) {
      setCreateError('All fields are required.');
      return;
    }

    try {
      await api.createUser({
        email: newEmail.trim(),
        password: newPassword,
        fullName: newFullName.trim(),
        role: newRole,
        permissions: newPerms
      });
      setIsCreateOpen(false);
      loadUsers();
    } catch (err: any) {
      setCreateError(err.message || 'Failed to create user account.');
    }
  };

  const handleOpenEdit = (targetUser: User) => {
    setEditingUser(targetUser);
    setEditFullName(targetUser.fullName);
    setEditRole(targetUser.role);

    const permsMap: any = {};
    for (const m of MODULES) {
      const existing = targetUser.permissions?.find(p => p.moduleKey === m.key);
      permsMap[m.key] = existing ? {
        canView: existing.canView,
        canCreate: existing.canCreate,
        canEdit: existing.canEdit,
        canDelete: existing.canDelete
      } : { canView: true, canCreate: false, canEdit: false, canDelete: false };
    }
    setEditPerms(permsMap);
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;

    try {
      await api.updateUser(editingUser.id, {
        fullName: editFullName.trim(),
        role: editRole,
        permissions: editPerms
      });
      setEditingUser(null);
      await loadUsers();
      if (currentUser?.id === editingUser.id) {
        await refreshUser();
      }
    } catch (err: any) {
      setEditError(err.message || 'Failed to update user profile.');
    }
  };

  const handleToggleUserStatus = async (targetUser: User) => {
    const nextStatus = targetUser.accountStatus === 'active' ? 'inactive' : 'active';
    try {
      await api.updateUserStatus(targetUser.id, nextStatus);
      loadUsers();
    } catch (err: any) {
      alert(err.message || 'Failed to toggle account status.');
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetUser || !newPasswordVal) return;

    try {
      await api.resetUserPassword(resetUser.id, newPasswordVal);
      setResetSuccess('Password has been successfully updated.');
      setTimeout(() => {
        setResetUser(null);
        setResetSuccess(null);
        setNewPasswordVal('');
      }, 1500);
    } catch (err: any) {
      alert(err.message || 'Failed to reset password.');
    }
  };

  const filteredUsers = users.filter(u => {
    if (!searchTerm) return true;
    const s = searchTerm.toLowerCase();
    return (
      u.email.toLowerCase().includes(s) ||
      u.fullName.toLowerCase().includes(s) ||
      u.role.toLowerCase().includes(s)
    );
  });

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            <UserCog className="w-5 h-5 text-amber-500" />
            Admin User Management & RBAC Permissions
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Manage authenticated accounts, assign roles, enforce 10-module permissions, and audit user access.
          </p>
        </div>
        <button
          onClick={handleOpenCreate}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Create New User</span>
        </button>
      </div>

      {/* Search Bar */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200">
        <div className="relative max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search users by name, email, or role..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/10"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-2xs">
        {isLoading ? (
          <div className="p-12 text-center text-xs text-slate-500">Loading user accounts...</div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState
            title="No users found"
            description="No user accounts match your search query."
            actionLabel="Create User"
            onAction={handleOpenCreate}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-4">User ID</th>
                  <th className="py-2.5 px-4">Full Name</th>
                  <th className="py-2.5 px-4">Email Address</th>
                  <th className="py-2.5 px-4 text-center">System Role</th>
                  <th className="py-2.5 px-4 text-center">Account Status</th>
                  <th className="py-2.5 px-4">Module Permissions Overview</th>
                  <th className="py-2.5 px-4">Last Login</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map(u => {
                  const viewableCount = u.permissions?.filter(p => p.canView).length || 0;
                  const isCurrent = u.id === currentUser?.id;
                  return (
                    <tr key={u.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2.5 px-4 font-mono font-medium text-slate-700">{u.id}</td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">
                        {u.fullName} {isCurrent && <span className="text-[10px] text-amber-600 font-normal">(You)</span>}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-slate-600">{u.email}</td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold ${
                          u.role === 'admin'
                            ? 'bg-amber-100 text-amber-800 border border-amber-200'
                            : 'bg-blue-100 text-blue-800 border border-blue-200'
                        }`}>
                          <Shield className="w-3 h-3 shrink-0" />
                          <span className="capitalize">{u.role}</span>
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${
                          u.accountStatus === 'active'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border border-slate-200'
                        }`}>
                          {u.accountStatus}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">
                        {u.role === 'admin' ? (
                          <span className="text-slate-800 font-medium">All 10 Modules (Full Admin)</span>
                        ) : (
                          <span>{viewableCount} of 10 Modules Permitted</span>
                        )}
                      </td>
                      <td className="py-2.5 px-4 font-mono text-[11px] text-slate-500">
                        {u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString() : 'Never'}
                      </td>
                      <td className="py-2.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => handleOpenEdit(u)}
                            className="p-1.5 text-slate-400 hover:text-slate-900 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="Configure Permissions & Role"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => {
                              setResetUser(u);
                              setNewPasswordVal('');
                              setResetSuccess(null);
                            }}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded transition-colors cursor-pointer"
                            title="Reset User Password"
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                          </button>
                          {!isCurrent && (
                            <button
                              onClick={() => handleToggleUserStatus(u)}
                              className={`p-1.5 rounded transition-colors cursor-pointer ${
                                u.accountStatus === 'active'
                                  ? 'text-slate-400 hover:text-red-600 hover:bg-red-50'
                                  : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={u.accountStatus === 'active' ? 'Deactivate User' : 'Activate User'}
                            >
                              {u.accountStatus === 'active' ? <UserX className="w-3.5 h-3.5" /> : <UserCheck className="w-3.5 h-3.5" />}
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
          <span>Active Users in Database: <strong>{users.length}</strong></span>
          <span className="font-mono text-[11px]">Database Source: users & user_module_permissions</span>
        </div>
      </div>

      {/* Create User Modal */}
      <Modal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        title="Provision New User Account"
        description="Create account credentials and assign initial 10-module RBAC permissions."
        maxWidth="2xl"
      >
        <form onSubmit={handleCreateUser} className="space-y-4">
          {createError && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{createError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Full Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                required
                placeholder="e.g. Engr. Mark Dela Cruz"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Email Address <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                required
                placeholder="mark@buildpulse.lms"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Initial Password <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                placeholder="Min 6 characters"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Assigned Role <span className="text-red-500">*</span>
              </label>
              <select
                value={newRole}
                onChange={(e) => setNewRole(e.target.value as any)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
              >
                <option value="user">Standard User (Subject to RBAC Matrix)</option>
                <option value="admin">Administrator (Full System Control)</option>
              </select>
            </div>
          </div>

          {/* Module Permissions Matrix */}
          <div className="pt-2">
            <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
              Granular Module Permissions Matrix
            </h4>
            <div className="border border-slate-200 rounded-lg overflow-hidden max-h-56 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-3">Module</th>
                    <th className="py-2 px-3 text-center">View</th>
                    <th className="py-2 px-3 text-center">Create</th>
                    <th className="py-2 px-3 text-center">Edit</th>
                    <th className="py-2 px-3 text-center">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {MODULES.map(m => {
                    const p = newPerms[m.key] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
                    return (
                      <tr key={m.key} className="hover:bg-slate-50/70">
                        <td className="py-1.5 px-3 font-medium text-slate-800">{m.name}</td>
                        <td className="py-1.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={p.canView}
                            onChange={(e) => setNewPerms({
                              ...newPerms,
                              [m.key]: { ...p, canView: e.target.checked }
                            })}
                          />
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={p.canCreate}
                            onChange={(e) => setNewPerms({
                              ...newPerms,
                              [m.key]: { ...p, canCreate: e.target.checked }
                            })}
                          />
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={p.canEdit}
                            onChange={(e) => setNewPerms({
                              ...newPerms,
                              [m.key]: { ...p, canEdit: e.target.checked }
                            })}
                          />
                        </td>
                        <td className="py-1.5 px-3 text-center">
                          <input
                            type="checkbox"
                            checked={p.canDelete}
                            onChange={(e) => setNewPerms({
                              ...newPerms,
                              [m.key]: { ...p, canDelete: e.target.checked }
                            })}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
            >
              Create Account
            </button>
          </div>
        </form>
      </Modal>

      {/* Edit User & Permissions Modal */}
      {editingUser && (
        <Modal
          isOpen={Boolean(editingUser)}
          onClose={() => setEditingUser(null)}
          title={`Edit User: ${editingUser.fullName}`}
          description="Update account profile information, role classification, and module-level access rules."
          maxWidth="2xl"
        >
          <form onSubmit={handleSaveEdit} className="space-y-4">
            {editError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 text-red-600" />
                <span>{editError}</span>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  required
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  System Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as any)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 bg-white focus:outline-none focus:ring-2 focus:ring-slate-900"
                >
                  <option value="user">Standard User</option>
                  <option value="admin">Administrator</option>
                </select>
              </div>
            </div>

            {/* Matrix */}
            <div>
              <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider mb-2">
                Module Permission Flags (View, Create, Edit, Delete)
              </h4>
              <div className="border border-slate-200 rounded-lg overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-medium border-b border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Module</th>
                      <th className="py-2 px-3 text-center">View</th>
                      <th className="py-2 px-3 text-center">Create</th>
                      <th className="py-2 px-3 text-center">Edit</th>
                      <th className="py-2 px-3 text-center">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {MODULES.map(m => {
                      const p = editPerms[m.key] || { canView: false, canCreate: false, canEdit: false, canDelete: false };
                      return (
                        <tr key={m.key} className="hover:bg-slate-50/70">
                          <td className="py-1.5 px-3 font-medium text-slate-800">{m.name}</td>
                          <td className="py-1.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={p.canView}
                              onChange={(e) => setEditPerms({
                                ...editPerms,
                                [m.key]: { ...p, canView: e.target.checked }
                              })}
                            />
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={p.canCreate}
                              onChange={(e) => setEditPerms({
                                ...editPerms,
                                [m.key]: { ...p, canCreate: e.target.checked }
                              })}
                            />
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={p.canEdit}
                              onChange={(e) => setEditPerms({
                                ...editPerms,
                                [m.key]: { ...p, canEdit: e.target.checked }
                              })}
                            />
                          </td>
                          <td className="py-1.5 px-3 text-center">
                            <input
                              type="checkbox"
                              checked={p.canDelete}
                              onChange={(e) => setEditPerms({
                                ...editPerms,
                                [m.key]: { ...p, canDelete: e.target.checked }
                              })}
                            />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer"
              >
                Save Changes
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Reset Password Modal */}
      {resetUser && (
        <Modal
          isOpen={Boolean(resetUser)}
          onClose={() => setResetUser(null)}
          title={`Reset Password: ${resetUser.email}`}
          description="Enter a new password for this user. The password will be hashed on the server with bcrypt."
          maxWidth="sm"
        >
          <form onSubmit={handleResetPassword} className="space-y-4">
            {resetSuccess ? (
              <div className="p-3 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-medium">
                {resetSuccess}
              </div>
            ) : (
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  New Password (min 6 characters)
                </label>
                <input
                  type="password"
                  value={newPasswordVal}
                  onChange={(e) => setNewPasswordVal(e.target.value)}
                  required
                  placeholder="Enter new password"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
                />
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setResetUser(null)}
                className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
              >
                Close
              </button>
              {!resetSuccess && (
                <button
                  type="submit"
                  className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
                >
                  Update Password
                </button>
              )}
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
};
