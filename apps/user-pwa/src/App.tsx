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
import { Matches } from './pages/Matches.js';
import { Support } from './pages/Support.js';
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

        {/* Public / Common Routes accessible inside AppLayout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/matches" element={<Matches />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/support" element={<Support />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};
