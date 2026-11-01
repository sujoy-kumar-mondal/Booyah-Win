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
import { Account } from './pages/Account.js';
import { MyProfile } from './pages/MyProfile.js';
import { GameUidDetails } from './pages/GameUidDetails.js';
import { MyStatistics } from './pages/MyStatistics.js';
import { Community } from './pages/Community.js';
import { AboutUs } from './pages/AboutUs.js';
import { PrivacyPolicy } from './pages/PrivacyPolicy.js';
import { Wallet } from './pages/Wallet.js';
import { AddMoney } from './pages/AddMoney.js';
import { Withdrawal } from './pages/Withdrawal.js';
import { History } from './pages/History.js';
import { TransactionDetail } from './pages/TransactionDetail.js';
import { Matches } from './pages/Matches.js';
import { MatchDetail } from './pages/MatchDetail.js';
import { Support } from './pages/Support.js';
import { Leaderboard } from './pages/Leaderboard.js';
import { Referral } from './pages/Referral.js';
import { ReferRedirect } from './pages/ReferRedirect.js';
import { Notifications } from './pages/Notifications.js';
import { ImportantUpdates } from './pages/ImportantUpdates.js';
import { CopyOtp } from './pages/CopyOtp.js';
import { SessionReplacedModal } from './components/common/SessionReplacedModal.js';
import { LanguageSelectionModal } from './components/common/LanguageSelectionModal.js';
import { ScrollToTop } from './components/common/ScrollToTop.js';
import { useSessionWatcher } from './hooks/useSessionWatcher.js';
import { useDeepLinks } from './hooks/useDeepLinks.js';

export const RootIndex: React.FC = () => {
  const { isAuthenticated } = useAuth();
  return isAuthenticated ? <Home /> : <Landing />;
};

export const CatchAllRoute: React.FC = () => {
  const { isAuthenticated } = useAuth();
  return <Navigate to={isAuthenticated ? '/' : '/login'} replace />;
};

export const App: React.FC = () => {
  useSessionWatcher();
  useDeepLinks();

  return (
    <>
      <ScrollToTop />
      <SessionReplacedModal />
      <LanguageSelectionModal />
      <Routes>
        {/* App Layout with persistent Navbar & Bottom Nav for all player screens */}
        <Route element={<AppLayout />}>
          {/* Guest Only Routes (Navbar & Bottom Nav visible, redirects to / if authenticated) */}
          <Route element={<GuestRoute />}>
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
          </Route>

          {/* Public Routes (Allowed for unauthenticated users) */}
          <Route path="/" element={<RootIndex />} />
          <Route path="/important-updates" element={<ImportantUpdates />} />
          <Route path="/updates" element={<Navigate to="/important-updates" replace />} />
          <Route path="/support" element={<Support />} />
          <Route path="/matches" element={<Matches />} />
          <Route path="/matches/:id" element={<MatchDetail />} />
          <Route path="/leaderboard" element={<Leaderboard />} />
          <Route path="/refer/:code" element={<ReferRedirect />} />
          <Route path="/refer" element={<Navigate to="/register" replace />} />
          <Route path="/copy-otp" element={<CopyOtp />} />
          <Route path="/community" element={<Community />} />
          <Route path="/about" element={<AboutUs />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/account" element={<Account />} />

          {/* Protected Routes (Authentication required - redirects to /login) */}
          <Route element={<ProtectedRoute />}>
            <Route path="/notifications" element={<Notifications />} />
            <Route path="/account/profile" element={<MyProfile />} />
            <Route path="/account/game-uid" element={<GameUidDetails />} />
            <Route path="/account/statistics" element={<MyStatistics />} />
            <Route path="/profile" element={<Navigate to="/account/profile" replace />} />
            <Route path="/wallet" element={<Wallet />} />
            <Route path="/wallet/add" element={<AddMoney />} />
            <Route path="/wallet/withdraw" element={<Withdrawal />} />
            <Route path="/wallet/history" element={<History />} />
            <Route path="/wallet/history/:id" element={<TransactionDetail />} />
            <Route path="/wallet/transactions" element={<Navigate to="/wallet/history" replace />} />
            <Route path="/wallet/transactions/:id" element={<TransactionDetail />} />
            <Route path="/wallet/requests" element={<Navigate to="/wallet/history" replace />} />
            <Route path="/wallet/my-deposits" element={<Navigate to="/wallet/history" replace />} />
            <Route path="/wallet/my-withdrawals" element={<Navigate to="/wallet/history" replace />} />
            <Route path="/wallet/add-money" element={<Navigate to="/wallet/add" replace />} />
            <Route path="/referral" element={<Referral />} />
            <Route path="/referrals" element={<Navigate to="/referral" replace />} />
          </Route>
        </Route>

        {/* Catch-all: redirect unauthenticated users to /login, authenticated users to / */}
        <Route path="*" element={<CatchAllRoute />} />
      </Routes>
    </>
  );
};
