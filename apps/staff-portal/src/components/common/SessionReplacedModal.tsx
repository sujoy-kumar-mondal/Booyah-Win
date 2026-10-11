/**
 * Session Replaced Modal (Root-level portal)
 *
 * Requirements:
 * - Rendered in separate portal container (#modal-root) sibling of #root
 * - Applies inert ONLY to #root when open
 * - Auto-focuses the acknowledge button
 * - Replaces session when used on another device
 */

import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, LogIn } from 'lucide-react';

interface SessionReplacedModalProps {
  isOpen: boolean;
  onDismiss: () => void;
  message?: string;
}

export const SessionReplacedModal: React.FC<SessionReplacedModalProps> = ({
  isOpen,
  onDismiss,
  message = 'You were logged out because your account was used on another device.',
}) => {
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const rootEl = document.getElementById('root');
    if (!rootEl) return;

    if (isOpen) {
      rootEl.setAttribute('inert', '');
      const timer = setTimeout(() => {
        buttonRef.current?.focus();
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
      data-testid="session-dialog-container"
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-dialog-title"
    >
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl text-center space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div>
          <h2 id="session-dialog-title" className="text-lg font-bold text-slate-100">
            Session Terminated
          </h2>
          <p className="mt-2 text-sm text-slate-400 leading-relaxed" data-testid="session-dialog-message">
            {message}
          </p>
        </div>
        <button
          ref={buttonRef}
          type="button"
          onClick={onDismiss}
          data-testid="session-dialog-btn"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-slate-950 transition-all hover:bg-emerald-400 active:scale-[0.98]"
        >
          <LogIn className="h-4 w-4" />
          Log In Again
        </button>
      </div>
    </div>,
    modalRoot
  );
};
