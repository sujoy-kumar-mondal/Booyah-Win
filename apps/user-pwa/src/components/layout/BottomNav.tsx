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
    { to: '/leaderboard', label: t('nav.ranks'), icon: BarChart2, testIdKey: 'rankings' },
    { to: '/wallet', label: t('nav.wallet'), icon: Wallet, testIdKey: 'wallet' },
    { to: '/profile', label: t('nav.account'), icon: User, testIdKey: 'profile' },
  ];

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800/80 bg-[#0d0e17]/95 backdrop-blur-md pb-safe"
    >
      <div className="mx-auto grid w-full max-w-md grid-cols-5 items-center px-1 py-1.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className="flex w-full flex-col items-center justify-center py-0.5 select-none"
            >
              {({ isActive }) => {
                const active = isRouteActive(item.to, isActive);
                return (
                  <>
                    <div
                      className={`h-8 w-14 flex items-center justify-center rounded-full transition-colors duration-150 ${
                        active
                          ? 'bg-violet-600 text-white shadow-md shadow-violet-600/30'
                          : 'bg-transparent text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
                    </div>
                    <span
                      className={`mt-0.5 block w-full text-center text-[10.5px] leading-tight tracking-tight truncate ${
                        active ? 'font-bold text-slate-100' : 'font-medium text-slate-400'
                      }`}
                    >
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
