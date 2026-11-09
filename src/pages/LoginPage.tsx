import React, { useState } from 'react';
import { Eye, EyeOff, Lock, Mail, HardHat, ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { Modal } from '../components/common/Modal';
import { ThemeSwitcher } from '../components/common/ThemeSwitcher';

export const LoginPage: React.FC = () => {
  const { login, loginWithGoogle } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotStatus, setForgotStatus] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setErrorMessage('Please enter both email address and password.');
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      await login({ email: email.trim(), password });
    } catch (err: any) {
      setErrorMessage(err.message || 'Invalid email or password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorMessage(err.message || 'Firebase Google Sign-In was cancelled or failed.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail) return;

    try {
      const res = await api.requestPasswordReset(forgotEmail);
      setForgotStatus(res.message);
    } catch (err: any) {
      setForgotStatus(err.message || 'Error requesting password reset.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Top Right Theme Selector */}
      <div className="absolute top-4 right-4 z-20">
        <ThemeSwitcher />
      </div>

      {/* Background architectural grid */}
      <div className="absolute inset-0 opacity-5 pointer-events-none bg-[radial-gradient(#ffffff_1px,transparent_1px)] [background-size:16px_16px]" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-amber-500 text-slate-950 mb-4 shadow-lg shadow-amber-500/20">
            <HardHat className="w-8 h-8" />
          </div>
          <h2 className="text-2xl font-bold tracking-tight text-white">
            BuildPulse LMS
          </h2>
          <p className="mt-1 text-xs text-slate-400">
            Construction Labor Management & Productivity System
          </p>
        </div>

        {/* Login Card */}
        <div className="mt-8 bg-slate-800/90 border border-slate-700/80 rounded-2xl p-6 sm:p-8 shadow-2xl backdrop-blur-md">
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-white">Account Sign In</h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Access the Cloud SQL PostgreSQL workforce database with your authorized credentials.
            </p>
          </div>

          {errorMessage && (
            <div className="mb-5 p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-start gap-2.5">
              <span className="font-semibold text-red-400 shrink-0">Error:</span>
              <p className="leading-relaxed">{errorMessage}</p>
            </div>
          )}

          {/* Google Sign-In with Firebase Auth */}
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="w-full mb-4 py-2.5 px-4 bg-slate-900 hover:bg-slate-950 border border-slate-700 hover:border-slate-600 text-white font-medium text-xs rounded-lg transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
              />
            </svg>
            <span>Sign in with Google</span>
          </button>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-700" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="px-2 bg-slate-800 text-slate-500 font-medium">Or email sign in</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email Address <span className="text-amber-400">*</span>
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Mail className="w-4 h-4" />
                </div>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@buildpulse.lms"
                  required
                  className="w-full pl-9 pr-3 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-slate-300">
                  Password <span className="text-amber-400">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotModal(true);
                    setForgotStatus(null);
                    setForgotEmail(email);
                  }}
                  className="text-[11px] text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-500">
                  <Lock className="w-4 h-4" />
                </div>
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  required
                  className="w-full pl-9 pr-10 py-2 bg-slate-900/80 border border-slate-700 rounded-lg text-white placeholder-slate-500 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-200"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-4 bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-xs rounded-lg transition-colors flex items-center justify-center gap-2 shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In to System</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </form>
        </div>

        {/* Security Notice */}
        <p className="mt-6 text-center text-[11px] text-slate-500">
          Connected to Google Cloud SQL PostgreSQL database with Firebase Auth & RBAC security.
        </p>
      </div>

      {/* Forgot Password Modal */}
      <Modal
        isOpen={showForgotModal}
        onClose={() => setShowForgotModal(false)}
        title="Password Recovery"
        description="Submit your registered email to request an administrator password reset."
        maxWidth="sm"
      >
        <form onSubmit={handleForgotPassword} className="space-y-4">
          {forgotStatus ? (
            <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs">
              {forgotStatus}
            </div>
          ) : (
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Registered Email
              </label>
              <input
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900"
              />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setShowForgotModal(false)}
              className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg"
            >
              Close
            </button>
            {!forgotStatus && (
              <button
                type="submit"
                className="px-3 py-1.5 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800 rounded-lg"
              >
                Send Request
              </button>
            )}
          </div>
        </form>
      </Modal>
    </div>
  );
};
