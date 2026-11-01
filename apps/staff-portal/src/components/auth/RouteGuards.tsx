/**
 * Route protection guards for Staff Portal
 *
 * Requirements:
 * - RequireStaffAuth: Redirects unauthenticated staff to /login
 * - RequireAdminRole (Requirement 8): Blocks employees from accessing admin-only routes
 *   when typed directly into the URL bar
 */

import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useStaffAuth } from '../../context/StaffAuthContext.js';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export const RequireStaffAuth: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { token, isLoading } = useStaffAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-slate-950 text-slate-400">
        <div className="flex items-center gap-2 text-sm">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          <span>Verifying staff session...</span>
        </div>
      </div>
    );
  }

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
};

export const RequireAdminRole: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { staff, isLoading } = useStaffAuth();

  if (isLoading) {
    return null;
  }

  if (staff?.role !== 'admin') {
    return (
      <div
        className="flex min-h-[400px] flex-col items-center justify-center p-6 text-center"
        data-testid="admin-forbidden-screen"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-500/10 text-rose-400 mb-4">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h2 className="text-lg font-bold text-slate-100">Access Restricted</h2>
        <p className="mt-1 text-sm text-slate-400 max-w-md">
          This section requires Administrator privileges. Your account is registered as an Employee.
        </p>
        <Link
          to="/dashboard"
          data-testid="back-to-dashboard-btn"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-200 hover:bg-slate-700 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return <>{children}</>;
};
