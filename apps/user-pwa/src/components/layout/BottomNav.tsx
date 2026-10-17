import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Home, Swords, Trophy, Wallet, User } from 'lucide-react';
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
    { to: '/', label: t('nav.home'), icon: Home, badge: null, testIdKey: 'home' },
    {
      to: '/matches',
      label: t('nav.matches'),
      icon: Swords,
      badge: null,
      isAlertBadge: false,
      testIdKey: 'matches',
    },
    { to: '/leaderboard', label: t('nav.leaderboard'), icon: Trophy, badge: null, testIdKey: 'rankings' },
    { to: '/wallet', label: t('nav.wallet'), icon: Wallet, badge: null, testIdKey: 'wallet' },
    { to: '/profile', label: t('nav.profile'), icon: User, badge: null, testIdKey: 'profile' },
  ];

  return (
    <nav
      data-testid="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-30 border-t border-slate-800 bg-slate-950/90 backdrop-blur-md pb-safe"
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
                return `relative flex flex-col items-center justify-center py-1 px-3 text-xs font-medium transition-all ${
                  active ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`;
              }}
            >
              {({ isActive }) => {
                const active = isRouteActive(item.to, isActive);
                return (
                  <>
                    <div className="relative">
                      <Icon className={`h-5 w-5 ${active ? 'stroke-[2.5]' : 'stroke-2'}`} />
                    {item.badge && (
                      <span
                        data-testid={`nav-badge-${item.testIdKey}`}
                        className={`absolute -top-1.5 -right-3 rounded-full px-1.5 py-0.2 text-[10px] font-bold ${
                          item.isAlertBadge
                            ? 'bg-emerald-500 text-slate-950 shadow-sm'
                            : 'bg-slate-800 text-slate-400 border border-slate-700'
                        }`}
                      >
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="mt-1">{item.label}</span>
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
