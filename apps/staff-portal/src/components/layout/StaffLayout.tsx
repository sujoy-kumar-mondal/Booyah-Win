/**
 * Main Layout for Booyah Win Staff Portal
 */

import React, { useState } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { TopBar } from './TopBar.js';
import { useStaffAuth } from '../../context/StaffAuthContext.js';
import { useStaffSessionWatcher } from '../../hooks/useStaffSessionWatcher.js';
import { SessionReplacedModal } from '../common/SessionReplacedModal.js';
import { IdleTimeoutModal } from '../common/IdleTimeoutModal.js';

export const StaffLayout: React.FC = () => {
  const { token, logout, isIdleWarnOpen, stayLoggedIn } = useStaffAuth();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessionReplacedOpen, setSessionReplacedOpen] = useState(false);

  // Hook in the staff session watcher
  useStaffSessionWatcher({
    token,
    onSessionReplaced: () => {
      setSessionReplacedOpen(true);
    },
    onUnauthenticated: () => {
      logout();
      navigate('/login', {
        state: { message: 'Your session has expired. Please log in again.' },
        replace: true,
      });
    },
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex">
      {/* Sidebar for Desktop & Mobile Overlay */}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Backdrop for Mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/80 backdrop-blur-sm md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 md:pl-64">
        <TopBar onToggleSidebar={() => setSidebarOpen((prev) => !prev)} />
        <main className="flex-1 p-4 md:p-8 overflow-y-auto">
          <div className="max-w-7xl mx-auto space-y-6">
            <Outlet />
          </div>
        </main>
      </div>

      {/* Root Portal Modals */}
      <SessionReplacedModal
        isOpen={sessionReplacedOpen}
        onDismiss={() => {
          setSessionReplacedOpen(false);
          logout();
          navigate('/login', { replace: true });
        }}
      />

      <IdleTimeoutModal
        isOpen={isIdleWarnOpen}
        onStayLoggedIn={stayLoggedIn}
        onLogout={logout}
      />
    </div>
  );
};
