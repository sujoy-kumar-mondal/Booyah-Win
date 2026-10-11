/**
 * Employee Management Page (Admin Only)
 * Section 16.1
 */

import React, { useState, useEffect, useRef } from 'react';
import { useStaffAuth } from '../context/StaffAuthContext.js';
import {
  getAdminEmployees,
  createAdminEmployee,
  updateAdminEmployee,
  deleteAdminEmployee,
  type EmployeeDto,
} from '../api/admin.js';
import { formatISTDate } from '../utils/formatters.js';
import { getFriendlyErrorMessage } from '../utils/errors.js';
import {
  Users,
  UserPlus,
  Search,
  RefreshCw,
  Edit2,
  Trash2,
  AlertCircle,
  X,
  Shield,
  CheckCircle,
} from 'lucide-react';

export const Employees: React.FC = () => {
  const { staff } = useStaffAuth();
  const currentAdminId = staff?.id;

  // List state
  const [employees, setEmployees] = useState<EmployeeDto[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  // Requirement 8: Race condition guard for search
  const latestSearchReqIdRef = useRef<number>(0);

  // Modals state
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editEmployee, setEditEmployee] = useState<EmployeeDto | null>(null);
  const [deleteConfirmEmployee, setDeleteConfirmEmployee] = useState<EmployeeDto | null>(null);

  // Form states
  const [createForm, setCreateForm] = useState({
    name: '',
    mobile: '',
    email: '',
    pan: '',
    aadhaar: '',
  });
  const [editForm, setEditForm] = useState({
    name: '',
    mobile: '',
    email: '',
    pan: '',
    aadhaar: '',
  });

  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submitLockRef = useRef(false);

  // Fetch list
  const fetchEmployees = async (query = searchQuery, cursor?: string) => {
    const reqId = ++latestSearchReqIdRef.current;
    if (!cursor) setIsLoading(true);
    else setIsLoadingMore(true);
    setListError(null);

    try {
      const data = await getAdminEmployees({
        q: query.trim() || undefined,
        cursor,
        limit: 20,
      });

      // Constraint 8: Search results from an older request never overwrite a newer one
      if (reqId !== latestSearchReqIdRef.current) {
        return;
      }

      if (cursor) {
        setEmployees((prev) => [...prev, ...data.items]);
      } else {
        setEmployees(data.items);
      }
      setNextCursor(data.nextCursor);
    } catch (err) {
      if (reqId === latestSearchReqIdRef.current) {
        setListError(getFriendlyErrorMessage(err, 'employee'));
      }
    } finally {
      if (reqId === latestSearchReqIdRef.current) {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    }
  };

  useEffect(() => {
    fetchEmployees(searchQuery);
  }, [searchQuery]);

  // Handle Create Submit
  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLockRef.current || isSubmitting) return;

    setModalError(null);
    if (!createForm.name.trim() || !createForm.mobile.trim() || !createForm.email.trim()) {
      setModalError('Name, mobile number, and email are required.');
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const payload: {
        name: string;
        mobile: string;
        email: string;
        pan?: string;
        aadhaar?: string;
      } = {
        name: createForm.name.trim(),
        mobile: createForm.mobile.trim(),
        email: createForm.email.trim(),
      };
      if (createForm.pan.trim()) payload.pan = createForm.pan.trim();
      if (createForm.aadhaar.trim()) payload.aadhaar = createForm.aadhaar.trim();

      await createAdminEmployee(payload);

      // Clear state immediately: no secrets remain in DOM
      setCreateForm({ name: '', mobile: '', email: '', pan: '', aadhaar: '' });
      setIsCreateOpen(false);
      setActionSuccess('Employee registered successfully.');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchEmployees(searchQuery);
    } catch (err: any) {
      setModalError(getFriendlyErrorMessage(err, 'employee'));
      if (err.status === 409) {
        fetchEmployees(searchQuery);
      }
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Handle Edit Open
  const handleOpenEdit = (emp: EmployeeDto) => {
    setEditEmployee(emp);
    setEditForm({
      name: emp.name,
      mobile: emp.mobile,
      email: emp.email,
      pan: '',
      aadhaar: '',
    });
    setModalError(null);
  };

  // Handle Edit Submit
  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editEmployee || submitLockRef.current || isSubmitting) return;

    setModalError(null);
    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      const payload: {
        name?: string;
        mobile?: string;
        email?: string;
        pan?: string;
        aadhaar?: string;
      } = {};

      if (editForm.name.trim() && editForm.name.trim() !== editEmployee.name) {
        payload.name = editForm.name.trim();
      }
      if (editForm.mobile.trim() && editForm.mobile.trim() !== editEmployee.mobile) {
        payload.mobile = editForm.mobile.trim();
      }
      if (editForm.email.trim() && editForm.email.trim() !== editEmployee.email) {
        payload.email = editForm.email.trim();
      }

      // Constraint 3: When PAN or Aadhaar is blank in an edit, OMIT the key from the request body
      if (editForm.pan.trim()) {
        payload.pan = editForm.pan.trim();
      }
      if (editForm.aadhaar.trim()) {
        payload.aadhaar = editForm.aadhaar.trim();
      }

      await updateAdminEmployee(editEmployee.id, payload);

      // Clear form inputs immediately
      setEditForm({ name: '', mobile: '', email: '', pan: '', aadhaar: '' });
      setEditEmployee(null);
      setActionSuccess('Employee updated successfully.');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchEmployees(searchQuery);
    } catch (err: any) {
      setModalError(getFriendlyErrorMessage(err, 'employee'));
      if (err.status === 409) {
        fetchEmployees(searchQuery);
      }
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  // Handle Delete Submit
  const handleDeleteSubmit = async () => {
    if (!deleteConfirmEmployee || submitLockRef.current || isSubmitting) return;

    if (deleteConfirmEmployee.id === currentAdminId) {
      setModalError('Administrators cannot delete their own account.');
      return;
    }

    submitLockRef.current = true;
    setIsSubmitting(true);

    try {
      await deleteAdminEmployee(deleteConfirmEmployee.id);
      setDeleteConfirmEmployee(null);
      setActionSuccess('Employee account deleted successfully.');
      setTimeout(() => setActionSuccess(null), 4000);
      fetchEmployees(searchQuery);
    } catch (err) {
      setModalError(getFriendlyErrorMessage(err, 'employee'));
    } finally {
      submitLockRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="employees-page">
      {/* Top Banner / Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-100 flex items-center gap-2.5">
            <Users className="h-6 w-6 text-emerald-400" />
            Employee Management
          </h1>
          <p className="mt-1 text-xs text-slate-400">
            Create, update, and manage staff operations accounts and identification verifications.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => fetchEmployees(searchQuery)}
            disabled={isLoading}
            data-testid="refresh-employees-btn"
            className="flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-3.5 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
            Refresh
          </button>
          <button
            type="button"
            onClick={() => {
              setCreateForm({ name: '', mobile: '', email: '', pan: '', aadhaar: '' });
              setModalError(null);
              setIsCreateOpen(true);
            }}
            data-testid="create-employee-btn"
            className="flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors shadow-lg shadow-emerald-500/10"
          >
            <UserPlus className="h-4 w-4" />
            Add Employee
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div
          data-testid="employee-action-success-banner"
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-400 flex items-center gap-2.5"
        >
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-400" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {listError && (
        <div
          data-testid="employee-list-error-banner"
          className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-400 flex items-center gap-2.5"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
          <span>{listError}</span>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-3 flex items-center gap-3">
        <Search className="h-4 w-4 text-slate-500 shrink-0 ml-1" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search by name or email..."
          data-testid="employee-search-input"
          className="flex-1 bg-transparent text-xs text-slate-200 placeholder-slate-500 focus:outline-none"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="text-slate-500 hover:text-slate-300 text-xs px-2"
          >
            Clear
          </button>
        )}
      </div>

      {/* Employee List Table */}
      <div className="rounded-xl border border-slate-800 bg-slate-900/40 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs" data-testid="employee-table">
            <thead className="border-b border-slate-800 bg-slate-900/80 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <tr>
                <th className="px-4 py-3">Employee</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Mobile</th>
                <th className="px-4 py-3">Masked PAN</th>
                <th className="px-4 py-3">Masked Aadhaar</th>
                <th className="px-4 py-3">Joined Date</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500" data-testid="employees-loading-state">
                    <RefreshCw className="h-5 w-5 animate-spin mx-auto mb-2 text-emerald-400" />
                    Loading employees...
                  </td>
                </tr>
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-slate-500" data-testid="employees-empty-state">
                    No employees found matching the query.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-800/20 transition-colors" data-testid={`employee-row-${emp.id}`}>
                    <td className="px-4 py-3">
                      <div className="font-semibold text-slate-200">{emp.name}</div>
                      <div className="text-[11px] text-slate-500">{emp.email}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider border ${
                          emp.role === 'admin'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-slate-800 text-slate-300 border-slate-700'
                        }`}
                      >
                        <Shield className="h-2.5 w-2.5" />
                        {emp.role}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-300">{emp.mobile}</td>
                    {/* Constraint 7: Tolerate null masked PAN and Aadhaar and show "-" */}
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400" data-testid={`employee-pan-${emp.id}`}>
                      {emp.pan || '-'}
                    </td>
                    <td className="px-4 py-3 font-mono text-[11px] text-slate-400" data-testid={`employee-aadhaar-${emp.id}`}>
                      {emp.aadhaar || '-'}
                    </td>
                    <td className="px-4 py-3 text-slate-400">{formatISTDate(emp.createdAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(emp)}
                          data-testid={`edit-employee-btn-${emp.id}`}
                          className="p-1.5 text-slate-400 hover:text-emerald-400 hover:bg-slate-800 rounded-lg transition-colors"
                          title="Edit Employee"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={emp.id === currentAdminId}
                          onClick={() => {
                            setDeleteConfirmEmployee(emp);
                            setModalError(null);
                          }}
                          data-testid={`delete-employee-btn-${emp.id}`}
                          className={`p-1.5 rounded-lg transition-colors ${
                            emp.id === currentAdminId
                              ? 'text-slate-600 cursor-not-allowed opacity-40'
                              : 'text-slate-400 hover:text-rose-400 hover:bg-rose-500/10'
                          }`}
                          title={emp.id === currentAdminId ? 'Cannot delete self' : 'Delete Employee'}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Cursor Pagination */}
        {nextCursor && (
          <div className="p-3 border-t border-slate-800 text-center">
            <button
              type="button"
              onClick={() => fetchEmployees(searchQuery, nextCursor)}
              disabled={isLoadingMore}
              data-testid="load-more-employees-btn"
              className="px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors disabled:opacity-50"
            >
              {isLoadingMore ? 'Loading more...' : 'Load More Employees'}
            </button>
          </div>
        )}
      </div>

      {/* ─── Create Employee Modal ─── */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" data-testid="create-employee-modal">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <UserPlus className="h-4 w-4 text-emerald-400" />
                Register New Employee
              </h2>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalError && (
              <div
                data-testid="create-employee-error"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-400 flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleCreateSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Full Name <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                  placeholder="e.g. Rahul Sharma"
                  data-testid="create-employee-name-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Mobile Number (10 Digits) <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  pattern="^[6-9]\d{9}$"
                  value={createForm.mobile}
                  onChange={(e) => setCreateForm({ ...createForm, mobile: e.target.value })}
                  placeholder="e.g. 9876543210"
                  data-testid="create-employee-mobile-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Email Address <span className="text-emerald-400">*</span>
                </label>
                <input
                  type="email"
                  required
                  value={createForm.email}
                  onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                  placeholder="e.g. rahul@booyah.win"
                  data-testid="create-employee-email-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  PAN Number (Optional)
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={createForm.pan}
                  onChange={(e) => setCreateForm({ ...createForm, pan: e.target.value.toUpperCase() })}
                  placeholder="e.g. ABCDE1234F"
                  data-testid="create-employee-pan-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 uppercase focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  Aadhaar Number (12 Digits, Optional)
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={createForm.aadhaar}
                  onChange={(e) => setCreateForm({ ...createForm, aadhaar: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                  placeholder="e.g. 123456789012"
                  data-testid="create-employee-aadhaar-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2.5 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Role:</span> Employee (Admin accounts cannot create other administrators).
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsCreateOpen(false)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="submit-create-employee-btn"
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Registering...' : 'Register Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Edit Employee Modal ─── */}
      {editEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" data-testid="edit-employee-modal">
          <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-slate-100 flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-emerald-400" />
                Edit Employee Details
              </h2>
              <button
                type="button"
                onClick={() => setEditEmployee(null)}
                className="text-slate-500 hover:text-slate-300"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {modalError && (
              <div
                data-testid="edit-employee-error"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-400 flex items-center gap-2"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
                <span>{modalError}</span>
              </div>
            )}

            <form onSubmit={handleEditSubmit} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  data-testid="edit-employee-name-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Mobile Number</label>
                <input
                  type="text"
                  value={editForm.mobile}
                  onChange={(e) => setEditForm({ ...editForm, mobile: e.target.value })}
                  data-testid="edit-employee-mobile-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">Email Address</label>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                  data-testid="edit-employee-email-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  New PAN Number (Leave blank to keep existing)
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={editForm.pan}
                  onChange={(e) => setEditForm({ ...editForm, pan: e.target.value.toUpperCase() })}
                  placeholder={`Current: ${editEmployee.pan || 'None'}`}
                  data-testid="edit-employee-pan-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 uppercase focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 mb-1">
                  New Aadhaar Number (Leave blank to keep existing)
                </label>
                <input
                  type="text"
                  autoComplete="off"
                  value={editForm.aadhaar}
                  onChange={(e) => setEditForm({ ...editForm, aadhaar: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                  placeholder={`Current: ${editEmployee.aadhaar || 'None'}`}
                  data-testid="edit-employee-aadhaar-input"
                  className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none font-mono"
                />
              </div>

              <div className="rounded-xl border border-slate-800 bg-slate-950/40 p-2.5 text-[11px] text-slate-400">
                <span className="font-semibold text-slate-300">Role:</span> {editEmployee.role} (Role cannot be modified).
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditEmployee(null)}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  data-testid="submit-edit-employee-btn"
                  className="rounded-xl bg-emerald-500 px-4 py-2 text-xs font-bold text-slate-950 hover:bg-emerald-400 transition-colors disabled:opacity-50"
                >
                  {isSubmitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── Delete Confirmation Modal ─── */}
      {deleteConfirmEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm" data-testid="delete-employee-modal">
          <div className="w-full max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-3 text-rose-400">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-rose-500/10 border border-rose-500/20">
                <Trash2 className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-100">Confirm Soft Delete</h3>
                <p className="text-[11px] text-slate-400">Revoke employee platform access</p>
              </div>
            </div>

            <p className="text-xs text-slate-300">
              Are you sure you want to delete employee <span className="font-bold text-slate-100">{deleteConfirmEmployee.name}</span> ({deleteConfirmEmployee.email})?
              Their active sessions will be terminated immediately.
            </p>

            {modalError && (
              <div
                data-testid="delete-employee-error"
                className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-2 text-xs text-rose-400"
              >
                {modalError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmEmployee(null)}
                className="px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleDeleteSubmit}
                disabled={isSubmitting}
                data-testid="confirm-delete-employee-btn"
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-bold text-white hover:bg-rose-500 transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Deleting...' : 'Delete Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
