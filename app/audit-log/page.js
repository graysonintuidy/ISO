'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ScrollText } from 'lucide-react';
import DataTable from '@/app/components/ui/DataTable';
import styles from './page.module.css';

export default function AuditLogPage() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: 'all',
    user: 'all',
    dateFrom: '',
    dateTo: '',
  });

  const fetchLogs = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?facilityId=1');
      if (res.ok) {
        const data = await res.json();
        setLogs(data.auditLogs || []);
      }
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const uniqueActions = useMemo(
    () => [...new Set(logs.map((l) => l.action).filter(Boolean))],
    [logs]
  );

  const uniqueUsers = useMemo(
    () => [...new Set(logs.map((l) => l.user).filter(Boolean))],
    [logs]
  );

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filters.action !== 'all' && log.action !== filters.action) return false;
      if (filters.user !== 'all' && log.user !== filters.user) return false;
      if (filters.dateFrom && log.timestamp && new Date(log.timestamp) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && log.timestamp && new Date(log.timestamp) > new Date(filters.dateTo)) return false;
      return true;
    });
  }, [logs, filters]);

  const columns = [
    {
      key: 'timestamp',
      label: 'Timestamp',
      sortable: true,
      render: (value) => (value ? new Date(value).toLocaleString() : '—'),
    },
    { key: 'user', label: 'User', sortable: true, render: (value) => value || '—' },
    {
      key: 'action',
      label: 'Action',
      sortable: true,
      render: (value) => (
        <span className={`badge badge-neutral ${styles.actionBadge}`}>
          {value || '—'}
        </span>
      ),
    },
    { key: 'entity_type', label: 'Entity Type', sortable: true, render: (value) => value || '—' },
    { key: 'entity_id', label: 'Entity ID', sortable: true, render: (value) => value || '—' },
    { key: 'ip_address', label: 'IP Address', sortable: false, render: (value) => value || '—' },
  ];

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Audit Log</h1>
            <p className={styles.pageSubtitle}>System activity and user action history</p>
          </div>
        </div>
        <div className={styles.loadingContainer}>
          <span className="loading-spinner" />
          <p>Loading audit logs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Audit Log</h1>
          <p className={styles.pageSubtitle}>System activity and user action history</p>
        </div>
      </div>

      {/* Filter Bar */}
      {logs.length > 0 && (
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Action</span>
            <select
              className={`input select ${styles.filterSelect}`}
              value={filters.action}
              onChange={(e) => handleFilterChange('action', e.target.value)}
            >
              <option value="all">All Actions</option>
              {uniqueActions.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>User</span>
            <select
              className={`input select ${styles.filterSelect}`}
              value={filters.user}
              onChange={(e) => handleFilterChange('user', e.target.value)}
            >
              <option value="all">All Users</option>
              {uniqueUsers.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>From</span>
            <input
              type="date"
              className={`input ${styles.filterInput}`}
              value={filters.dateFrom}
              onChange={(e) => handleFilterChange('dateFrom', e.target.value)}
            />
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>To</span>
            <input
              type="date"
              className={`input ${styles.filterInput}`}
              value={filters.dateTo}
              onChange={(e) => handleFilterChange('dateTo', e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Audit Log Table */}
      <div className="card">
        {logs.length === 0 ? (
          <div className={styles.emptyState}>
            <ScrollText size={48} />
            <p>No audit records yet. All user actions and system events will be logged here.</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredLogs}
            emptyMessage="No logs match the selected filters."
            pageSize={20}
          />
        )}
      </div>
    </div>
  );
}
