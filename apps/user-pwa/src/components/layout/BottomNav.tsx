import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Swords, Wallet, User } from 'lucide-react';

export const BottomNav: React.FC = () => {
  const navItems = [
    { to: '/', label: 'Home', icon: Home },
    { to: '/matches', label: 'Matches', icon: Swords, badge: 'Soon' },
    { to: '/wallet', label: 'Wallet', icon: Wallet, badge: 'Soon' },
    { to: '/profile', label: 'Profile', icon: User },
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
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center py-1 px-3 text-xs font-medium transition-all ${
                  isActive ? 'text-emerald-400 font-bold' : 'text-slate-400 hover:text-slate-200'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <div className="relative">
                    <Icon className={`h-5 w-5 ${isActive ? 'stroke-[2.5]' : 'stroke-2'}`} />
                    {item.badge && (
                      <span className="absolute -top-1.5 -right-3 rounded-full bg-slate-800 px-1 text-[9px] font-semibold text-slate-400 border border-slate-700">
                        {item.badge}
                      </span>
                    )}
                  </div>
                  <span className="mt-1">{item.label}</span>
                </>
              )}
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
};
