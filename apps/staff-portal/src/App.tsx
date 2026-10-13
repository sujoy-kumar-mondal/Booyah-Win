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
import { Employees } from './pages/Employees.js';
import { EntryTiers } from './pages/EntryTiers.js';
import { Users } from './pages/Users.js';
import { Settings } from './pages/Settings.js';
import { AuditLogs } from './pages/AuditLogs.js';

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
              <Route path="users" element={<Users />} />

              {/* Administration Pages (Admin only - Milestone 10c) */}
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
                    <Employees />
                  </RequireAdminRole>
                }
              />
              <Route
                path="tiers"
                element={
                  <RequireAdminRole>
                    <EntryTiers />
                  </RequireAdminRole>
                }
              />
              <Route
                path="settings"
                element={
                  <RequireAdminRole>
                    <Settings />
                  </RequireAdminRole>
                }
              />
              <Route
                path="audit-logs"
                element={
                  <RequireAdminRole>
                    <AuditLogs />
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
