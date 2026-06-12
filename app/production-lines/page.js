'use client';

import { useState, useEffect, useCallback } from 'react';
import { Factory, Plus, X, TrendingUp, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import ProductionLineCard from '@/app/components/ui/ProductionLineCard';
import CameraPlaceholder from '@/app/components/ui/CameraPlaceholder';
import styles from './page.module.css';

export default function ProductionLinesPage() {
  const [lines, setLines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedLine, setExpandedLine] = useState(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    line_number: '',
    type: 'conveyor',
    target_throughput: '',
  });

  const fetchLines = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?facilityId=1');
      if (res.ok) {
        const data = await res.json();
        setLines(data.productionLines || []);
      }
    } catch (error) {
      console.error('Failed to fetch production lines:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLines();
  }, [fetchLines]);

  const handleToggleExpand = (lineId) => {
    setExpandedLine((prev) => (prev === lineId ? null : lineId));
  };

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddLine = (e) => {
    e.preventDefault();
    setShowAddModal(false);
    setFormData({ name: '', line_number: '', type: 'conveyor', target_throughput: '' });
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Production Lines</h1>
            <p className={styles.pageSubtitle}>Conveyor belt monitoring and throughput tracking</p>
          </div>
        </div>
        <div className={styles.loadingContainer}>
          <span className="loading-spinner" />
          <p>Loading production lines...</p>
        </div>
      </div>
    );
  }

  const expandedLineData = expandedLine ? lines.find((l) => l.id === expandedLine) : null;

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Production Lines</h1>
          <p className={styles.pageSubtitle}>Conveyor belt monitoring and throughput tracking</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Add Production Line
          </button>
        </div>
      </div>

      {/* Content */}
      {lines.length === 0 ? (
        <div className={styles.emptyState}>
          <Factory size={48} />
          <p>No production lines configured. Add lines to monitor conveyor belt operations.</p>
        </div>
      ) : (
        <>
          {/* Expanded Detail */}
          {expandedLineData && (
            <div className={`card ${styles.detailCard}`}>
              <div className={styles.detailHeader}>
                <h3 className={styles.detailTitle}>
                  {expandedLineData.name} — Line {expandedLineData.line_number}
                </h3>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => setExpandedLine(null)}
                >
                  <ChevronUp size={16} />
                  Collapse
                </button>
              </div>
              <div className={styles.detailGrid}>
                <div className={styles.detailSection}>
                  <span className={styles.detailSectionTitle}>Line Camera</span>
                  <CameraPlaceholder
                    name={`${expandedLineData.name} Camera`}
                    location={`Production Line ${expandedLineData.line_number}`}
                    status="pending_setup"
                    cameraId={`line-cam-${expandedLineData.id}`}
                  />
                </div>
                <div className={styles.detailSection}>
                  <span className={styles.detailSectionTitle}>Throughput Chart</span>
                  <div className={styles.chartPlaceholder}>
                    <TrendingUp size={32} />
                    <p>Throughput chart will display here once data collection begins.</p>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 'var(--space-4)' }}>
                <span className={styles.detailSectionTitle}>Event History</span>
                <div className={styles.eventList}>
                  <div className={styles.eventItem}>
                    No events recorded for this production line yet.
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Lines Grid */}
          <div className={styles.linesGrid}>
            {lines.map((line) => (
              <div
                key={line.id}
                className={`${styles.lineCardWrapper} ${expandedLine === line.id ? styles.lineCardActive : ''}`}
                onClick={() => handleToggleExpand(line.id)}
              >
                <ProductionLineCard
                  name={line.name}
                  lineNumber={line.line_number}
                  status={line.status}
                  throughput={line.current_speed}
                  targetThroughput={line.target_throughput}
                  lastEvent={line.last_event}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add Production Line Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className={styles.modalTitle}>Add Production Line</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddLine}>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="line-name">Line Name</label>
                <input
                  id="line-name"
                  className="input"
                  type="text"
                  placeholder="e.g. Ground Beef Line A"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="line-number">Line Number</label>
                <input
                  id="line-number"
                  className="input"
                  type="number"
                  placeholder="e.g. 1"
                  value={formData.line_number}
                  onChange={(e) => handleFormChange('line_number', e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="line-type">Type</label>
                <select
                  id="line-type"
                  className="input select"
                  value={formData.type}
                  onChange={(e) => handleFormChange('type', e.target.value)}
                >
                  <option value="conveyor">Conveyor</option>
                  <option value="processing">Processing</option>
                  <option value="packaging">Packaging</option>
                  <option value="cold_chain">Cold Chain</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="line-throughput">Target Throughput</label>
                <input
                  id="line-throughput"
                  className="input"
                  type="number"
                  placeholder="e.g. 500"
                  value={formData.target_throughput}
                  onChange={(e) => handleFormChange('target_throughput', e.target.value)}
                />
              </div>
              <div className={styles.formActions}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={16} />
                  Add Line
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
