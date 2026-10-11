/**
 * Staff Portal Main Application & Route Configuration
 */

import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StaffAuthProvider } from './context/StaffAuthContext.js';
import { RequireStaffAuth, RequireAdminRole } from './components/auth/RouteGuards.js';
import { StaffLayout } from './components/layout/StaffLayout.js';
import { Login } from './pages/Login.js';
import { Dashboard } from './pages/Dashboard.js';
import { Deposits } from './pages/Deposits.js';
import { Withdrawals } from './pages/Withdrawals.js';
import { Matches } from './pages/Matches.js';
import { CreateMatch } from './pages/CreateMatch.js';
import { MatchDetail } from './pages/MatchDetail.js';
import { AddResult } from './pages/AddResult.js';
import { AdminResultApprovals } from './pages/AdminResultApprovals.js';
import { ComingSoon } from './pages/ComingSoon.js';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: true,
      staleTime: 15 * 1000,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <StaffAuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Route */}
            <Route path="/login" element={<Login />} />

            {/* Authenticated Staff Routes */}
            <Route
              path="/"
              element={
                <RequireStaffAuth>
                  <StaffLayout />
                </RequireStaffAuth>
              }
            >
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="dashboard" element={<Dashboard />} />
              <Route path="deposits" element={<Deposits />} />
              <Route path="withdrawals" element={<Withdrawals />} />

              {/* Matches Operations (Employees & Admins) */}
              <Route path="matches" element={<Matches />} />
              <Route path="matches/create" element={<CreateMatch />} />
              <Route path="matches/:id" element={<MatchDetail />} />
              <Route path="matches/:id/result" element={<AddResult />} />

              {/* Results Approval Queue (Admin only) */}
              <Route
                path="results"
                element={
                  <RequireAdminRole>
                    <AdminResultApprovals />
                  </RequireAdminRole>
                }
              />
              <Route
                path="employees"
                element={
                  <RequireAdminRole>
                    <ComingSoon
                      title="Employee Management"
                      description="Register staff members, review Aadhaar/PAN verifications, and manage permissions."
                    />
                  </RequireAdminRole>
                }
              />
              <Route
                path="settings"
                element={
                  <RequireAdminRole>
                    <ComingSoon
                      title="Platform Settings"
                      description="Configure global deposit limits, payment QR codes, and system operating parameters."
                    />
                  </RequireAdminRole>
                }
              />
              <Route
                path="audit-logs"
                element={
                  <RequireAdminRole>
                    <ComingSoon
                      title="Audit Logs"
                      description="View administrative activity logs, financial approvals, and sensitive action traces."
                    />
                  </RequireAdminRole>
                }
              />
            </Route>

            {/* Fallback route */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </StaffAuthProvider>
    </QueryClientProvider>
  );
};
