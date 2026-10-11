/**
 * Placeholder screen for Admin coming-soon modules
 */

import React from 'react';
import { Clock, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

interface ComingSoonProps {
  title: string;
  description: string;
}

export const ComingSoon: React.FC<ComingSoonProps> = ({ title, description }) => {
  return (
    <div
      className="flex min-h-[450px] flex-col items-center justify-center rounded-2xl border border-slate-800 bg-slate-900/60 p-8 text-center shadow-xl space-y-4"
      data-testid="coming-soon-screen"
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-400 border border-amber-500/20">
        <Clock className="h-7 w-7" />
      </div>
      <div>
        <h2 className="text-lg font-bold text-slate-100">{title}</h2>
        <p className="mt-1 text-xs text-slate-400 max-w-md">{description}</p>
      </div>
      <span className="rounded-full bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-400 border border-amber-500/30">
        Scheduled for Next Milestone
      </span>
      <div className="pt-2">
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
};
