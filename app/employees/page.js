'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Users, Plus, Search, CheckCircle, XCircle } from 'lucide-react';
import DataTable from '@/app/components/ui/DataTable';
import StatusBadge from '@/app/components/ui/StatusBadge';
import styles from './page.module.css';

export default function EmployeesPage() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEmployees = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?facilityId=1');
      if (res.ok) {
        const data = await res.json();
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Failed to fetch employees:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEmployees();
  }, [fetchEmployees]);

  const filteredEmployees = useMemo(() => {
    if (!searchQuery.trim()) return employees;
    const query = searchQuery.toLowerCase();
    return employees.filter(
      (emp) =>
        (emp.first_name || '').toLowerCase().includes(query) ||
        (emp.last_name || '').toLowerCase().includes(query) ||
        (emp.employee_number || '').toString().includes(query) ||
        (emp.department || '').toLowerCase().includes(query) ||
        (emp.role || '').toLowerCase().includes(query)
    );
  }, [employees, searchQuery]);

  const columns = [
    { key: 'employee_number', label: 'Employee #', sortable: true },
    {
      key: 'last_name',
      label: 'Name',
      sortable: true,
      render: (value, row) => `${row.first_name || ''} ${row.last_name || ''}`.trim() || '—',
    },
    { key: 'department', label: 'Department', sortable: true },
    { key: 'role', label: 'Role', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => <StatusBadge status={value === 'active' ? 'online' : value === 'inactive' ? 'offline' : 'pending'} label={value || 'unknown'} />,
    },
    {
      key: 'ppe_certified',
      label: 'PPE Certified',
      render: (value) => (
        <span className={`${styles.certBadge} ${value ? styles.certYes : styles.certNo}`}>
          {value ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {value ? 'Yes' : 'No'}
        </span>
      ),
    },
    {
      key: 'forklift_certified',
      label: 'Forklift Certified',
      render: (value) => (
        <span className={`${styles.certBadge} ${value ? styles.certYes : styles.certNo}`}>
          {value ? <CheckCircle size={14} /> : <XCircle size={14} />}
          {value ? 'Yes' : 'No'}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Employees</h1>
            <p className={styles.pageSubtitle}>Employee directory and safety compliance tracking</p>
          </div>
        </div>
        <div className={styles.loadingContainer}>
          <span className="loading-spinner" />
          <p>Loading employee records...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Employees</h1>
          <p className={styles.pageSubtitle}>Employee directory and safety compliance tracking</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-primary">
            <Plus size={16} />
            Add Employee
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className={styles.searchBar}>
        <Search size={16} className={styles.searchIcon} />
        <input
          className={`input ${styles.searchInput}`}
          type="text"
          placeholder="Search employees by name, ID, department, or role..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      {/* Employee Table */}
      <div className="card">
        {employees.length === 0 ? (
          <div className={styles.emptyState}>
            <Users size={48} />
            <p>No employee records found. Add employees to begin tracking safety compliance and time tracking.</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredEmployees}
            emptyMessage="No employees match your search."
            pageSize={15}
          />
        )}
      </div>
    </div>
  );
}
