import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, UserPermission } from '../types';
import { api, getStoredToken, setStoredToken, clearStoredToken } from '../services/api';
import { auth, googleAuthProvider, signInWithPopup, signOut as firebaseSignOut } from '../lib/firebase';

interface AuthContextType {
  user: User | null;
  permissions: UserPermission[];
  isLoading: boolean;
  login: (credentials: { email: string; password: string }) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  loginDemo: (role: 'admin' | 'user') => Promise<void>;
  logout: () => Promise<void>;
  hasPermission: (moduleKey: string, action?: 'view' | 'create' | 'edit' | 'delete') => boolean;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [permissions, setPermissions] = useState<UserPermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const token = getStoredToken();
    if (!token) {
      setUser(null);
      setPermissions([]);
      setIsLoading(false);
      return;
    }

    try {
      const data = await api.getCurrentUser();
      setUser(data.user);
      setPermissions(data.permissions || []);
    } catch (err) {
      console.warn('Session expired or invalid token:', err);
      clearStoredToken();
      setUser(null);
      setPermissions([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, []);

  const login = async (credentials: { email: string; password: string }) => {
    const data = await api.login(credentials);
    setStoredToken(data.token);
    setUser(data.user);
    setPermissions(data.permissions || []);
  };

  const loginWithGoogle = async () => {
    try {
      const result = await signInWithPopup(auth, googleAuthProvider);
      const idToken = await result.user.getIdToken();
      setStoredToken(idToken);
      const data = await api.getCurrentUser();
      setUser(data.user);
      setPermissions(data.permissions || []);
    } catch (err: any) {
      console.error('Google Sign-In failed:', err);
      throw new Error(err.message || 'Google Sign-In failed.');
    }
  };

  const loginDemo = async (role: 'admin' | 'user') => {
    const credentials = role === 'admin'
      ? { email: 'admin@buildpulse.lms', password: 'AdminPass123!' }
      : { email: 'user@buildpulse.lms', password: 'UserPass123!' };
    await login(credentials);
  };

  const logout = async () => {
    try {
      await firebaseSignOut(auth);
    } catch {
      // ignore
    }
    try {
      await api.logout();
    } catch {
      // ignore
    } finally {
      clearStoredToken();
      setUser(null);
      setPermissions([]);
    }
  };

  const hasPermission = (moduleKey: string, action: 'view' | 'create' | 'edit' | 'delete' = 'view'): boolean => {
    if (!user) return false;
    if (user.role === 'admin') return true;

    const perm = permissions.find(p => p.moduleKey === moduleKey);
    if (!perm) return false;

    switch (action) {
      case 'view': return Boolean(perm.canView);
      case 'create': return Boolean(perm.canCreate);
      case 'edit': return Boolean(perm.canEdit);
      case 'delete': return Boolean(perm.canDelete);
      default: return false;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        permissions,
        isLoading,
        login,
        loginWithGoogle,
        loginDemo,
        logout,
        hasPermission,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
