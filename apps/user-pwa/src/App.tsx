import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/layout/ProtectedRoute.js';
import { GuestRoute } from './components/layout/GuestRoute.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { Home } from './pages/Home.js';
import { Profile } from './pages/Profile.js';
import { Wallet } from './pages/Wallet.js';
import { SessionReplacedModal } from './components/common/SessionReplacedModal.js';
import { useSessionWatcher } from './hooks/useSessionWatcher.js';

export const App: React.FC = () => {
  useSessionWatcher();

  return (
    <>
      <SessionReplacedModal />
      <Routes>
        {/* Guest Only Routes */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Protected Routes inside AppLayout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route
              path="/matches"
              element={
                <div className="py-12 text-center" data-testid="matches-screen">
                  <h2 className="text-lg font-bold text-slate-100">Match Rooms</h2>
                  <p className="mt-1 text-xs text-slate-400">Match browsing and joining will unlock in Milestone 9b.</p>
                </div>
              }
            />
            <Route path="/wallet" element={<Wallet />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};
