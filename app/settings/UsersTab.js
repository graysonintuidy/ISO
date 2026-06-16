'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserCog, Plus, Edit3, UserX, X, Eye, EyeOff, Shield, Check, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/app/components/AuthProvider';
import DataTable from '@/app/components/ui/DataTable';
import StatusBadge from '@/app/components/ui/StatusBadge';
import styles from '@/app/user-management/page.module.css';

const roleClassMap = {
  admin: styles.roleAdmin,
  manager: styles.roleManager,
  operator: styles.roleOperator,
  viewer: styles.roleViewer,
};

export default function UsersTab() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterRole, setFilterRole] = useState('all');

  // Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeactivateConfirm, setShowDeactivateConfirm] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);

  // Toast state
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch('/api/users?facilityId=1');
      if (res.ok) {
        const data = await res.json();
        setUsers(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/roles');
      if (res.ok) {
        const data = await res.json();
        setRoles(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
    fetchRoles();
  }, [fetchUsers, fetchRoles]);

  // Filter users by role
  const filteredUsers = filterRole === 'all'
    ? users
    : users.filter(u => u.role === filterRole);

  // Unique roles for tabs
  const availableRoles = [...new Set(users.map(u => u.role).filter(Boolean))];

  const handleEditClick = (user) => {
    setSelectedUser(user);
    setShowEditModal(true);
  };

  const handleDeactivateClick = (user) => {
    setSelectedUser(user);
    setShowDeactivateConfirm(true);
  };

  const handleDeactivateConfirm = async () => {
    if (!selectedUser) return;
    try {
      const res = await fetch(`/api/users/${selectedUser.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (res.ok) {
        showToast(`${selectedUser.username} has been deactivated`);
        fetchUsers();
      } else {
        showToast(data.error || 'Failed to deactivate user', 'error');
      }
    } catch {
      showToast('Failed to deactivate user', 'error');
    } finally {
      setShowDeactivateConfirm(false);
      setSelectedUser(null);
    }
  };

  const columns = [
    {
      key: 'username',
      label: 'User',
      sortable: true,
      render: (value, row) => (
        <div className={styles.userCell}>
          <div className={styles.userAvatar}>
            {(row.first_name?.[0] || '') + (row.last_name?.[0] || '')}
          </div>
          <div className={styles.userInfo}>
            <span className={styles.userName}>
              {row.first_name && row.last_name ? `${row.first_name} ${row.last_name}` : value || '—'}
            </span>
            <span className={styles.userUsername}>@{value || '—'}</span>
          </div>
        </div>
      ),
    },
    { key: 'email', label: 'Email', sortable: true, render: (value) => value || '—' },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (value) => {
        const roleClass = roleClassMap[value] || '';
        return (
          <span className={`${styles.roleBadge} ${roleClass}`}>
            <Shield size={12} />
            {value || 'unknown'}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <StatusBadge
          status={value === 'active' ? 'online' : value === 'suspended' ? 'warning' : 'offline'}
          label={value || 'unknown'}
        />
      ),
    },
    {
      key: 'last_login',
      label: 'Last Login',
      sortable: true,
      render: (value) => {
        if (!value) return <span className={styles.noData}>Never</span>;
        try {
          return new Date(value).toLocaleString();
        } catch {
          return '—';
        }
      },
    },
    {
      key: 'actions',
      label: '',
      sortable: false,
      render: (_, row) => (
        <div className={styles.actionsCell}>
          <button
            className="btn btn-ghost btn-sm"
            onClick={(e) => { e.stopPropagation(); handleEditClick(row); }}
            title="Edit user"
          >
            <Edit3 size={14} />
          </button>
          {row.id !== currentUser?.id && row.status === 'active' && (
            <button
              className="btn btn-ghost btn-sm"
              onClick={(e) => { e.stopPropagation(); handleDeactivateClick(row); }}
              title="Deactivate user"
              style={{ color: 'var(--color-error)' }}
            >
              <UserX size={14} />
            </button>
          )}
        </div>
      ),
    },
  ];

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <span className="loading-spinner" />
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <>
      {/* Add User button */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 'var(--space-4)' }}>
        <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
          <Plus size={16} />
          Add User
        </button>
      </div>

      {/* Role Filter Tabs */}
      {availableRoles.length > 0 && (
        <div className={styles.filterTabs}>
          <button
            className={`${styles.filterTab} ${filterRole === 'all' ? styles.filterTabActive : ''}`}
            onClick={() => setFilterRole('all')}
          >
            All Users
            <span className={styles.filterCount}>{users.length}</span>
          </button>
          {availableRoles.map(role => (
            <button
              key={role}
              className={`${styles.filterTab} ${filterRole === role ? styles.filterTabActive : ''}`}
              onClick={() => setFilterRole(role)}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
              <span className={styles.filterCount}>
                {users.filter(u => u.role === role).length}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* User Table */}
      <div className="card">
        {filteredUsers.length === 0 ? (
          <div className={styles.emptyState}>
            <UserCog size={48} />
            <p>No users found. Add platform users to manage access and permissions.</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredUsers}
            emptyMessage="No users found."
            pageSize={15}
          />
        )}
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <CreateUserModal
          roles={roles}
          onClose={() => setShowCreateModal(false)}
          onSuccess={() => {
            fetchUsers();
            setShowCreateModal(false);
            showToast('User created successfully');
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
        <EditUserModal
          user={selectedUser}
          roles={roles}
          onClose={() => { setShowEditModal(false); setSelectedUser(null); }}
          onSuccess={() => {
            fetchUsers();
            setShowEditModal(false);
            setSelectedUser(null);
            showToast('User updated successfully');
          }}
          onError={(msg) => showToast(msg, 'error')}
        />
      )}

      {/* Deactivate Confirmation */}
      {showDeactivateConfirm && selectedUser && (
        <div className={styles.modalOverlay} onClick={() => setShowDeactivateConfirm(false)}>
          <div className={styles.confirmDialog} onClick={e => e.stopPropagation()}>
            <div className={styles.confirmIcon}>
              <AlertTriangle size={32} />
            </div>
            <h3 className={styles.confirmTitle}>Deactivate User</h3>
            <p className={styles.confirmMessage}>
              Are you sure you want to deactivate <strong>{selectedUser.first_name} {selectedUser.last_name}</strong> (@{selectedUser.username})? They will no longer be able to sign in.
            </p>
            <div className={styles.confirmActions}>
              <button className="btn btn-secondary" onClick={() => setShowDeactivateConfirm(false)}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDeactivateConfirm}>
                <UserX size={14} />
                Deactivate
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className={`${styles.toast} ${toast.type === 'error' ? styles.toastError : styles.toastSuccess}`}>
          {toast.type === 'error' ? <AlertTriangle size={16} /> : <Check size={16} />}
          {toast.message}
        </div>
      )}
    </>
  );
}

/* ── Create User Modal ────────────────────────────────────── */

function CreateUserModal({ roles, onClose, onSuccess, onError }) {
  const [form, setForm] = useState({
    first_name: '',
    last_name: '',
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
    role_id: '',
    status: 'active',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  // Auto-generate username from name
  useEffect(() => {
    if (form.first_name && form.last_name && !form.username) {
      const suggested = `${form.first_name.toLowerCase()}.${form.last_name.toLowerCase()}`.replace(/[^a-z0-9.]/g, '');
      setForm(prev => ({ ...prev, username: suggested }));
    }
  }, [form.first_name, form.last_name]); // eslint-disable-line react-hooks/exhaustive-deps

  const getPasswordStrength = () => {
    const pw = form.password;
    if (!pw) return { score: 0, label: '', className: '' };
    let score = 0;
    if (pw.length >= 8) score++;
    if (pw.length >= 12) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;

    if (score <= 1) return { score: 1, label: 'Weak', className: styles.strengthWeak };
    if (score <= 2) return { score: 2, label: 'Fair', className: styles.strengthFair };
    if (score <= 3) return { score: 3, label: 'Good', className: styles.strengthGood };
    return { score: 4, label: 'Strong', className: styles.strengthStrong };
  };

  const validate = () => {
    const errs = {};
    if (!form.first_name.trim()) errs.first_name = 'Required';
    if (!form.last_name.trim()) errs.last_name = 'Required';
    if (!form.username.trim()) errs.username = 'Required';
    if (!form.email.trim()) errs.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email';
    if (!form.password) errs.password = 'Required';
    else if (form.password.length < 8) errs.password = 'Min 8 characters';
    if (form.password !== form.confirmPassword) errs.confirmPassword = 'Passwords don\'t match';
    if (!form.role_id) errs.role_id = 'Select a role';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: form.username.trim(),
          email: form.email.toLowerCase().trim(),
          password: form.password,
          first_name: form.first_name.trim(),
          last_name: form.last_name.trim(),
          role_id: parseInt(form.role_id, 10),
          status: form.status,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        onSuccess();
      } else {
        onError(data.error || 'Failed to create user');
      }
    } catch {
      onError('Failed to create user');
    } finally {
      setSubmitting(false);
    }
  };

  const pwStrength = getPasswordStrength();

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>
            <Plus size={20} />
            Create New User
          </h2>
          <button className={styles.modalClose} onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="create-first-name">First Name</label>
                <input id="create-first-name" className={`input ${errors.first_name ? styles.inputError : ''}`} type="text" placeholder="John" value={form.first_name} onChange={e => handleChange('first_name', e.target.value)} />
                {errors.first_name && <span className={styles.fieldError}>{errors.first_name}</span>}
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="create-last-name">Last Name</label>
                <input id="create-last-name" className={`input ${errors.last_name ? styles.inputError : ''}`} type="text" placeholder="Smith" value={form.last_name} onChange={e => handleChange('last_name', e.target.value)} />
                {errors.last_name && <span className={styles.fieldError}>{errors.last_name}</span>}
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="create-username">Username</label>
                <input id="create-username" className={`input ${errors.username ? styles.inputError : ''}`} type="text" placeholder="john.smith" value={form.username} onChange={e => handleChange('username', e.target.value)} />
                {errors.username && <span className={styles.fieldError}>{errors.username}</span>}
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="create-email">Email</label>
                <input id="create-email" className={`input ${errors.email ? styles.inputError : ''}`} type="email" placeholder="john.smith@nationalbeef.com" value={form.email} onChange={e => handleChange('email', e.target.value)} />
                {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="create-password">Password</label>
                <div className={styles.passwordWrapper}>
                  <input id="create-password" className={`input ${errors.password ? styles.inputError : ''}`} type={showPassword ? 'text' : 'password'} placeholder="Min 8 characters" value={form.password} onChange={e => handleChange('password', e.target.value)} />
                  <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {form.password && (
                  <div className={styles.strengthBar}>
                    <div className={styles.strengthTrack}>
                      <div className={`${styles.strengthFill} ${pwStrength.className}`} style={{ width: `${(pwStrength.score / 4) * 100}%` }} />
                    </div>
                    <span className={`${styles.strengthLabel} ${pwStrength.className}`}>{pwStrength.label}</span>
                  </div>
                )}
                {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="create-confirm-password">Confirm Password</label>
                <input id="create-confirm-password" className={`input ${errors.confirmPassword ? styles.inputError : ''}`} type={showPassword ? 'text' : 'password'} placeholder="Repeat password" value={form.confirmPassword} onChange={e => handleChange('confirmPassword', e.target.value)} />
                {errors.confirmPassword && <span className={styles.fieldError}>{errors.confirmPassword}</span>}
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="create-role">Role</label>
                <select id="create-role" className={`input select ${errors.role_id ? styles.inputError : ''}`} value={form.role_id} onChange={e => handleChange('role_id', e.target.value)}>
                  <option value="">Select a role...</option>
                  {roles.map(r => (
                    <option key={r.id} value={r.id}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}{r.description ? ` — ${r.description}` : ''}</option>
                  ))}
                </select>
                {errors.role_id && <span className={styles.fieldError}>{errors.role_id}</span>}
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="create-status">Status</label>
                <select id="create-status" className="input select" value={form.status} onChange={e => handleChange('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                </select>
              </div>
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="loading-spinner" /> : <><Plus size={14} /> Create User</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ── Edit User Modal ──────────────────────────────────────── */

function EditUserModal({ user, roles, onClose, onSuccess, onError }) {
  const [form, setForm] = useState({
    first_name: user.first_name || '',
    last_name: user.last_name || '',
    username: user.username || '',
    email: user.email || '',
    role_id: user.role_id?.toString() || '',
    status: user.status || 'active',
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }));
    }
  };

  const validate = () => {
    const errs = {};
    if (!form.first_name.trim()) errs.first_name = 'Required';
    if (!form.last_name.trim()) errs.last_name = 'Required';
    if (!form.username.trim()) errs.username = 'Required';
    if (!form.email.trim()) errs.email = 'Required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errs.email = 'Invalid email';
    if (form.password && form.password.length < 8) errs.password = 'Min 8 characters';
    if (!form.role_id) errs.role_id = 'Select a role';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSubmitting(true);

    const payload = {
      first_name: form.first_name.trim(),
      last_name: form.last_name.trim(),
      username: form.username.trim(),
      email: form.email.toLowerCase().trim(),
      role_id: parseInt(form.role_id, 10),
      status: form.status,
    };
    if (form.password) payload.password = form.password;

    try {
      const res = await fetch(`/api/users/${user.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) { onSuccess(); } else { onError(data.error || 'Failed to update user'); }
    } catch { onError('Failed to update user'); } finally { setSubmitting(false); }
  };

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalCard} onClick={e => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}><Edit3 size={20} /> Edit User</h2>
          <button className={styles.modalClose} onClick={onClose}><X size={18} /></button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.editUserHeader}>
              <div className={styles.editUserAvatar}>{(user.first_name?.[0] || '') + (user.last_name?.[0] || '')}</div>
              <div>
                <div className={styles.editUserName}>{user.first_name} {user.last_name}</div>
                <div className={styles.editUserEmail}>{user.email}</div>
              </div>
            </div>
            <div className={styles.formGrid}>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="edit-first-name">First Name</label>
                <input id="edit-first-name" className={`input ${errors.first_name ? styles.inputError : ''}`} type="text" value={form.first_name} onChange={e => handleChange('first_name', e.target.value)} />
                {errors.first_name && <span className={styles.fieldError}>{errors.first_name}</span>}
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="edit-last-name">Last Name</label>
                <input id="edit-last-name" className={`input ${errors.last_name ? styles.inputError : ''}`} type="text" value={form.last_name} onChange={e => handleChange('last_name', e.target.value)} />
                {errors.last_name && <span className={styles.fieldError}>{errors.last_name}</span>}
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="edit-username">Username</label>
                <input id="edit-username" className={`input ${errors.username ? styles.inputError : ''}`} type="text" value={form.username} onChange={e => handleChange('username', e.target.value)} />
                {errors.username && <span className={styles.fieldError}>{errors.username}</span>}
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="edit-email">Email</label>
                <input id="edit-email" className={`input ${errors.email ? styles.inputError : ''}`} type="email" value={form.email} onChange={e => handleChange('email', e.target.value)} />
                {errors.email && <span className={styles.fieldError}>{errors.email}</span>}
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="edit-role">Role</label>
                <select id="edit-role" className={`input select ${errors.role_id ? styles.inputError : ''}`} value={form.role_id} onChange={e => handleChange('role_id', e.target.value)}>
                  <option value="">Select a role...</option>
                  {roles.map(r => (<option key={r.id} value={r.id}>{r.name.charAt(0).toUpperCase() + r.name.slice(1)}</option>))}
                </select>
                {errors.role_id && <span className={styles.fieldError}>{errors.role_id}</span>}
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="edit-status">Status</label>
                <select id="edit-status" className="input select" value={form.status} onChange={e => handleChange('status', e.target.value)}>
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
              <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
                <label className="label" htmlFor="edit-password">Reset Password (optional)</label>
                <div className={styles.passwordWrapper}>
                  <input id="edit-password" className={`input ${errors.password ? styles.inputError : ''}`} type={showPassword ? 'text' : 'password'} placeholder="Leave blank to keep current password" value={form.password} onChange={e => handleChange('password', e.target.value)} />
                  <button type="button" className={styles.passwordToggle} onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
                {errors.password && <span className={styles.fieldError}>{errors.password}</span>}
              </div>
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={submitting}>
              {submitting ? <span className="loading-spinner" /> : <><Check size={14} /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
