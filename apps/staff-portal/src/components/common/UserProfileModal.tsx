/**
 * User Profile Modal
 *
 * Allows staff (employees and admins) to view detailed player profiles
 * directly from the Deposits and Withdrawals queues.
 */

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  X,
  User,
  ShieldAlert,
  Wallet,
  Phone,
  Mail,
  Gamepad2,
  CreditCard,
  ExternalLink,
  Copy,
  Check,
  Loader2,
  AlertTriangle,
} from 'lucide-react';
import { getAdminUserDetail } from '../../api/admin.js';
import { getStaffUserDetail } from '../../api/staffUsers.js';
import { useStaffAuth } from '../../context/StaffAuthContext.js';
import { formatIndianRupees, formatISTDate } from '../../utils/formatters.js';
import { getFriendlyErrorMessage } from '../../utils/errors.js';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string | null;
  initialUserName?: string;
  initialUserEmail?: string;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  userId,
  initialUserName,
  initialUserEmail,
}) => {
  const navigate = useNavigate();
  const { staff } = useStaffAuth();
  const isAdmin = !staff || staff.role === 'admin';

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !userId) {
      setData(null);
      setError(null);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchDetail = async () => {
      try {
        const res = isAdmin
          ? await getAdminUserDetail(userId)
          : await getStaffUserDetail(userId);
        if (isMounted) {
          setData(res);
        }
      } catch (err: any) {
        if (isMounted) {
          setError(getFriendlyErrorMessage(err, 'user'));
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDetail();

    return () => {
      isMounted = false;
    };
  }, [isOpen, userId, isAdmin]);

  if (!isOpen || !userId) return null;

  const handleCopy = (text: string, key: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const profile = data?.profile;
  const wallets = data?.wallets;

  const displayName = profile?.name || initialUserName || initialUserEmail || `User #${userId}`;
  const displayEmail = profile?.email || initialUserEmail;

  const handleNavigateToUsers = () => {
    onClose();
    const query = displayEmail || displayName || userId;
    navigate(`/users?search=${encodeURIComponent(query)}`);
  };

  const modalRoot = document.getElementById('modal-root') || document.body;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in"
      data-testid="user-profile-modal"
      role="dialog"
      aria-modal="true"
    >
      <div className="relative flex flex-col max-h-[90vh] w-full max-w-xl rounded-2xl border border-slate-800 bg-slate-900 shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <User className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <span>Player Profile</span>
                <span className="text-slate-400 font-mono text-xs font-normal">#{userId}</span>
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            data-testid="close-user-profile-btn"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
            aria-label="Close Profile Modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {loading ? (
            <div className="py-12 flex flex-col items-center justify-center gap-2 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin text-emerald-400" />
              <span className="text-xs font-medium">Loading player details...</span>
            </div>
          ) : error ? (
            <div
              className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 text-xs text-rose-400 flex items-start gap-2.5"
              data-testid="user-profile-error"
            >
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Unable to load player profile</p>
                <p className="text-[11px] text-rose-400/90 mt-0.5">{error}</p>
              </div>
            </div>
          ) : profile ? (
            <>
              {/* Primary Identity Hero */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-gradient-to-tr from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-bold text-lg uppercase shadow-inner">
                    {profile.name ? profile.name.charAt(0) : 'U'}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h4 className="text-base font-bold text-slate-100">{profile.name}</h4>
                      {profile.isDeleted ? (
                        <span className="rounded bg-rose-500/20 px-1.5 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30">
                          Terminated
                        </span>
                      ) : (
                        <span className="rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
                          Active Player
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400 mt-1">
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3 text-slate-500" />
                        {profile.email}
                      </span>
                      <span className="flex items-center gap-1 font-mono">
                        <Phone className="h-3 w-3 text-slate-500" />
                        {profile.mobile}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {profile.isDeleted && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300 space-y-1">
                  <div className="font-semibold flex items-center gap-1.5 text-rose-200">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    Account Deleted / Terminated
                  </div>
                  <div className="text-[11px] text-rose-400">
                    Reason: {profile.deletedReason || 'Unspecified'}
                  </div>
                  {profile.deletedAt && (
                    <div className="text-[10px] text-rose-400/80">
                      Deleted on: {formatISTDate(profile.deletedAt)}
                    </div>
                  )}
                </div>
              )}

              {/* Free Fire & UPI Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                {/* Free Fire Card */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider text-slate-400">
                      <Gamepad2 className="h-3.5 w-3.5 text-amber-400" />
                      Free Fire Account
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopy(profile.ffId, 'ffId')}
                      className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                    >
                      {copiedKey === 'ffId' ? (
                        <Check className="h-3 w-3 text-emerald-400" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                      <span>{copiedKey === 'ffId' ? 'Copied' : 'Copy UID'}</span>
                    </button>
                  </div>
                  <div className="flex items-baseline justify-between pt-0.5">
                    <span className="text-slate-200 font-bold text-sm truncate max-w-[150px]">
                      {profile.ffName}
                    </span>
                    <span className="font-mono text-xs text-amber-400/90 bg-amber-400/10 px-1.5 py-0.5 rounded border border-amber-400/20 select-all">
                      {profile.ffId}
                    </span>
                  </div>
                </div>

                {/* UPI Card */}
                <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-3 space-y-1.5">
                  <div className="flex items-center justify-between text-slate-400">
                    <span className="flex items-center gap-1.5 font-semibold text-[11px] uppercase tracking-wider text-slate-400">
                      <CreditCard className="h-3.5 w-3.5 text-cyan-400" />
                      Default UPI ID
                    </span>
                    {profile.upiId && (
                      <button
                        type="button"
                        onClick={() => handleCopy(profile.upiId, 'upiId')}
                        className="text-[10px] text-slate-500 hover:text-slate-300 flex items-center gap-1"
                      >
                        {copiedKey === 'upiId' ? (
                          <Check className="h-3 w-3 text-emerald-400" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                        <span>{copiedKey === 'upiId' ? 'Copied' : 'Copy'}</span>
                      </button>
                    )}
                  </div>
                  <div className="pt-0.5">
                    <span className="font-mono text-xs text-slate-200 font-semibold select-all">
                      {profile.upiId || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Wallets Breakdown */}
              {wallets && (
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3.5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-semibold text-xs text-slate-300">
                      <Wallet className="h-3.5 w-3.5 text-emerald-400" />
                      Current Wallet Balances
                    </span>
                    <span className="text-xs font-bold text-emerald-400">
                      Total: {formatIndianRupees(wallets.total)}
                    </span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-slate-900 border border-slate-800/80 p-2">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Add Money</span>
                      <span className="font-semibold text-slate-200 mt-0.5 block">
                        {formatIndianRupees(wallets.addMoney)}
                      </span>
                    </div>
                    <div className="rounded-lg bg-slate-900 border border-slate-800/80 p-2">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Cashback</span>
                      <span className="font-semibold text-slate-200 mt-0.5 block">
                        {formatIndianRupees(wallets.cashback)}
                      </span>
                    </div>
                    <div className="rounded-lg bg-slate-900 border border-slate-800/80 p-2">
                      <span className="text-[10px] text-slate-400 uppercase font-semibold block">Winnings</span>
                      <span className="font-semibold text-emerald-400 mt-0.5 block">
                        {formatIndianRupees(wallets.winning)}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Meta information row */}
              <div className="grid grid-cols-2 gap-2 text-[11px] border-t border-slate-800/80 pt-3 text-slate-400">
                <div>
                  <span className="text-slate-500 font-medium block">Member Since</span>
                  <span className="text-slate-300 font-medium">
                    {profile.createdAt ? formatISTDate(profile.createdAt) : '—'}
                  </span>
                </div>
                {profile.dateOfBirth && (
                  <div>
                    <span className="text-slate-500 font-medium block">Date of Birth</span>
                    <span className="text-slate-300 font-medium">{profile.dateOfBirth}</span>
                  </div>
                )}
                {profile.referralCode && (
                  <div>
                    <span className="text-slate-500 font-medium block">Referral Code</span>
                    <span className="font-mono text-slate-300">{profile.referralCode}</span>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              No profile found for user #{userId}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-800 bg-slate-950/40">
          <button
            type="button"
            onClick={handleNavigateToUsers}
            data-testid="view-in-users-dir-btn"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            <span>Open in Users Directory</span>
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>,
    modalRoot
  );
};
