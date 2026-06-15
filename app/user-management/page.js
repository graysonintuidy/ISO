'use client';

import { useState, useEffect, useCallback } from 'react';
import { UserCog, Plus } from 'lucide-react';
import DataTable from '@/app/components/ui/DataTable';
import StatusBadge from '@/app/components/ui/StatusBadge';
import styles from './page.module.css';

const roleClassMap = {
  admin: styles.roleAdmin,
  manager: styles.roleManager,
  operator: styles.roleOperator,
  viewer: styles.roleViewer,
};

export default function UserManagementPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const columns = [
    { key: 'username', label: 'Username', sortable: true, render: (value) => value || '—' },
    { key: 'email', label: 'Email', sortable: true, render: (value) => value || '—' },
    {
      key: 'role',
      label: 'Role',
      sortable: true,
      render: (value) => {
        const roleClass = roleClassMap[value] || '';
        return (
          <span className={`${styles.roleBadge} ${roleClass}`}>
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
        if (!value) return '—';
        try {
          return new Date(value).toLocaleString();
        } catch {
          return '—';
        }
      },
    },
  ];

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>User Management</h1>
            <p className={styles.pageSubtitle}>Manage platform users, roles, and permissions</p>
          </div>
        </div>
        <div className={styles.loadingContainer}>
          <span className="loading-spinner" />
          <p>Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>User Management</h1>
          <p className={styles.pageSubtitle}>Manage platform users, roles, and permissions</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-primary">
            <Plus size={16} />
            Add User
          </button>
        </div>
      </div>

      {/* User Table */}
      <div className="card">
        {users.length === 0 ? (
          <div className={styles.emptyState}>
            <UserCog size={48} />
            <p>No users configured. Add platform users to manage access and permissions.</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={users}
            emptyMessage="No users found."
            pageSize={15}
          />
        )}
      </div>
    </div>
  );
}
