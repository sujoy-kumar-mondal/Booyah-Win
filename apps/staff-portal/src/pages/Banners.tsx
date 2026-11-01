/**
 * Banners Management Page (Admin Only)
 * Allows administrators to add, change, and delete carousel banners and banner links.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  getAdminBanners,
  createAdminBanner,
  updateAdminBanner,
  deleteAdminBanner,
  BannerDto,
} from '../api/admin.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import {
  Image as ImageIcon,
  Plus,
  Edit2,
  Trash2,
  ExternalLink,
  Eye,
  EyeOff,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  Upload,
  Sparkles,
} from 'lucide-react';

export const Banners: React.FC = () => {
  const [banners, setBanners] = useState<BannerDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<BannerDto | null>(null);
  const [deletingBanner, setDeletingBanner] = useState<BannerDto | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form states for Add / Edit
  const [formTitle, setFormTitle] = useState('');
  const [formTargetUrl, setFormTargetUrl] = useState('/matches');
  const [formSortOrder, setFormSortOrder] = useState('0');
  const [formIsActive, setFormIsActive] = useState(true);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchBanners = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await getAdminBanners();
      setBanners(data);
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchBanners();
  }, []);

  const handleOpenAdd = () => {
    setFormTitle('');
    setFormTargetUrl('/matches');
    setFormSortOrder(String(banners.length + 1));
    setFormIsActive(true);
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsAddOpen(true);
  };

  const handleOpenEdit = (banner: BannerDto) => {
    setEditingBanner(banner);
    setFormTitle(banner.title || '');
    setFormTargetUrl(banner.targetUrl);
    setFormSortOrder(String(banner.sortOrder));
    setFormIsActive(banner.isActive);
    setSelectedFile(null);
    setPreviewUrl(banner.imageUrl);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Selected image exceeds maximum 2 MB limit');
      return;
    }

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleCreateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setError('Please select a banner image file.');
      return;
    }
    if (!formTargetUrl.trim()) {
      setError('Target URL is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const formData = new FormData();
      formData.append('image', selectedFile);
      formData.append('targetUrl', formTargetUrl.trim());
      formData.append('title', formTitle.trim());
      formData.append('sortOrder', formSortOrder);
      formData.append('isActive', String(formIsActive));

      await createAdminBanner(formData);
      setSuccessMessage('Banner created successfully!');
      setIsAddOpen(false);
      await fetchBanners();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateBanner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingBanner) return;
    if (!formTargetUrl.trim()) {
      setError('Target URL is required.');
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const formData = new FormData();
      if (selectedFile) {
        formData.append('image', selectedFile);
      }
      formData.append('targetUrl', formTargetUrl.trim());
      formData.append('title', formTitle.trim());
      formData.append('sortOrder', formSortOrder);
      formData.append('isActive', String(formIsActive));

      await updateAdminBanner(editingBanner.id, formData);
      setSuccessMessage('Banner updated successfully!');
      setEditingBanner(null);
      await fetchBanners();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleActive = async (banner: BannerDto) => {
    try {
      setError(null);
      const formData = new FormData();
      formData.append('isActive', String(!banner.isActive));
      await updateAdminBanner(banner.id, formData);
      setSuccessMessage(
        `Banner "${banner.title || 'Untitled'}" is now ${!banner.isActive ? 'active' : 'inactive'}.`
      );
      await fetchBanners();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    }
  };

  const handleDeleteBanner = async () => {
    if (!deletingBanner) return;
    try {
      setIsSubmitting(true);
      setError(null);
      await deleteAdminBanner(deletingBanner.id);
      setSuccessMessage('Banner deleted successfully.');
      setDeletingBanner(null);
      await fetchBanners();
    } catch (err: any) {
      setError(getFriendlyErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl md:text-2xl font-black text-slate-100 tracking-tight flex items-center gap-2.5">
            <ImageIcon className="h-6 w-6 text-emerald-400" />
            Home Banners Management
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Upload, update, and manage promotional carousel banners and destination links displayed to players.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchBanners}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:text-slate-100 hover:bg-slate-700 text-xs font-semibold transition"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button
            onClick={handleOpenAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 transition active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Add New Banner
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
          <button onClick={() => setSuccessMessage(null)} className="text-emerald-400 hover:text-emerald-200">
            Dismiss
          </button>
        </div>
      )}

      {/* Banners Grid / List */}
      {isLoading ? (
        <div className="p-12 text-center text-slate-400 text-sm flex flex-col items-center gap-3 bg-slate-900 border border-slate-800 rounded-2xl">
          <RefreshCw className="h-6 w-6 animate-spin text-emerald-400" />
          Loading banners...
        </div>
      ) : banners.length === 0 ? (
        <div className="p-12 text-center bg-slate-900/60 border border-slate-800 rounded-3xl space-y-4">
          <div className="w-12 h-12 mx-auto rounded-2xl bg-slate-800 flex items-center justify-center text-slate-500">
            <ImageIcon className="h-6 w-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-200">No Custom Banners Configured</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No banners are currently active. Click &ldquo;Add New Banner&rdquo; to upload custom tournament graphics and destination links.
            </p>
          </div>
          <button
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition"
          >
            <Plus className="h-4 w-4" />
            Create First Banner
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {banners.map((banner) => (
            <div
              key={banner.id}
              className={`group overflow-hidden rounded-2xl border bg-slate-900 flex flex-col transition-all ${
                banner.isActive
                  ? 'border-slate-800 hover:border-slate-700 shadow-md'
                  : 'border-slate-800/50 opacity-70 hover:opacity-100'
              }`}
            >
              {/* Banner Image Preview Container */}
              <div className="relative aspect-[16/7] w-full bg-slate-950 overflow-hidden border-b border-slate-800/80">
                {banner.imageUrl ? (
                  <img
                    src={banner.imageUrl}
                    alt={banner.title || 'Banner'}
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-slate-600 text-xs">
                    No Image Available
                  </div>
                )}

                {/* Status Badges Overlay */}
                <div className="absolute top-2.5 left-2.5 flex items-center gap-2">
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider backdrop-blur-md ${
                      banner.isActive
                        ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        : 'bg-slate-900/80 text-slate-400 border-slate-700'
                    }`}
                  >
                    {banner.isActive ? 'Active' : 'Inactive'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-900/80 text-slate-300 border border-slate-700 backdrop-blur-md">
                    Order #{banner.sortOrder}
                  </span>
                </div>
              </div>

              {/* Banner Content Details */}
              <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                <div>
                  <h4 className="text-sm font-bold text-slate-100 line-clamp-1">
                    {banner.title || <span className="text-slate-500 italic">Untitled Banner</span>}
                  </h4>
                  <div className="mt-1 flex items-center gap-1.5 text-xs text-emerald-400 font-mono break-all line-clamp-1">
                    <ExternalLink className="h-3 w-3 shrink-0" />
                    <span>{banner.targetUrl}</span>
                  </div>
                </div>

                {/* Action Toolbar */}
                <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleToggleActive(banner)}
                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition ${
                      banner.isActive
                        ? 'text-slate-400 hover:text-amber-400 hover:bg-slate-800'
                        : 'text-emerald-400 hover:bg-emerald-500/10'
                    }`}
                    title={banner.isActive ? 'Deactivate banner' : 'Activate banner'}
                  >
                    {banner.isActive ? (
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

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => handleOpenEdit(banner)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-slate-100 hover:bg-slate-800 transition"
                      title="Edit banner"
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setDeletingBanner(banner)}
                      className="p-1.5 rounded-lg text-rose-400 hover:text-rose-200 hover:bg-rose-500/10 transition"
                      title="Delete banner"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add Banner Modal */}
      {isAddOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-400" />
                Add New Banner
              </h2>
              <button
                onClick={() => setIsAddOpen(false)}
                className="text-slate-500 hover:text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleCreateBanner} className="space-y-4">
              {/* File Upload & Preview */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Banner Graphic (Max 2 MB, 16:7 / 21:9 Recommended)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative aspect-[16/7] w-full rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition"
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4 space-y-1 text-slate-400">
                      <Upload className="h-6 w-6 mx-auto text-emerald-400 mb-1" />
                      <p className="text-xs font-semibold text-slate-200">Click to choose image</p>
                      <p className="text-[10px] text-slate-500">Supports JPEG, PNG, WebP</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Banner Title (Optional Display Label)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Free Fire Daily Scrims"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Target Link */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Destination Link (Target URL) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. /matches or https://..."
                  value={formTargetUrl}
                  onChange={(e) => setFormTargetUrl(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs font-mono text-slate-100 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
                />
                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[11px]">
                  <span className="text-slate-500">Presets:</span>
                  {['/matches', '/support', '/referral', '/wallet'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormTargetUrl(preset)}
                      className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 hover:text-emerald-400 hover:bg-slate-700 font-mono transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Order & Active */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Status
                  </label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4"
                    />
                    <span className="text-xs text-slate-300">Active (Visible)</span>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOpen(false)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition"
                >
                  {isSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Create Banner
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Banner Modal */}
      {editingBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm overflow-y-auto">
          <div className="w-full max-w-lg rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-5 animate-in fade-in duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h2 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-emerald-400" />
                Edit Banner #{editingBanner.id}
              </h2>
              <button
                onClick={() => setEditingBanner(null)}
                className="text-slate-500 hover:text-slate-300 text-xs font-bold"
              >
                Cancel
              </button>
            </div>

            <form onSubmit={handleUpdateBanner} className="space-y-4">
              {/* Image Preview / Replace */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                  Banner Graphic (Click to replace image)
                </label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="relative aspect-[16/7] w-full rounded-2xl border-2 border-dashed border-slate-700 hover:border-emerald-500/50 bg-slate-950 flex flex-col items-center justify-center cursor-pointer overflow-hidden transition"
                >
                  {previewUrl ? (
                    <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-center p-4 space-y-1 text-slate-400">
                      <Upload className="h-6 w-6 mx-auto text-emerald-400 mb-1" />
                      <p className="text-xs font-semibold text-slate-200">Click to choose image</p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Banner Title
                </label>
                <input
                  type="text"
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Target Link */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">
                  Destination Link (Target URL) <span className="text-rose-400">*</span>
                </label>
                <input
                  type="text"
                  value={formTargetUrl}
                  onChange={(e) => setFormTargetUrl(e.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs font-mono text-slate-100 focus:border-emerald-500 focus:outline-none"
                />
                <div className="flex items-center gap-1.5 mt-2 flex-wrap text-[11px]">
                  <span className="text-slate-500">Presets:</span>
                  {['/matches', '/support', '/referral', '/wallet'].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setFormTargetUrl(preset)}
                      className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 hover:text-emerald-400 hover:bg-slate-700 font-mono transition"
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>

              {/* Sort Order & Active */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Display Order
                  </label>
                  <input
                    type="number"
                    value={formSortOrder}
                    onChange={(e) => setFormSortOrder(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3.5 py-2.5 text-xs text-slate-100 focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1">
                    Status
                  </label>
                  <label className="flex items-center gap-2 mt-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formIsActive}
                      onChange={(e) => setFormIsActive(e.target.checked)}
                      className="rounded border-slate-700 text-emerald-500 focus:ring-0 w-4 h-4"
                    />
                    <span className="text-xs text-slate-300">Active (Visible)</span>
                  </label>
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setEditingBanner(null)}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-slate-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex items-center gap-2 px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs shadow-lg shadow-emerald-500/20 disabled:opacity-50 transition"
                >
                  {isSubmitting && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deletingBanner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-3xl border border-rose-500/30 bg-slate-900 p-6 shadow-2xl space-y-4 animate-in fade-in duration-150">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mx-auto">
              <Trash2 className="h-6 w-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-100">Delete Banner?</h3>
              <p className="text-xs text-slate-400">
                Are you sure you want to permanently delete &ldquo;{deletingBanner.title || 'Untitled Banner'}&rdquo;? The uploaded graphic file will be removed from storage.
              </p>
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeletingBanner(null)}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl border border-slate-700 bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteBanner}
                disabled={isSubmitting}
                className="w-full py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/20 transition"
              >
                {isSubmitting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
