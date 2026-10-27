import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Trophy, BarChart2, Wallet, User } from 'lucide-react';
import { useTranslation } from '../../i18n/LanguageContext.js';

export const BottomNav: React.FC = () => {
  const location = useLocation();
  const { t } = useTranslation();

  const isRouteActive = (itemTo: string, isNavActive: boolean) => {
    if (itemTo === '/profile') {
      return isNavActive || location.pathname === '/referral' || location.pathname.startsWith('/profile');
    }
    return isNavActive;
  };

  const navItems = [
    { to: '/', label: t('nav.home'), icon: Home, testIdKey: 'home' },
    {
      to: '/matches',
      label: t('nav.matches'),
      icon: Trophy,
      testIdKey: 'matches',
    },
    { to: '/leaderboard', label: t('nav.leaderboard'), icon: BarChart2, testIdKey: 'rankings' },
    { to: '/wallet', label: t('nav.wallet'), icon: Wallet, testIdKey: 'wallet' },
    { to: '/profile', label: t('nav.profile'), icon: User, testIdKey: 'profile' },
  ];

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800/80 bg-[#0d0e17]/95 backdrop-blur-md pb-safe"
    >
      <div className="mx-auto flex max-w-md items-center justify-around px-2 py-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => {
                const active = isRouteActive(item.to, isActive);
                return `relative flex flex-col items-center justify-center py-0.5 px-2 text-[11px] font-semibold transition-all ${
                  active ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`;
              }}
            >
              {({ isActive }) => {
                const active = isRouteActive(item.to, isActive);
                return (
                  <>
                    <div
                      className={`flex items-center justify-center transition-all duration-200 ${
                        active
                          ? 'h-8 px-4 rounded-full bg-violet-600 text-white shadow-md shadow-violet-600/30'
                          : 'h-7 w-7 text-slate-400'
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
                    </div>
                    <span className={`mt-0.5 tracking-tight ${active ? 'font-bold text-slate-100' : 'text-slate-400'}`}>
                      {item.label}
                    </span>
                  </>
                );
              }}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
