'use client';

import { useState, useEffect, useCallback } from 'react';
import { ShieldAlert, Map, BarChart3 } from 'lucide-react';
import DataTable from '@/app/components/ui/DataTable';
import styles from './page.module.css';

const zoneColumns = [
  { key: 'name', label: 'Zone Name', sortable: true },
  { key: 'zone_type', label: 'Type', sortable: true },
  {
    key: 'alert_on_entry',
    label: 'Alert on Entry',
    sortable: true,
    render: (value) => (
      <span className={`badge ${value ? 'badge-warning' : 'badge-neutral'}`}>
        {value ? 'Yes' : 'No'}
      </span>
    ),
  },
  {
    key: 'color',
    label: 'Color',
    render: (value) =>
      value ? (
        <span className={styles.colorDot} style={{ backgroundColor: value }} />
      ) : (
        '—'
      ),
  },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (value) => (
      <span className={`badge ${value === 'active' ? 'badge-success' : 'badge-neutral'}`}>
        {value || 'inactive'}
      </span>
    ),
  },
];

export default function SafetyZonesPage() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchZones = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?facilityId=1');
      if (res.ok) {
        const data = await res.json();
        // Zones may come from a dedicated endpoint in the future
        setZones(data.zones || []);
      }
    } catch (error) {
      console.error('Failed to fetch safety zones:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchZones();
  }, [fetchZones]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Safety Zones</h1>
            <p className={styles.pageSubtitle}>Geofencing and zone breach detection</p>
          </div>
        </div>
        <div className={styles.loadingContainer}>
          <span className="loading-spinner" />
          <p>Loading safety zones...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Safety Zones</h1>
          <p className={styles.pageSubtitle}>Geofencing and zone breach detection</p>
        </div>
      </div>

      {/* Floor Plan Placeholder */}
      <div className={`card ${styles.floorPlanContainer}`}>
        <div className="card-header">
          <span className="card-title">Facility Floor Plan</span>
        </div>
        <div className={styles.floorPlanPlaceholder}>
          <Map size={56} />
          <p>
            Facility floor plan will be configured here. Upload a floor plan in Settings to enable
            zone mapping.
          </p>
        </div>
      </div>

      {/* Compliance Score Section */}
      <div className={`card ${styles.complianceSection}`}>
        <div className="card-header">
          <span className="card-title">Compliance Score</span>
        </div>
        <div className={styles.complianceGrid}>
          <div className={styles.complianceCard}>
            <div className={styles.complianceValue}>—</div>
            <div className={styles.complianceLabel}>Overall Score</div>
          </div>
          <div className={styles.complianceCard}>
            <div className={styles.complianceValue}>0</div>
            <div className={styles.complianceLabel}>Active Zones</div>
          </div>
          <div className={styles.complianceCard}>
            <div className={styles.complianceValue}>0</div>
            <div className={styles.complianceLabel}>Breaches Today</div>
          </div>
          <div className={styles.complianceCard}>
            <div className={styles.complianceValue}>0</div>
            <div className={styles.complianceLabel}>Days Without Breach</div>
          </div>
        </div>
      </div>

      {/* Zone List */}
      <div className={`card ${styles.zoneSection}`}>
        <div className="card-header">
          <span className="card-title">Zone Configuration</span>
        </div>
        {zones.length === 0 ? (
          <div className={styles.emptyState}>
            <ShieldAlert size={48} />
            <p>
              No safety zones defined. Configure geofencing boundaries in Settings to enable zone
              breach detection.
            </p>
          </div>
        ) : (
          <DataTable
            columns={zoneColumns}
            data={zones}
            emptyMessage="No safety zones configured."
            pageSize={15}
          />
        )}
      </div>
    </div>
  );
}
