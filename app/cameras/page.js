'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  Grid2x2,
  Grid3x3,
  LayoutGrid,
  List,
  Plus,
  X,
} from 'lucide-react';
import CameraPlaceholder from '@/app/components/ui/CameraPlaceholder';
import DataTable from '@/app/components/ui/DataTable';
import StatusBadge from '@/app/components/ui/StatusBadge';
import styles from './page.module.css';

const CATEGORIES = ['All', 'Floor', 'Line', 'Entrance', 'Hazard Zone'];

const GRID_OPTIONS = [
  { label: '2×2', value: '2x2', cols: 2 },
  { label: '3×3', value: '3x3', cols: 3 },
  { label: '4×4', value: '4x4', cols: 4 },
];

const cameraTableColumns = [
  { key: 'name', label: 'Name', sortable: true },
  { key: 'location_description', label: 'Location', sortable: true },
  { key: 'camera_type', label: 'Type', sortable: true },
  { key: 'zone', label: 'Zone', sortable: true },
  {
    key: 'status',
    label: 'Status',
    sortable: true,
    render: (value) => <StatusBadge status={value || 'offline'} />,
  },
];

export default function CamerasPage() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gridLayout, setGridLayout] = useState('2x2');
  const [viewMode, setViewMode] = useState('grid');
  const [activeFilter, setActiveFilter] = useState('All');
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location_description: '',
    camera_type: 'fixed',
    zone: '',
  });

  const fetchCameras = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?facilityId=1');
      if (res.ok) {
        const data = await res.json();
        setCameras(data.cameras || []);
      }
    } catch (error) {
      console.error('Failed to fetch cameras:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  const filteredCameras = activeFilter === 'All'
    ? cameras
    : cameras.filter((cam) => {
        const zone = (cam.zone || cam.camera_type || '').toLowerCase();
        return zone.includes(activeFilter.toLowerCase());
      });

  const gridClass =
    gridLayout === '3x3'
      ? styles.grid3x3
      : gridLayout === '4x4'
      ? styles.grid4x4
      : styles.grid2x2;

  const handleFormChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleAddCamera = (e) => {
    e.preventDefault();
    // POST to API would happen here
    setShowAddModal(false);
    setFormData({ name: '', location_description: '', camera_type: 'fixed', zone: '' });
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Cameras</h1>
            <p className={styles.pageSubtitle}>Manage surveillance feeds across the facility</p>
          </div>
        </div>
        <div className={styles.loadingContainer}>
          <span className="loading-spinner" />
          <p>Loading cameras...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Cameras</h1>
          <p className={styles.pageSubtitle}>Manage surveillance feeds across the facility</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
            <Plus size={16} />
            Add Camera
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {/* Category Filters */}
          <div className={styles.filters}>
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                className={`${styles.filterBtn} ${activeFilter === cat ? styles.filterBtnActive : ''}`}
                onClick={() => setActiveFilter(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className={styles.toolbarRight}>
          {/* Grid Layout Selector */}
          {viewMode === 'grid' && (
            <div className={styles.gridSelector}>
              {GRID_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  className={`${styles.gridBtn} ${gridLayout === opt.value ? styles.gridBtnActive : ''}`}
                  onClick={() => setGridLayout(opt.value)}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {/* View Mode Toggle */}
          <div className={styles.viewToggle}>
            <button
              className={`${styles.viewBtn} ${viewMode === 'grid' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('grid')}
              aria-label="Grid view"
            >
              <LayoutGrid size={16} />
            </button>
            <button
              className={`${styles.viewBtn} ${viewMode === 'table' ? styles.viewBtnActive : ''}`}
              onClick={() => setViewMode('table')}
              aria-label="Table view"
            >
              <List size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {cameras.length === 0 ? (
        <div className={styles.emptyState}>
          <Camera size={48} />
          <p>No cameras registered yet. Click Add Camera to begin setting up surveillance feeds.</p>
        </div>
      ) : viewMode === 'grid' ? (
        <div className={`${styles.cameraGrid} ${gridClass}`}>
          {filteredCameras.map((cam) => (
            <CameraPlaceholder
              key={cam.id}
              name={cam.name}
              location={cam.location_description}
              status={cam.status}
              cameraId={cam.id}
            />
          ))}
          {filteredCameras.length === 0 && (
            <div className={styles.emptyState}>
              <Camera size={40} />
              <p>No cameras match the selected filter.</p>
            </div>
          )}
        </div>
      ) : (
        <div className="card">
          <DataTable
            columns={cameraTableColumns}
            data={filteredCameras}
            emptyMessage="No cameras match the selected filter."
            pageSize={15}
          />
        </div>
      )}

      {/* Add Camera Modal */}
      {showAddModal && (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 className={styles.modalTitle}>Add Camera</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowAddModal(false)}>
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleAddCamera}>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="cam-name">Camera Name</label>
                <input
                  id="cam-name"
                  className="input"
                  type="text"
                  placeholder="e.g. Main Floor Camera 1"
                  value={formData.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="cam-location">Location</label>
                <input
                  id="cam-location"
                  className="input"
                  type="text"
                  placeholder="e.g. Main Floor — Line 1"
                  value={formData.location_description}
                  onChange={(e) => handleFormChange('location_description', e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="cam-type">Camera Type</label>
                <select
                  id="cam-type"
                  className="input select"
                  value={formData.camera_type}
                  onChange={(e) => handleFormChange('camera_type', e.target.value)}
                >
                  <option value="fixed">Fixed</option>
                  <option value="ptz">PTZ</option>
                  <option value="dome">Dome</option>
                  <option value="thermal">Thermal</option>
                </select>
              </div>
              <div className={styles.formGroup}>
                <label className="label" htmlFor="cam-zone">Zone</label>
                <input
                  id="cam-zone"
                  className="input"
                  type="text"
                  placeholder="e.g. Floor, Entrance, Hazard Zone"
                  value={formData.zone}
                  onChange={(e) => handleFormChange('zone', e.target.value)}
                />
              </div>
              <div className={styles.formActions}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  <Plus size={16} />
                  Add Camera
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
