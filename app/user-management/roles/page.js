'use client';

import { useState, useEffect, useCallback } from 'react';
import { Shield, Plus, Edit3, Trash2, X, Users, Check, AlertTriangle } from 'lucide-react';
import styles from './page.module.css';

// ---------------------------------------------------------------------------
// Permission categories & keys
// ---------------------------------------------------------------------------
const PERMISSION_CATEGORIES = [
  {
    label: 'Monitoring',
    permissions: [
      { key: 'dashboard.view', label: 'View Dashboard' },
      { key: 'cameras.view', label: 'View Cameras' },
      { key: 'cameras.manage', label: 'Manage Cameras' },
      { key: 'production.view', label: 'View Production' },
      { key: 'production.manage', label: 'Manage Production' },
    ],
  },
  {
    label: 'Safety',
    permissions: [
      { key: 'safety.view', label: 'View Safety Zones' },
      { key: 'safety.manage', label: 'Manage Safety Zones' },
    ],
  },
  {
    label: 'Operations',
    permissions: [
      { key: 'incidents.view', label: 'View Incidents' },
      { key: 'incidents.manage', label: 'Manage Incidents' },
      { key: 'ai.use', label: 'Use AI Assistant' },
    ],
  },
  {
    label: 'Administration',
    permissions: [
      { key: 'settings.view', label: 'View Settings' },
      { key: 'settings.manage', label: 'Manage Settings' },
      { key: 'users.view', label: 'View Users' },
      { key: 'users.manage', label: 'Manage Users' },
      { key: 'roles.manage', label: 'Manage Roles' },
      { key: 'audit.view', label: 'View Audit Log' },
    ],
  },
];

const ALL_PERMISSION_KEYS = PERMISSION_CATEGORIES.flatMap((c) =>
  c.permissions.map((p) => p.key)
);

const BUILT_IN_ROLES = ['admin', 'manager', 'operator', 'viewer'];

const ROLE_CARD_CLASS_MAP = {
  admin: styles.roleCardAdmin,
  manager: styles.roleCardManager,
  operator: styles.roleCardOperator,
  viewer: styles.roleCardViewer,
};

// ---------------------------------------------------------------------------
// Toast component
// ---------------------------------------------------------------------------
function Toast({ toast, onClose }) {
  useEffect(() => {
    const timer = setTimeout(onClose, 4000);
    return () => clearTimeout(timer);
  }, [onClose]);

  return (
    <div
      className={`${styles.toast} ${
        toast.type === 'success' ? styles.toastSuccess : styles.toastError
      }`}
    >
      <span className={styles.toastIcon}>
        {toast.type === 'success' ? <Check size={16} /> : <AlertTriangle size={16} />}
      </span>
      <span className={styles.toastMessage}>{toast.message}</span>
      <button className={styles.toastClose} onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Permissions matrix (shared between create and edit modals)
// ---------------------------------------------------------------------------
function PermissionsMatrix({ permissions, onChange, disabled }) {
  const toggle = (key) => {
    if (disabled) return;
    const next = permissions.includes(key)
      ? permissions.filter((k) => k !== key)
      : [...permissions, key];
    onChange(next);
  };

  return (
    <div className={styles.permissionsGrid}>
      {PERMISSION_CATEGORIES.map((category) => (
        <div key={category.label} className={styles.permissionCategory}>
          <div className={styles.permissionCategoryHeader}>
            <Shield size={14} />
            {category.label}
          </div>
          {category.permissions.map((perm) => (
            <div key={perm.key} className={styles.permissionRow}>
              <div className={styles.permissionLabel}>
                <span>{perm.label}</span>
                <span>{perm.key}</span>
              </div>
              <label className={styles.toggleSwitch}>
                <input
                  type="checkbox"
                  checked={permissions.includes(perm.key)}
                  onChange={() => toggle(perm.key)}
                  disabled={disabled}
                />
                <span className={styles.toggleSlider} />
              </label>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------
export default function RolesPage() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Modal state
  const [createOpen, setCreateOpen] = useState(false);
  const [editRole, setEditRole] = useState(null);
  const [deleteRole, setDeleteRole] = useState(null);

  // Create form state
  const [newName, setNewName] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newPermissions, setNewPermissions] = useState([]);
  const [saving, setSaving] = useState(false);

  // Edit form state
  const [editPermissions, setEditPermissions] = useState([]);

  // -----------------------------------------------------------------------
  // Fetch roles
  // -----------------------------------------------------------------------
  const fetchRoles = useCallback(async () => {
    try {
      const res = await fetch('/api/roles');
      if (res.ok) {
        const data = await res.json();
        setRoles(data.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch roles:', error);
      showToast('error', 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRoles();
  }, [fetchRoles]);

  // -----------------------------------------------------------------------
  // Toast helper
  // -----------------------------------------------------------------------
  const showToast = (type, message) => {
    setToast({ type, message });
  };

  // -----------------------------------------------------------------------
  // Create role
  // -----------------------------------------------------------------------
  const openCreate = () => {
    setNewName('');
    setNewDescription('');
    setNewPermissions([]);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      showToast('error', 'Role name is required');
      return;
    }

    setSaving(true);
    try {
      const res = await fetch('/api/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newName.trim(),
          description: newDescription.trim(),
          permissions: newPermissions,
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', 'Role created successfully');
        setCreateOpen(false);
        fetchRoles();
      } else {
        showToast('error', data.error || 'Failed to create role');
      }
    } catch {
      showToast('error', 'Failed to create role');
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Edit permissions
  // -----------------------------------------------------------------------
  const openEdit = (role) => {
    setEditRole(role);
    // Admin always has ALL permissions — we show them all-on but disabled
    if (role.name === 'admin') {
      setEditPermissions([...ALL_PERMISSION_KEYS]);
    } else {
      setEditPermissions([...(role.permissions || [])]);
    }
  };

  const handleEditSave = async () => {
    if (!editRole) return;

    // Admin role: no-op — permissions are immutable
    if (editRole.name === 'admin') {
      setEditRole(null);
      return;
    }

    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${editRole.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: editPermissions }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', `Permissions updated for "${editRole.name}"`);
        setEditRole(null);
        fetchRoles();
      } else {
        showToast('error', data.error || 'Failed to update permissions');
      }
    } catch {
      showToast('error', 'Failed to update permissions');
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Delete role
  // -----------------------------------------------------------------------
  const handleDelete = async () => {
    if (!deleteRole) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/roles/${deleteRole.id}`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast('success', `Role "${deleteRole.name}" deleted`);
        setDeleteRole(null);
        fetchRoles();
      } else {
        showToast('error', data.error || 'Failed to delete role');
      }
    } catch {
      showToast('error', 'Failed to delete role');
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------------------------
  // Render helpers
  // -----------------------------------------------------------------------
  const isBuiltIn = (roleName) => BUILT_IN_ROLES.includes(roleName);

  const getRoleCardClass = (roleName) =>
    ROLE_CARD_CLASS_MAP[roleName] || styles.roleCardCustom;

  const capitalize = (str) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1) : '';

  // -----------------------------------------------------------------------
  // Loading state
  // -----------------------------------------------------------------------
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Roles &amp; Permissions</h1>
            <p className={styles.pageSubtitle}>
              Define roles and manage permission sets for your team
            </p>
          </div>
        </div>
        <div className={styles.loadingContainer}>
          <span className="loading-spinner" />
          <p>Loading roles…</p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------------------------
  // Main render
  // -----------------------------------------------------------------------
  return (
    <div className={styles.page}>
      {/* Toast */}
      {toast && <Toast toast={toast} onClose={() => setToast(null)} />}

      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Roles &amp; Permissions</h1>
          <p className={styles.pageSubtitle}>
            Define roles and manage permission sets for your team
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-primary" onClick={openCreate}>
            <Plus size={16} />
            Create Role
          </button>
        </div>
      </div>

      {/* Roles Grid */}
      {roles.length === 0 ? (
        <div className="card">
          <div className={styles.emptyState}>
            <Shield size={48} />
            <p>
              No roles configured yet. Create your first role to start managing
              permissions.
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.rolesGrid}>
          {roles.map((role) => (
            <div
              key={role.id}
              className={`${styles.roleCard} ${getRoleCardClass(role.name)}`}
            >
              <div className={styles.roleCardHeader}>
                <div className={styles.roleCardNameGroup}>
                  <span className={styles.roleCardName}>
                    {capitalize(role.name)}
                  </span>
                  {isBuiltIn(role.name) && (
                    <span className={styles.builtInBadge}>
                      <Shield size={10} />
                      Built-in
                    </span>
                  )}
                </div>
              </div>

              <p className={styles.roleCardDescription}>
                {role.description || 'No description provided'}
              </p>

              <div className={styles.roleCardMeta}>
                <span className={styles.userCountBadge}>
                  <Users size={12} />
                  {role.user_count || 0} user{(role.user_count || 0) !== 1 ? 's' : ''}
                </span>
                <span className={styles.permissionCountBadge}>
                  <Shield size={12} />
                  {role.name === 'admin'
                    ? ALL_PERMISSION_KEYS.length
                    : (role.permissions || []).length}{' '}
                  permissions
                </span>
              </div>

              <div className={styles.roleCardActions}>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => openEdit(role)}
                  title="Edit permissions"
                >
                  <Edit3 size={14} />
                  Edit Permissions
                </button>
                {!isBuiltIn(role.name) && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setDeleteRole(role)}
                    title="Delete role"
                    style={{ color: 'var(--color-error)' }}
                  >
                    <Trash2 size={14} />
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ============================================================
          Create Role Modal
          ============================================================ */}
      {createOpen && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && setCreateOpen(false)}
        >
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>Create New Role</span>
              <button
                className={styles.modalClose}
                onClick={() => setCreateOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              <div className={styles.formGroup}>
                <label className="label">Role Name</label>
                <input
                  className="input"
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. supervisor"
                  autoFocus
                />
              </div>
              <div className={styles.formGroup}>
                <label className="label">Description</label>
                <textarea
                  className="input"
                  value={newDescription}
                  onChange={(e) => setNewDescription(e.target.value)}
                  placeholder="Describe what this role is for…"
                />
              </div>
              <div className={styles.formGroup}>
                <label className="label">Permissions</label>
                <PermissionsMatrix
                  permissions={newPermissions}
                  onChange={setNewPermissions}
                  disabled={false}
                />
              </div>
            </div>

            <div className={styles.modalFooter}>
              <button
                className="btn btn-secondary"
                onClick={() => setCreateOpen(false)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleCreate}
                disabled={saving || !newName.trim()}
              >
                {saving ? (
                  <>
                    <span className="loading-spinner" />
                    Creating…
                  </>
                ) : (
                  <>
                    <Plus size={16} />
                    Create Role
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          Edit Permissions Modal
          ============================================================ */}
      {editRole && (
        <div
          className={styles.modalOverlay}
          onClick={(e) => e.target === e.currentTarget && setEditRole(null)}
        >
          <div className={styles.modalCard}>
            <div className={styles.modalHeader}>
              <span className={styles.modalTitle}>
                Edit Permissions — {capitalize(editRole.name)}
              </span>
              <button
                className={styles.modalClose}
                onClick={() => setEditRole(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className={styles.modalBody}>
              {editRole.name === 'admin' && (
                <div
                  className="alert alert-info"
                  style={{ marginBottom: 'var(--space-4)' }}
                >
                  <Shield size={16} />
                  <span>
                    The Admin role always has all permissions enabled. These
                    toggles are read-only.
                  </span>
                </div>
              )}
              <PermissionsMatrix
                permissions={editPermissions}
                onChange={setEditPermissions}
                disabled={editRole.name === 'admin'}
              />
            </div>

            <div className={styles.modalFooter}>
              <button
                className="btn btn-secondary"
                onClick={() => setEditRole(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleEditSave}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="loading-spinner" />
                    Saving…
                  </>
                ) : (
                  <>
                    <Check size={16} />
                    {editRole.name === 'admin' ? 'Done' : 'Save Permissions'}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          Delete Confirmation Dialog
          ============================================================ */}
      {deleteRole && (
        <div
          className={styles.confirmDialog}
          onClick={(e) =>
            e.target === e.currentTarget && !saving && setDeleteRole(null)
          }
        >
          <div className={styles.confirmCard}>
            <div className={styles.confirmIcon}>
              <AlertTriangle size={24} />
            </div>
            <h3 className={styles.confirmTitle}>Delete Role</h3>
            <p className={styles.confirmMessage}>
              Are you sure you want to delete the{' '}
              <strong>&ldquo;{capitalize(deleteRole.name)}&rdquo;</strong> role?
              This action cannot be undone. Users assigned to this role will need
              to be reassigned.
            </p>
            <div className={styles.confirmActions}>
              <button
                className="btn btn-secondary"
                onClick={() => setDeleteRole(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                className="btn btn-danger"
                onClick={handleDelete}
                disabled={saving}
              >
                {saving ? (
                  <>
                    <span className="loading-spinner" />
                    Deleting…
                  </>
                ) : (
                  <>
                    <Trash2 size={16} />
                    Delete Role
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
