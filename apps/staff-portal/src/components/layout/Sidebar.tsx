/**
 * Staff Portal Sidebar
 *
 * Requirements:
 * - Requirement 8: Employees do not see admin placeholder entries
 * - Admins additionally see placeholder entries clearly marked "coming soon"
 */

import React from 'react';
import { NavLink } from 'react-router-dom';
import { useStaffAuth } from '../../context/StaffAuthContext.js';
import {
  LayoutDashboard,
  ArrowDownToLine,
  ArrowUpRight,
  Swords,
  Trophy,
  Users,
  Layers,
  UserCheck,
  Settings,
  FileText,
  Shield,
} from 'lucide-react';

export const Sidebar: React.FC<{ isOpen?: boolean; onClose?: () => void }> = ({
  isOpen = false,
  onClose,
}) => {
  const { staff } = useStaffAuth();
  const isAdmin = staff?.role === 'admin';

  const baseNavItems = [
    { label: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { label: 'Matches', path: '/matches', icon: Swords },
    { label: 'Deposit Queue', path: '/deposits', icon: ArrowDownToLine },
    { label: 'Withdrawal Queue', path: '/withdrawals', icon: ArrowUpRight },
    { label: 'Users', path: '/users', icon: UserCheck },
  ];

  // Admin navigation items - Milestone 10c real pages
  const adminNavItems = [
    { label: 'Results Approval', path: '/results', icon: Trophy },
    { label: 'Employees', path: '/employees', icon: Users },
    { label: 'Entry Tiers', path: '/tiers', icon: Layers },
    { label: 'Settings', path: '/settings', icon: Settings },
    { label: 'Audit Logs', path: '/audit-logs', icon: FileText },
  ];

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 w-64 transform bg-slate-900 border-r border-slate-800 transition-transform duration-200 ease-in-out md:translate-x-0 ${
        isOpen ? 'translate-x-0' : '-translate-x-full'
      } flex flex-col`}
      data-testid="staff-sidebar"
    >
      {/* Brand Header */}
      <div className="flex h-16 items-center justify-between px-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-black">
            BW
          </div>
          <div>
            <h1 className="text-sm font-bold tracking-tight text-slate-100">Booyah Win</h1>
            <span className="text-[10px] font-medium text-emerald-400 uppercase tracking-wider block">
              Staff Portal
            </span>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-6">
        <div>
          <span className="px-3 text-[10px] font-bold uppercase tracking-wider text-slate-500">
            Operations
          </span>
          <nav className="mt-2 space-y-1">
            {baseNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={onClose}
                data-testid={`nav-${item.path.replace('/', '')}`}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/10'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`
                }
              >
                <item.icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Admin Placeholders (Requirement 8: Only rendered for Admin users) */}
        {isAdmin && (
          <div data-testid="admin-sidebar-section">
            <div className="flex items-center justify-between px-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-amber-400" />
                Administration
              </span>
            </div>
            <nav className="mt-2 space-y-1">
              {adminNavItems.map((item) => (
                <NavLink
                  key={item.path}
                  to={item.path}
                  onClick={onClose}
                  data-testid={`nav-${item.path.replace('/', '')}`}
                  className={({ isActive }) =>
                    `flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-emerald-500 text-slate-950 font-bold shadow-md shadow-emerald-500/10'
                        : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </nav>
          </div>
        )}
      </div>

      {/* Footer Role Badge */}
      <div className="p-4 border-t border-slate-800">
        <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 flex items-center justify-between">
          <div className="truncate">
            <p className="text-xs font-semibold text-slate-200 truncate" data-testid="sidebar-staff-name">
              {staff?.name}
            </p>
            <p className="text-[10px] text-slate-500 truncate">{staff?.email}</p>
          </div>
          <span
            className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider border ${
              isAdmin
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            }`}
            data-testid="sidebar-role-badge"
          >
            {staff?.role}
          </span>
        </div>
      </div>
    </aside>
  );
};
