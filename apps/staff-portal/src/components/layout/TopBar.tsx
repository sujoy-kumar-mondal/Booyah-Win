/**
 * Staff Portal Top Bar
 */

import React from 'react';
import { useStaffAuth } from '../../context/StaffAuthContext.js';
import { Menu, LogOut } from 'lucide-react';

export const TopBar: React.FC<{ onToggleSidebar?: () => void }> = ({ onToggleSidebar }) => {
  const { staff, logout } = useStaffAuth();
  const isAdmin = staff?.role === 'admin';

  return (
    <header className="sticky top-0 z-30 flex h-16 w-full items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 md:px-8 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onToggleSidebar}
          data-testid="sidebar-toggle-btn"
          className="rounded-lg p-2 text-slate-400 hover:bg-slate-800 hover:text-slate-200 md:hidden"
          aria-label="Toggle Navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="hidden sm:block">
          <span className="text-xs font-semibold text-slate-400">Operations Control Panel</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        {/* Role Pill */}
        <div className="flex items-center gap-2">
          <span className="hidden text-xs font-medium text-slate-300 sm:inline" data-testid="topbar-user-name">
            {staff?.name}
          </span>
          <span
            className={`rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
              isAdmin
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}
            data-testid="topbar-role-badge"
          >
            {staff?.role}
          </span>
        </div>

        {/* Logout Button */}
        <button
          type="button"
          onClick={() => logout()}
          data-testid="staff-logout-btn"
          className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition-all"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Log Out</span>
        </button>
      </div>
    </header>
  );
};
