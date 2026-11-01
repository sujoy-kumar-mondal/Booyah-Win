import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  BellRing,
  CheckCheck,
  ShieldAlert,
  ArrowDownLeft,
  ArrowUpRight,
  Trophy,
  XCircle,
  PlusCircle,
  Key,
  Zap,
  Clock,
  Check,
  X,
} from 'lucide-react';
import { apiClient } from '../../api/client.js';
import {
  isPushNotificationSupported,
  subscribeToStaffPushNotifications,
  playNotificationSound,
} from '../../utils/staffPushNotifications.js';

export interface StaffNotificationItem {
  id: string;
  targetRole: string;
  staffId: string | null;
  type: string;
  title: string;
  message: string;
  actionUrl: string | null;
  metadata: Record<string, any> | null;
  isRead: boolean;
  createdAt: string;
}

interface NotificationsApiResponse {
  items: StaffNotificationItem[];
  unreadCount: number;
}

function formatRelativeTime(dateStr: string): string {
  try {
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 30) return 'just now';
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
  } catch {
    return dateStr;
  }
}

function getNotificationIcon(type: string) {
  switch (type) {
    case 'deposit_submitted':
      return <ArrowDownLeft className="h-4 w-4 text-emerald-400" />;
    case 'deposit_verified':
      return <CheckCheck className="h-4 w-4 text-emerald-400" />;
    case 'withdrawal_submitted':
      return <ArrowUpRight className="h-4 w-4 text-amber-400" />;
    case 'withdrawal_verified':
      return <CheckCheck className="h-4 w-4 text-amber-400" />;
    case 'result_approval_required':
      return <ShieldAlert className="h-4 w-4 text-purple-400" />;
    case 'match_status_created':
      return <PlusCircle className="h-4 w-4 text-sky-400" />;
    case 'match_status_open_room':
      return <Key className="h-4 w-4 text-yellow-400" />;
    case 'match_status_live':
      return <Zap className="h-4 w-4 text-rose-400" />;
    case 'match_status_canceled':
      return <XCircle className="h-4 w-4 text-red-400" />;
    case 'match_status_completed':
      return <Trophy className="h-4 w-4 text-emerald-400" />;
    default:
      return <Bell className="h-4 w-4 text-indigo-400" />;
  }
}

export const StaffNotificationBell: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [pushStatus, setPushStatus] = useState<'default' | 'granted' | 'denied' | 'unsupported'>('default');
  const [isSubscribing, setIsSubscribing] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const prevUnreadRef = useRef<number | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isPushNotificationSupported()) {
      setPushStatus('unsupported');
    } else {
      setPushStatus(Notification.permission);
    }
  }, []);

  // Fetch notifications with 15s polling
  const { data, isLoading } = useQuery<NotificationsApiResponse>({
    queryKey: ['staff-notifications'],
    queryFn: async () => {
      const res = await apiClient.get<any>('/staff/notifications?limit=25');
      return res?.data || res;
    },
    refetchInterval: 15000,
  });

  const unreadCount = data?.unreadCount || 0;
  const items = data?.items || [];

  // Play audio chime when new unread notifications arrive
  useEffect(() => {
    if (prevUnreadRef.current !== null && unreadCount > prevUnreadRef.current) {
      playNotificationSound();
    }
    prevUnreadRef.current = unreadCount;
  }, [unreadCount]);

  // Click outside listener to close dropdown
  useEffect(() => {
    function handleClickOutside(e: MouseEvent | TouchEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      document.addEventListener('touchstart', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  // Mark single notification as read
  const markReadMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiClient.patch(`/staff/notifications/${id}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-notifications'] });
    },
  });

  // Mark all as read
  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post('/staff/notifications/mark-all-read');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff-notifications'] });
    },
  });

  const handleNotificationClick = async (item: StaffNotificationItem) => {
    if (!item.isRead) {
      markReadMutation.mutate(item.id);
    }
    setIsOpen(false);
    if (item.actionUrl) {
      navigate(item.actionUrl);
    }
  };

  const handleEnablePush = async () => {
    setIsSubscribing(true);
    try {
      const success = await subscribeToStaffPushNotifications();
      if (success) {
        setPushStatus('granted');
      } else if (typeof Notification !== 'undefined') {
        setPushStatus(Notification.permission);
      }
    } finally {
      setIsSubscribing(false);
    }
  };

  return (
    <div className="relative inline-block" ref={containerRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        data-testid="staff-notification-bell-btn"
        className="relative rounded-xl border border-slate-700/80 bg-slate-800/80 p-2 text-slate-300 hover:bg-slate-700/80 hover:text-white transition-colors"
        aria-label="Staff notifications"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span
            data-testid="staff-notification-unread-badge"
            className="absolute -top-1 -right-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-extrabold text-white shadow-lg animate-pulse"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-slate-950/60 backdrop-blur-xs sm:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Dropdown Panel */}
      {isOpen && (
        <div
          data-testid="staff-notification-dropdown"
          className="fixed inset-x-3 top-[68px] max-w-md mx-auto sm:static sm:inset-x-auto sm:top-auto sm:max-w-none sm:mx-0 sm:absolute sm:right-0 sm:top-full sm:mt-2 sm:w-96 rounded-2xl border border-slate-700/80 bg-slate-900 shadow-2xl backdrop-blur-xl z-50 overflow-hidden max-h-[calc(100vh-5.5rem)] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 bg-slate-950/60 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                Staff Alerts
              </span>
              {unreadCount > 0 && (
                <span className="rounded-full bg-rose-500/20 px-2 py-0.5 text-[10px] font-bold text-rose-400 border border-rose-500/30">
                  {unreadCount} new
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              {unreadCount > 0 && (
                <button
                  type="button"
                  onClick={() => markAllReadMutation.mutate()}
                  disabled={markAllReadMutation.isPending}
                  data-testid="staff-notification-mark-all-btn"
                  className="flex items-center gap-1 text-[11px] font-semibold text-sky-400 hover:text-sky-300 disabled:opacity-50 transition-colors"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  <span>Mark all read</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
                aria-label="Close notifications"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Web Push Prompt Banner */}
          {pushStatus === 'default' && (
            <div className="flex items-center justify-between bg-sky-950/40 border-b border-sky-800/40 px-4 py-2.5 shrink-0">
              <div className="flex items-center gap-2">
                <BellRing className="h-3.5 w-3.5 text-sky-400 shrink-0" />
                <span className="text-[11px] text-sky-200">Get instant browser alerts</span>
              </div>
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={isSubscribing}
                data-testid="staff-enable-push-btn"
                className="rounded-lg bg-sky-500/20 border border-sky-400/40 px-2.5 py-1 text-[11px] font-bold text-sky-300 hover:bg-sky-500/30 transition-all"
              >
                {isSubscribing ? 'Enabling...' : 'Enable'}
              </button>
            </div>
          )}

          {pushStatus === 'granted' && (
            <div className="flex items-center gap-1.5 bg-emerald-950/20 border-b border-emerald-800/30 px-4 py-1.5 text-[10px] text-emerald-400 shrink-0">
              <Check className="h-3 w-3" />
              <span>Browser Push Notifications Active</span>
            </div>
          )}

          {pushStatus === 'denied' && (
            <div className="bg-amber-950/30 border-b border-amber-800/40 px-4 py-2 text-[10px] text-amber-300 leading-normal shrink-0">
              Browser alerts are blocked. Click the lock/settings icon in your browser URL bar to allow notifications for this site.
            </div>
          )}

          {/* Notification Items List */}
          <div className="flex-1 overflow-y-auto divide-y divide-slate-800/60 sm:max-h-96 min-h-0">
            {isLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading notifications...</div>
            ) : items.length === 0 ? (
              <div className="p-8 text-center text-slate-400">
                <Bell className="mx-auto h-8 w-8 text-slate-600 mb-2 opacity-50" />
                <p className="text-xs font-semibold text-slate-300">No notifications yet</p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  You will be notified when new deposits, withdrawals, or match events arrive.
                </p>
              </div>
            ) : (
              items.map((item) => (
                <div
                  key={item.id}
                  onClick={() => handleNotificationClick(item)}
                  data-testid="staff-notification-item"
                  className={`flex items-start gap-3 p-3.5 cursor-pointer transition-colors ${
                    item.isRead
                      ? 'bg-slate-900/40 hover:bg-slate-800/40 opacity-75'
                      : 'bg-slate-800/70 hover:bg-slate-800 border-l-2 border-sky-400'
                  }`}
                >
                  <div className="mt-0.5 shrink-0 rounded-lg bg-slate-950/80 p-1.5 border border-slate-700/60">
                    {getNotificationIcon(item.type)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-xs font-semibold truncate ${item.isRead ? 'text-slate-300' : 'text-white'}`}>
                        {item.title}
                      </p>
                      <span className="flex items-center gap-1 text-[10px] text-slate-400 shrink-0">
                        <Clock className="h-2.5 w-2.5" />
                        {formatRelativeTime(item.createdAt)}
                      </span>
                    </div>

                    <p className="mt-0.5 text-[11px] text-slate-300 line-clamp-2 leading-relaxed">
                      {item.message}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

