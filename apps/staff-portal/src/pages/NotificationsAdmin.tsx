import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Bell,
  Send,
  Trash2,
  Users,
  User,
  Megaphone,
  AlertTriangle,
  Trophy,
  Loader2,
  CheckCircle2,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import {
  getAdminNotifications,
  createAdminNotification,
  deleteAdminNotification,
  CreateAdminNotificationInput,
} from '../api/admin.js';

export const NotificationsAdmin: React.FC = () => {
  const queryClient = useQueryClient();

  // Form State
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<'announcement' | 'tournament' | 'alert'>('announcement');
  const [target, setTarget] = useState<'all' | 'specific'>('all');
  const [targetIdentifier, setTargetIdentifier] = useState('');
  const [actionUrl, setActionUrl] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Fetch notifications
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['admin-notifications'],
    queryFn: () => getAdminNotifications(),
  });

  // Create notification mutation
  const createMutation = useMutation({
    mutationFn: (input: CreateAdminNotificationInput) => createAdminNotification(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
      setTitle('');
      setMessage('');
      setActionUrl('');
      setTargetIdentifier('');
      setTarget('all');
      setFormSuccess('Notification sent successfully!');
      setTimeout(() => setFormSuccess(null), 4000);
    },
    onError: (err: any) => {
      setFormError(err.message || 'Failed to send notification');
    },
  });

  // Delete notification mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteAdminNotification(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-notifications'] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const cleanTitle = title.trim();
    const cleanMessage = message.trim();

    if (!cleanTitle) {
      setFormError('Please enter a notification title');
      return;
    }
    if (!cleanMessage) {
      setFormError('Please enter a notification message');
      return;
    }

    const payload: CreateAdminNotificationInput = {
      title: cleanTitle,
      message: cleanMessage,
      type,
      target,
      actionUrl: actionUrl.trim() || undefined,
    };

    if (target === 'specific') {
      const cleanTarget = targetIdentifier.trim();
      if (!cleanTarget) {
        setFormError('Please enter a target User ID or Username');
        return;
      }
      if (/^\d+$/.test(cleanTarget)) {
        payload.targetUserId = cleanTarget;
      } else {
        payload.targetUsername = cleanTarget;
      }
    }

    createMutation.mutate(payload);
  };

  const getTypeBadge = (notifType: string) => {
    switch (notifType) {
      case 'alert':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="h-3 w-3" />
            Alert
          </span>
        );
      case 'tournament':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Trophy className="h-3 w-3" />
            Tournament
          </span>
        );
      case 'announcement':
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/10 text-purple-400 border border-purple-500/20">
            <Megaphone className="h-3 w-3" />
            Announcement
          </span>
        );
    }
  };

  return (
    <div className="space-y-6" data-testid="admin-notifications-page">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Bell className="h-6 w-6 text-indigo-400" />
            Notification Broadcasts
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Send real-time alerts & announcements to all players or targeted individual users.
          </p>
        </div>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isFetching}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 text-xs font-medium transition"
        >
          <RefreshCw className={`h-4 w-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Compose & Send Form */}
      <div className="rounded-2xl border border-slate-800 bg-[#0e1626] p-6 shadow-xl">
        <h2 className="text-base font-bold text-white mb-4 flex items-center gap-2">
          <Send className="h-4 w-4 text-emerald-400" />
          Compose New Notification
        </h2>

        {formError && (
          <div className="mb-4 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-400 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>{formError}</span>
          </div>
        )}

        {formSuccess && (
          <div className="mb-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs font-semibold text-emerald-400 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{formSuccess}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Title */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 🔥🚨 Weapon Restriction Announcement"
                data-testid="notification-title-input"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                required
              />
            </div>

            {/* Type */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Category / Type
              </label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as any)}
                data-testid="notification-type-select"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              >
                <option value="announcement">Announcement / General Notice</option>
                <option value="tournament">Tournament / Match Notice</option>
                <option value="alert">Alert / Critical Notice</option>
              </select>
            </div>
          </div>

          {/* Message */}
          <div>
            <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
              Message Body *
            </label>
            <textarea
              rows={3}
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Write the full notification message to be displayed in the player's inbox..."
              data-testid="notification-message-input"
              className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
              required
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Target Audience */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Target Audience
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setTarget('all')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    target === 'all'
                      ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300 font-bold'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Users className="h-3.5 w-3.5" />
                  All Players (Broadcast)
                </button>
                <button
                  type="button"
                  onClick={() => setTarget('specific')}
                  className={`flex-1 py-2 px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition ${
                    target === 'specific'
                      ? 'border-indigo-500 bg-indigo-600/20 text-indigo-300 font-bold'
                      : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <User className="h-3.5 w-3.5" />
                  Specific Player
                </button>
              </div>

              {target === 'specific' && (
                <div className="mt-2.5">
                  <input
                    type="text"
                    value={targetIdentifier}
                    onChange={(e) => setTargetIdentifier(e.target.value)}
                    placeholder="Enter User ID (e.g. 15) or Username"
                    data-testid="target-identifier-input"
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              )}
            </div>

            {/* Optional Action URL */}
            <div>
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider mb-1.5">
                Action URL / Deep Link (Optional)
              </label>
              <input
                type="text"
                value={actionUrl}
                onChange={(e) => setActionUrl(e.target.value)}
                placeholder="e.g. /matches or /wallet or /important-updates"
                data-testid="notification-action-url-input"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              disabled={createMutation.isPending}
              data-testid="send-notification-btn"
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-indigo-950/50 hover:bg-indigo-500 transition active:scale-95 disabled:opacity-50"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  Broadcast Notification
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Sent Notifications List */}
      <div className="rounded-2xl border border-slate-800 bg-[#0e1626] p-6 shadow-xl space-y-4">
        <h2 className="text-base font-bold text-white flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-indigo-400" />
            Sent Notifications History
          </span>
          <span className="text-xs font-medium text-slate-400 font-mono">
            Total: {data?.total || 0}
          </span>
        </h2>

        {isLoading ? (
          <div className="py-12 text-center text-slate-400">
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-indigo-400 mb-2" />
            <p className="text-xs">Loading notifications...</p>
          </div>
        ) : !data?.items || data.items.length === 0 ? (
          <div className="py-12 text-center text-slate-400 border border-dashed border-slate-800 rounded-xl">
            <Bell className="mx-auto h-8 w-8 text-slate-600 mb-2" />
            <p className="text-sm font-semibold text-slate-300">No notifications found</p>
            <p className="text-xs text-slate-500 mt-1">
              Automated notifications and admin broadcasts will appear here.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-3 px-3">Title & Message</th>
                  <th className="py-3 px-3">Type</th>
                  <th className="py-3 px-3">Target</th>
                  <th className="py-3 px-3">Action URL</th>
                  <th className="py-3 px-3">Sent Time</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {data.items.map((notif) => (
                  <tr key={notif.id} className="hover:bg-slate-900/50 transition">
                    <td className="py-3 px-3 max-w-sm">
                      <div className="font-bold text-slate-100">{notif.title}</div>
                      <div className="text-slate-400 line-clamp-2 mt-0.5">{notif.message}</div>
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {getTypeBadge(notif.type)}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      {notif.isBroadcast ? (
                        <span className="inline-flex items-center gap-1 text-emerald-400 font-semibold">
                          <Users className="h-3 w-3" />
                          All Players
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-slate-300 font-mono">
                          <User className="h-3 w-3 text-indigo-400" />
                          {notif.targetUsername || `User #${notif.userId}`}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-400">
                      {notif.actionUrl ? (
                        <span className="flex items-center gap-1 text-indigo-400">
                          <ExternalLink className="h-3 w-3" />
                          {notif.actionUrl}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap font-mono text-slate-400">
                      {new Date(notif.createdAt).toLocaleString('en-IN', {
                        timeZone: 'Asia/Kolkata',
                        dateStyle: 'medium',
                        timeStyle: 'short',
                      })}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap text-right">
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm('Delete this notification?')) {
                            deleteMutation.mutate(notif.id);
                          }
                        }}
                        data-testid={`delete-notification-btn-${notif.id}`}
                        className="p-1.5 text-slate-500 hover:text-rose-400 hover:bg-slate-800 rounded-lg transition"
                        title="Delete notification"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

