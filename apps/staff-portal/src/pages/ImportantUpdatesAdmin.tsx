/**
 * Important Updates Management Page (Admin Only)
 * Allows administrators to add, edit, and delete announcements/updates with optional content links.
 */

import React, { useState, useEffect } from 'react';
import {
  getAdminUpdates,
  createAdminUpdate,
  updateAdminUpdate,
  deleteAdminUpdate,
  ImportantUpdateDto,
  UpdatePointDto,
} from '../api/admin.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import {
  Megaphone,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Sparkles,
  ListPlus,
  Link as LinkIcon,
} from 'lucide-react';

export const ImportantUpdatesAdmin: React.FC = () => {
  const [updates, setUpdates] = useState<ImportantUpdateDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingUpdate, setEditingUpdate] = useState<ImportantUpdateDto | null>(null);
  const [deletingUpdate, setDeletingUpdate] = useState<ImportantUpdateDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for Add / Edit
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('Announcement');
  const [formDateDisplay, setFormDateDisplay] = useState('');
  const [formHeading, setFormHeading] = useState('');
  const [formSummary, setFormSummary] = useState('');
  const [formNotice, setFormNotice] = useState('');
  const [formLinkUrl, setFormLinkUrl] = useState('');
  const [formLinkText, setFormLinkText] = useState('');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [formIsActive, setFormIsActive] = useState(true);
  const [formPoints, setFormPoints] = useState<UpdatePointDto[]>([
    { label: '', text: '' },
  ]);

  const fetchUpdates = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAdminUpdates();
      setUpdates(data);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUpdates();
  }, []);

  const handleOpenAdd = () => {
    setFormTitle('');
    setFormCategory('Announcement');
    const now = new Date();
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    setFormDateDisplay(`${now.getDate()} ${months[now.getMonth()]}`);
    setFormHeading('');
    setFormSummary('');
    setFormNotice('');
    setFormLinkUrl('');
    setFormLinkText('');
    setFormSortOrder(String(updates.length + 1));
    setFormIsActive(true);
    setFormPoints([{ label: '', text: '' }]);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (item: ImportantUpdateDto) => {
    setEditingUpdate(item);
    setFormTitle(item.title);
    setFormCategory(item.category || 'Announcement');
    setFormDateDisplay(item.dateDisplay);
    setFormHeading(item.heading);
    setFormSummary(item.summary || '');
    setFormNotice(item.notice || '');
    setFormLinkUrl(item.linkUrl || '');
    setFormLinkText(item.linkText || '');
    setFormSortOrder(String(item.sortOrder));
    setFormIsActive(item.isActive);
    setFormPoints(
      item.points && item.points.length > 0
        ? [...item.points]
        : [{ label: '', text: '' }]
    );
  };

  const handleAddPoint = () => {
    setFormPoints((prev) => [...prev, { label: '', text: '' }]);
  };

  const handleRemovePoint = (index: number) => {
    setFormPoints((prev) => prev.filter((_, i) => i !== index));
  };

  const handlePointChange = (
    index: number,
    field: 'label' | 'text',
    value: string
  ) => {
    setFormPoints((prev) =>
      prev.map((p, i) => (i === index ? { ...p, [field]: value } : p))
    );
  };

  const handleCreateUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      setError('Title is required.');
      return;
    }
    if (!formHeading.trim()) {
      setError('Heading is required.');
      return;
    }
    if (!formDateDisplay.trim()) {
      setError('Date display label is required.');
      return;
    }

    const filteredPoints = formPoints.filter(
      (p) => p.label.trim() || p.text.trim()
    );

    try {
      setIsSubmitting(true);
      setError(null);

      await createAdminUpdate({
        title: formTitle.trim(),
        category: formCategory.trim() || 'Announcement',
        dateDisplay: formDateDisplay.trim(),
        heading: formHeading.trim(),
        summary: formSummary.trim() || undefined,
        notice: formNotice.trim() || undefined,
        linkUrl: formLinkUrl.trim() || undefined,
        linkText: formLinkText.trim() || undefined,
        sortOrder: parseInt(formSortOrder, 10) || 0,
        isActive: formIsActive,
        points: filteredPoints,
      });

      setSuccessMessage('Important update created successfully!');
      setIsAddOpen(false);
      await fetchUpdates();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUpdate) return;
    if (!formTitle.trim()) {
      setError('Title is required.');
      return;
    }
    if (!formHeading.trim()) {
      setError('Heading is required.');
      return;
    }
    if (!formDateDisplay.trim()) {
      setError('Date display label is required.');
      return;
    }

    const filteredPoints = formPoints.filter(
      (p) => p.label.trim() || p.text.trim()
    );

    try {
      setIsSubmitting(true);
      setError(null);

      await updateAdminUpdate(editingUpdate.id, {
        title: formTitle.trim(),
        category: formCategory.trim() || 'Announcement',
        dateDisplay: formDateDisplay.trim(),
        heading: formHeading.trim(),
        summary: formSummary.trim() || undefined,
        notice: formNotice.trim() || undefined,
        linkUrl: formLinkUrl.trim() || undefined,
        linkText: formLinkText.trim() || undefined,
        sortOrder: parseInt(formSortOrder, 10) || 0,
        isActive: formIsActive,
        points: filteredPoints,
      });

      setSuccessMessage('Important update modified successfully!');
      setEditingUpdate(null);
      await fetchUpdates();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (item: ImportantUpdateDto) => {
    try {
      setError(null);
      await updateAdminUpdate(item.id, {
        isActive: !item.isActive,
      });
      setSuccessMessage(
        `Update "${item.title}" is now ${!item.isActive ? 'active' : 'inactive'}.`
      );
      await fetchUpdates();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    }
  };

  const handleDeleteUpdate = async () => {
    if (!deletingUpdate) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await deleteAdminUpdate(deletingUpdate.id);
      setSuccessMessage('Important update deleted successfully from database.');
      setDeletingUpdate(null);
      await fetchUpdates();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="important-updates-admin-page">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
            <Megaphone className="h-6 w-6 text-emerald-400" />
            Important Updates Management
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Publish tournament announcements, headshot rules, weapon restrictions, and content links shown to players.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchUpdates}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-700 text-xs font-semibold transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenAdd}
            data-testid="add-update-btn"
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add New Update
          </button>
        </div>
      </div>

      {/* Alerts */}
      {error && (
        <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-rose-400 hover:text-rose-200">
            Dismiss
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            onClick={() => setSuccessMessage(null)}
            className="text-emerald-400 hover:text-emerald-200"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Updates List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
          Loading updates...
        </div>
      ) : updates.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
            <Megaphone className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-200">No Important Updates Configured</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              Create an announcement or policy notice to display to players in their Important Updates section.
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
          >
            <Plus className="h-4 w-4" />
            Create First Update
          </button>
        </div>
      ) : (
        <div className="space-y-3.5">
          {updates.map((item) => (
            <div
              key={item.id}
              className={`p-4 sm:p-5 rounded-2xl border bg-slate-900 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition ${
                item.isActive
                  ? 'border-slate-800 hover:border-slate-700'
                  : 'border-slate-800/50 opacity-70 hover:opacity-100'
              }`}
            >
              <div className="flex items-start gap-4 min-w-0 flex-1">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-violet-600/15 border border-violet-500/25 text-violet-400">
                  <Megaphone className="h-5 w-5" />
                </div>

                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="text-sm font-bold text-slate-100 line-clamp-1">
                      {item.title}
                    </h3>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider ${
                        item.isActive
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                          : 'bg-slate-800 text-slate-400 border-slate-700'
                      }`}
                    >
                      {item.isActive ? 'Active' : 'Inactive'}
                    </span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-800 text-slate-400 border border-slate-700">
                      Order #{item.sortOrder}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-indigo-400">
                    {item.category} · {item.dateDisplay} —{' '}
                    <span className="text-slate-300 font-medium">{item.heading}</span>
                  </p>

                  {item.linkUrl && (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-mono mt-1">
                      <LinkIcon className="h-3 w-3 shrink-0" />
                      <a
                        href={item.linkUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:underline inline-flex items-center gap-1"
                      >
                        <span>{item.linkText ? `${item.linkText} → ` : ''}{item.linkUrl}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                  )}

                  {item.points && item.points.length > 0 && (
                    <p className="text-[11px] text-slate-500">
                      {item.points.length} rule {item.points.length === 1 ? 'point' : 'points'} configured
                    </p>
                  )}
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center justify-end gap-2 border-t sm:border-t-0 pt-2 sm:pt-0 border-slate-800">
                <button
                  onClick={() => handleToggleActive(item)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                    item.isActive
                      ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                      : 'text-emerald-400 hover:bg-emerald-500/10'
                  }`}
                  title={item.isActive ? 'Deactivate' : 'Activate'}
                >
                  {item.isActive ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Show</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleOpenEdit(item)}
                  className="p-2 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
                  title="Edit update"
                >
                  <Edit2 className="h-4 w-4" />
                </button>

                <button
                  onClick={() => setDeletingUpdate(item)}
                  className="p-2 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-500/10 transition"
                  title="Delete update"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Modal */}
      {(isAddOpen || editingUpdate) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-xl rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 animate-in fade-in duration-150 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                {editingUpdate ? 'Edit Important Update' : 'Add New Important Update'}
              </h2>
              <button
                onClick={() => {
                  setIsAddOpen(false);
                  setEditingUpdate(null);
                }}
                className="text-slate-500 hover:text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form
              onSubmit={editingUpdate ? handleUpdateUpdate : handleCreateUpdate}
              className="space-y-4 max-h-[75vh] overflow-y-auto pr-1"
            >
              {/* Title & Category */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Update Title *
                  </label>
                  <input
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="e.g. 🔥🚨 Important Update – Lone Wolf Mode"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Category
                  </label>
                  <input
                    type="text"
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    placeholder="Announcement"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Date Display & Heading */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Date Label *
                  </label>
                  <input
                    type="text"
                    required
                    value={formDateDisplay}
                    onChange={(e) => setFormDateDisplay(e.target.value)}
                    placeholder="e.g. 23 Jul"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div className="sm:col-span-2 space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Modal Heading *
                  </label>
                  <input
                    type="text"
                    required
                    value={formHeading}
                    onChange={(e) => setFormHeading(e.target.value)}
                    placeholder="e.g. Headshot-Only Mode Rules & Fair Play"
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Summary / Subtitle */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  Short Summary (Optional)
                </label>
                <input
                  type="text"
                  value={formSummary}
                  onChange={(e) => setFormSummary(e.target.value)}
                  placeholder="Brief preview of this update..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Dynamic Points Editor */}
              <div className="space-y-2.5 pt-1">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                    <ListPlus className="h-3.5 w-3.5 text-emerald-400" />
                    Content Rule Points ({formPoints.length})
                  </label>
                  <button
                    type="button"
                    onClick={handleAddPoint}
                    className="text-xs font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Point
                  </button>
                </div>

                <div className="space-y-2">
                  {formPoints.map((point, index) => (
                    <div
                      key={index}
                      className="p-3 rounded-xl border border-slate-800 bg-slate-950/80 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={point.label}
                          onChange={(e) =>
                            handlePointChange(index, 'label', e.target.value)
                          }
                          placeholder={`Point #${index + 1} Label (e.g. Headshot Requirement)`}
                          className="flex-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-emerald-400 font-bold focus:border-emerald-500 focus:outline-none"
                        />
                        {formPoints.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePoint(index)}
                            className="p-1 text-slate-500 hover:text-rose-400 transition"
                            title="Remove point"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <textarea
                        value={point.text}
                        onChange={(e) =>
                          handlePointChange(index, 'text', e.target.value)
                        }
                        rows={2}
                        placeholder="Detailed explanation of this rule point..."
                        className="w-full rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1.5 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Notice Banner */}
              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-300">
                  Highlight Notice / Warning (Optional)
                </label>
                <input
                  type="text"
                  value={formNotice}
                  onChange={(e) => setFormNotice(e.target.value)}
                  placeholder="e.g. Ensure your Free Fire game recording is enabled for dispute submission."
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Link Support in Update Content */}
              <div className="p-3.5 rounded-2xl border border-indigo-500/20 bg-indigo-950/20 space-y-3">
                <div className="flex items-center gap-2 text-indigo-300 font-bold text-xs">
                  <LinkIcon className="h-4 w-4" />
                  <span>Update Destination Link (Optional)</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Link URL
                    </label>
                    <input
                      type="text"
                      value={formLinkUrl}
                      onChange={(e) => setFormLinkUrl(e.target.value)}
                      placeholder="e.g. /matches or https://t.me/..."
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-semibold text-slate-300">
                      Link Button Label
                    </label>
                    <input
                      type="text"
                      value={formLinkText}
                      onChange={(e) => setFormLinkText(e.target.value)}
                      placeholder="e.g. Explore Matches / Join Telegram"
                      className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Sort Order & Is Active */}
              <div className="grid grid-cols-2 gap-4 items-center pt-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold text-slate-300">
                    Sort Order
                  </label>
                  <input
                    type="number"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(e.target.value)}
                    className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                  />
                </div>

                <div className="flex items-center gap-2 pt-5">
                  <input
                    type="checkbox"
                    id="isActiveCheckbox"
                    checked={formIsActive}
                    onChange={(e) => setFormIsActive(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-400"
                  />
                  <label
                    htmlFor="isActiveCheckbox"
                    className="text-xs font-semibold text-slate-300 select-none cursor-pointer"
                  >
                    Active (Visible to Players)
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsAddOpen(false);
                    setEditingUpdate(null);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95 disabled:opacity-50"
                >
                  {isSubmitting
                    ? 'Saving...'
                    : editingUpdate
                    ? 'Save Changes'
                    : 'Create Update'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingUpdate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="p-2.5 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <h3 className="text-sm font-bold text-slate-100">Delete Update from Database?</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Are you sure you want to permanently delete{' '}
              <span className="font-bold text-white">
                &ldquo;{deletingUpdate.title}&rdquo;
              </span>
              ? It will be immediately and permanently removed from the database and the player app. This action cannot be undone.
            </p>
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setDeletingUpdate(null)}
                className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200 transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteUpdate}
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs transition active:scale-95 disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Confirm Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
