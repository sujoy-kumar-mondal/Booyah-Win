/**
 * Screenshot Viewer Modal
 *
 * Requirements:
 * - Requirement 7: Refetch fresh signed URL each time it opens
 * - referrerpolicy="no-referrer"
 * - Clear message when the URL has expired or fails to load
 * - Never put the URL in the address bar or router state
 * - Requirement 11: Never log screenshot URLs
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X, RefreshCw, AlertTriangle, Image as ImageIcon, Loader2 } from 'lucide-react';

interface ScreenshotViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  depositId: string;
  initialUrl: string;
  onFetchFreshUrl?: (depositId: string) => Promise<string | null>;
}

export const ScreenshotViewerModal: React.FC<ScreenshotViewerModalProps> = ({
  isOpen,
  onClose,
  depositId,
  initialUrl,
  onFetchFreshUrl,
}) => {
  const [currentUrl, setCurrentUrl] = useState<string>(initialUrl);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Requirement 7: Refetch fresh signed URL each time it opens
  useEffect(() => {
    if (!isOpen) return;

    let isMounted = true;
    setHasError(false);
    setCurrentUrl(initialUrl);

    if (onFetchFreshUrl && depositId) {
      setIsRefreshing(true);
      onFetchFreshUrl(depositId)
        .then((freshUrl) => {
          if (isMounted && freshUrl) {
            setCurrentUrl(freshUrl);
          }
        })
        .catch(() => {
          // If refresh fails, fall back to initial
        })
        .finally(() => {
          if (isMounted) setIsRefreshing(false);
        });
    }

    return () => {
      isMounted = false;
    };
  }, [isOpen, depositId, initialUrl, onFetchFreshUrl]);

  if (!isOpen) return null;

  const handleManualRefresh = async () => {
    if (!onFetchFreshUrl || !depositId) return;
    setIsRefreshing(true);
    setHasError(false);
    try {
      const freshUrl = await onFetchFreshUrl(depositId);
      if (freshUrl) {
        setCurrentUrl(freshUrl);
      }
    } catch {
      setHasError(true);
    } finally {
      setIsRefreshing(false);
    }
  };

  const modalRoot = document.getElementById('modal-root') || document.body;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      data-testid="screenshot-viewer-modal"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex flex-col max-h-[90vh] w-full max-w-2xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ImageIcon className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-slate-100">
              Payment Screenshot <span className="text-slate-400 font-mono text-xs">(Deposit #{depositId})</span>
            </h3>
          </div>
          <div className="flex items-center gap-2">
            {onFetchFreshUrl && (
              <button
                type="button"
                onClick={handleManualRefresh}
                disabled={isRefreshing}
                data-testid="refresh-screenshot-btn"
                className="flex items-center gap-1 rounded-lg border border-slate-700 bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
              >
                <RefreshCw className={`h-3 w-3 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span>Refresh URL</span>
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              data-testid="close-screenshot-btn"
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200"
              aria-label="Close Screenshot Viewer"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-950/60 min-h-[300px]">
          {isRefreshing ? (
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
              <span>Fetching fresh signed URL...</span>
            </div>
          ) : hasError ? (
            <div className="text-center p-6 space-y-3 max-w-md" data-testid="screenshot-expired-message">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-500/10 text-rose-400">
                <AlertTriangle className="h-6 w-6" />
              </div>
              <p className="text-xs text-slate-300 font-medium">
                This signed image URL has expired or could not be loaded securely.
              </p>
              <p className="text-[11px] text-slate-500">
                Signed URLs expire after a short duration. Click "Refresh URL" to request a fresh token.
              </p>
              <button
                type="button"
                onClick={handleManualRefresh}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3.5 py-2 text-xs font-semibold text-emerald-400 hover:bg-slate-700 border border-slate-700"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh URL Now
              </button>
            </div>
          ) : (
            <img
              src={currentUrl}
              alt="Payment Transaction Screenshot"
              referrerPolicy="no-referrer"
              data-testid="screenshot-image"
              className="max-h-[70vh] w-auto max-w-full rounded-xl object-contain shadow-md"
              onError={() => setHasError(true)}
            />
          )}
        </div>
      </div>
    </div>,
    modalRoot
  );
};
