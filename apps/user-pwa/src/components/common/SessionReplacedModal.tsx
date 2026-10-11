import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext.js';
import { Smartphone, LogIn } from 'lucide-react';

export const SessionReplacedModal: React.FC = () => {
  const { sessionReplacedOpen, sessionDialogMessage, sessionDialogTitle, dismissSessionReplaced } = useAuth();
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const rootEl = typeof document !== 'undefined' ? document.getElementById('root') : null;
    if (!rootEl) return;

    if (sessionReplacedOpen) {
      rootEl.setAttribute('inert', '');
      // Auto-focus primary action button in dialog
      setTimeout(() => {
        buttonRef.current?.focus();
      }, 0);
    } else {
      rootEl.removeAttribute('inert');
    }

    return () => {
      rootEl.removeAttribute('inert');
    };
  }, [sessionReplacedOpen]);

  if (!sessionReplacedOpen) return null;

  const modalRoot =
    (typeof document !== 'undefined' && document.getElementById('modal-root')) ||
    (typeof document !== 'undefined' ? document.body : null);

  if (!modalRoot) return null;

  const content = (
    <div
      role="dialog"
      aria-modal="true"
      data-testid="session-replaced-modal"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
    >
      <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
          <Smartphone className="h-7 w-7" />
        </div>
        <h3 className="mb-2 text-lg font-bold text-slate-100" data-testid="session-dialog-title">
          {sessionDialogTitle || 'Session Expired'}
        </h3>
        <p className="mb-6 text-sm text-slate-400 leading-relaxed" data-testid="session-dialog-message">
          {sessionDialogMessage || 'You were logged out because your account was used on another device.'}
        </p>
        <button
          ref={buttonRef}
          onClick={dismissSessionReplaced}
          data-testid="session-dialog-dismiss-btn"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98]"
        >
          <LogIn className="h-4 w-4" />
          Log In Again
        </button>
      </div>
    </div>
  );

  return createPortal(content, modalRoot);
};
