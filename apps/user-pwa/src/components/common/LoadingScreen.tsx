import React from 'react';

export const LoadingScreen: React.FC<{ message?: string }> = ({ message = 'Loading Booyah Win...' }) => {
  return (
    <div
      data-testid="loading-screen"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-950 text-slate-100"
    >
      <div className="relative mb-6 flex items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-slate-800 border-t-emerald-500" />
        <span className="absolute font-black text-xs text-emerald-400 tracking-wider">BW</span>
      </div>
      <p className="text-sm font-medium text-slate-400 animate-pulse">{message}</p>
    </div>
  );
};
