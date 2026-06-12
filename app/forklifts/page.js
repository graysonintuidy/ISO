'use client';

import { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, User, Calendar, Wrench } from 'lucide-react';
import StatusBadge from '@/app/components/ui/StatusBadge';
import styles from './page.module.css';

export default function ForkliftsPage() {
  const [forklifts, setForklifts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchForklifts = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?facilityId=1');
      if (res.ok) {
        const data = await res.json();
        setForklifts(data.forklifts || []);
      }
    } catch (error) {
      console.error('Failed to fetch forklifts:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchForklifts();
  }, [fetchForklifts]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '—';
    try {
      return new Date(dateStr).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return '—';
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Forklifts</h1>
            <p className={styles.pageSubtitle}>Fleet monitoring and driver behavior tracking</p>
          </div>
        </div>
        <div className={styles.loadingContainer}>
          <span className="loading-spinner" />
          <p>Loading forklift fleet...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Forklifts</h1>
          <p className={styles.pageSubtitle}>Fleet monitoring and driver behavior tracking</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-primary">
            <Plus size={16} />
            Add Forklift
          </button>
        </div>
      </div>

      {/* Content */}
      {forklifts.length === 0 ? (
        <div className={styles.emptyState}>
          <Truck size={48} />
          <p>No forklifts registered. Add your fleet vehicles to monitor driver behavior and maintenance schedules.</p>
        </div>
      ) : (
        <div className={styles.forkliftGrid}>
          {forklifts.map((forklift) => (
            <div key={forklift.id} className={`card ${styles.forkliftCard}`}>
              <div className={styles.forkliftHeader}>
                <div className={styles.forkliftUnit}>
                  <Truck size={24} className={styles.forkliftIcon} />
                  <div>
                    <div className={styles.forkliftUnitNumber}>
                      {forklift.unit_number || `Unit ${forklift.id}`}
                    </div>
                    <div className={styles.forkliftModel}>{forklift.model || 'Unknown Model'}</div>
                  </div>
                </div>
                <StatusBadge
                  status={forklift.status === 'active' ? 'online' : forklift.status === 'maintenance' ? 'maintenance' : 'offline'}
                  label={forklift.status || 'unknown'}
                />
              </div>
              <div className={styles.forkliftDetails}>
                <div className={styles.forkliftDetail}>
                  <span className={styles.detailLabel}>
                    <User size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    Current Driver
                  </span>
                  <span className={styles.detailValue}>{forklift.current_driver || 'Unassigned'}</span>
                </div>
                <div className={styles.forkliftDetail}>
                  <span className={styles.detailLabel}>
                    <Wrench size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    Last Inspection
                  </span>
                  <span className={styles.detailValue}>{formatDate(forklift.last_inspection)}</span>
                </div>
                <div className={styles.forkliftDetail}>
                  <span className={styles.detailLabel}>
                    <Calendar size={12} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                    Next Inspection
                  </span>
                  <span className={styles.detailValue}>{formatDate(forklift.next_inspection)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
