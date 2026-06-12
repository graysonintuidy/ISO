'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { AlertTriangle, Plus, X } from 'lucide-react';
import DataTable from '@/app/components/ui/DataTable';
import styles from './page.module.css';

export default function IncidentsPage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [filters, setFilters] = useState({
    severity: 'all',
    type: 'all',
    status: 'all',
    dateFrom: '',
    dateTo: '',
  });

  const fetchIncidents = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?facilityId=1');
      if (res.ok) {
        const data = await res.json();
        setIncidents(data.incidents || []);
      }
    } catch (error) {
      console.error('Failed to fetch incidents:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  const handleFilterChange = (field, value) => {
    setFilters((prev) => ({ ...prev, [field]: value }));
  };

  const filteredIncidents = useMemo(() => {
    return incidents.filter((incident) => {
      if (filters.severity !== 'all' && incident.severity !== filters.severity) return false;
      if (filters.type !== 'all' && incident.incident_type !== filters.type) return false;
      if (filters.status !== 'all' && incident.status !== filters.status) return false;
      if (filters.dateFrom && incident.created_at && new Date(incident.created_at) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo && incident.created_at && new Date(incident.created_at) > new Date(filters.dateTo)) return false;
      return true;
    });
  }, [incidents, filters]);

  const uniqueTypes = useMemo(
    () => [...new Set(incidents.map((i) => i.incident_type).filter(Boolean))],
    [incidents]
  );

  const columns = [
    {
      key: 'severity',
      label: 'Severity',
      sortable: true,
      render: (value) => (
        <span
          className={`badge badge-${
            value === 'critical' ? 'error' : value === 'high' ? 'warning' : value === 'medium' ? 'info' : 'neutral'
          }`}
        >
          {value || '—'}
        </span>
      ),
    },
    { key: 'title', label: 'Incident', sortable: true },
    { key: 'incident_type', label: 'Type', sortable: true },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      render: (value) => (
        <span
          className={`badge ${
            value === 'open' ? 'badge-error' : value === 'investigating' ? 'badge-warning' : value === 'resolved' ? 'badge-success' : 'badge-neutral'
          }`}
        >
          {value || '—'}
        </span>
      ),
    },
    {
      key: 'location',
      label: 'Location',
      sortable: true,
      render: (value) => value || '—',
    },
    {
      key: 'created_at',
      label: 'Time',
      sortable: true,
      render: (value) => (value ? new Date(value).toLocaleString() : '—'),
    },
  ];

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleString();
    } catch {
      return '—';
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Incidents</h1>
            <p className={styles.pageSubtitle}>Incident reports and safety event tracking</p>
          </div>
        </div>
        <div className={styles.loadingContainer}>
          <span className="loading-spinner" />
          <p>Loading incidents...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Incidents</h1>
          <p className={styles.pageSubtitle}>Incident reports and safety event tracking</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-primary">
            <Plus size={16} />
            Create Incident
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      {incidents.length > 0 && (
        <div className={styles.filterBar}>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Severity</span>
            <select
              className={`input select ${styles.filterSelect}`}
              value={filters.severity}
              onChange={(e) => handleFilterChange('severity', e.target.value)}
            >
              <option value="all">All</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Type</span>
            <select
              className={`input select ${styles.filterSelect}`}
              value={filters.type}
              onChange={(e) => handleFilterChange('type', e.target.value)}
            >
              <option value="all">All</option>
              {uniqueTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className={styles.filterGroup}>
            <span className={styles.filterLabel}>Status</span>
            <select
              className={`input select ${styles.filterSelect}`}
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
            >
              <option value="all">All</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
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

      {/* Incident Table */}
      <div className="card">
        {incidents.length === 0 ? (
          <div className={styles.emptyState}>
            <AlertTriangle size={48} />
            <p>No incidents recorded. Incident reports from AI detection, zone breaches, and manual entries will appear here.</p>
          </div>
        ) : (
          <DataTable
            columns={columns}
            data={filteredIncidents}
            emptyMessage="No incidents match the selected filters."
            onRowClick={(row) => setSelectedIncident(row)}
            pageSize={15}
          />
        )}
      </div>

      {/* Incident Detail Panel */}
      {selectedIncident && (
        <div className={styles.detailOverlay} onClick={() => setSelectedIncident(null)}>
          <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.detailHeader}>
              <div>
                <h3 className={styles.detailTitle}>{selectedIncident.title || 'Incident Details'}</h3>
                <span className={styles.detailMeta}>
                  ID: {selectedIncident.id} • {formatDate(selectedIncident.created_at)}
                </span>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={() => setSelectedIncident(null)}>
                <X size={18} />
              </button>
            </div>

            <div className={styles.detailBadges}>
              <span
                className={`badge badge-${
                  selectedIncident.severity === 'critical' ? 'error' : selectedIncident.severity === 'high' ? 'warning' : 'info'
                }`}
              >
                {selectedIncident.severity || 'unknown'}
              </span>
              <span className={`badge ${selectedIncident.status === 'open' ? 'badge-error' : selectedIncident.status === 'resolved' ? 'badge-success' : 'badge-warning'}`}>
                {selectedIncident.status || 'unknown'}
              </span>
              {selectedIncident.incident_type && (
                <span className="badge badge-neutral">{selectedIncident.incident_type}</span>
              )}
            </div>

            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>Description</div>
              <div className={styles.detailContent}>
                {selectedIncident.description || 'No description provided.'}
              </div>
            </div>

            {selectedIncident.location && (
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Location</div>
                <div className={styles.detailContent}>{selectedIncident.location}</div>
              </div>
            )}

            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>Evidence</div>
              <div className={styles.detailContent}>
                {selectedIncident.evidence || 'No evidence attached.'}
              </div>
            </div>

            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>Resolution</div>
              <div className={styles.detailContent}>
                {selectedIncident.resolution || 'No resolution recorded yet.'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
