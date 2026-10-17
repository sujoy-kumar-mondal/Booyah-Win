import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { ProtectedRoute } from './components/layout/ProtectedRoute.js';
import { GuestRoute } from './components/layout/GuestRoute.js';
import { AppLayout } from './components/layout/AppLayout.js';
import { useAuth } from './context/AuthContext.js';
import { Login } from './pages/Login.js';
import { Register } from './pages/Register.js';
import { Home } from './pages/Home.js';
import { Landing } from './pages/Landing.js';
import { Profile } from './pages/Profile.js';
import { Wallet } from './pages/Wallet.js';
import { Matches } from './pages/Matches.js';
import { Support } from './pages/Support.js';
import { Leaderboard } from './pages/Leaderboard.js';
import { Referral } from './pages/Referral.js';
import { SessionReplacedModal } from './components/common/SessionReplacedModal.js';
import { LanguageSelectionModal } from './components/common/LanguageSelectionModal.js';
import { ScrollToTop } from './components/common/ScrollToTop.js';
import { useSessionWatcher } from './hooks/useSessionWatcher.js';

export const RootIndex: React.FC = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Home /> : <Landing />;
};

export const App: React.FC = () => {
  useSessionWatcher();

  return (
    <>
      <ScrollToTop />
      <SessionReplacedModal />
      <LanguageSelectionModal />
      <Routes>
        {/* Guest Only Routes */}
        <Route element={<GuestRoute />}>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>

        {/* Public Routes with AppLayout (Guest & Player accessible) */}
        <Route element={<AppLayout />}>
          <Route path="/" element={<RootIndex />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/support" element={<Support />} />
        </Route>

        {/* Protected Routes accessible inside AppLayout */}
        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/profile" element={<Profile />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/referral" element={<Referral />} />
            <Route path="/referrals" element={<Navigate to="/referral" replace />} />
          </Route>
        </Route>

        {/* Catch-all */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
};
