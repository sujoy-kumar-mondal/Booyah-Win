/**
 * Idle Timeout Warning Modal (Root-level portal)
 *
 * Requirements:
 * - Requirement 10: Warn after 25 minutes without activity and log out at 30
 * - Allows staff to click "Stay Logged In" or "Log Out"
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Clock, CheckCircle2, LogOut } from 'lucide-react';

interface IdleTimeoutModalProps {
  isOpen: boolean;
  onStayLoggedIn: () => void;
  onLogout: () => void;
}

export const IdleTimeoutModal: React.FC<IdleTimeoutModalProps> = ({
  isOpen,
  onStayLoggedIn,
  onLogout,
}) => {
  const stayBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const rootEl = document.getElementById('root');
    if (!rootEl) return;

    if (isOpen) {
      rootEl.setAttribute('inert', '');
      const timer = setTimeout(() => {
        stayBtnRef.current?.focus();
      }, 50);
      return () => {
        clearTimeout(timer);
        rootEl.removeAttribute('inert');
      };
    } else {
      rootEl.removeAttribute('inert');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modalRoot = document.getElementById('modal-root') || document.body;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in"
      data-testid="idle-timeout-dialog"
      role="dialog"
      aria-modal="true"
      aria-labelledby="idle-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
          <Clock className="h-6 w-6" />
        </div>
        <div>
          <h2 id="idle-dialog-title" className="text-lg font-bold text-slate-100">
            Session Idle Warning
          </h2>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed" data-testid="idle-dialog-message">
            You have been inactive for 25 minutes. For security, your session will automatically end in 5 minutes unless you continue.
          </p>
        </div>
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onLogout}
            data-testid="idle-logout-btn"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log Out Now
          </button>
          <button
            ref={stayBtnRef}
            type="button"
            onClick={onStayLoggedIn}
            data-testid="idle-stay-btn"
            className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500 py-2.5 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-all active:scale-[0.98]"
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            Stay Logged In
          </button>
        </div>
      </div>
    </div>,
    modalRoot
  );
};
