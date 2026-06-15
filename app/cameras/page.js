'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Camera,
  LayoutGrid,
  List,
  Search,
  Monitor,
  Wifi,
  WifiOff,
  CircleDot,
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
  const [searchQuery, setSearchQuery] = useState('');

  const fetchCameras = useCallback(async () => {
    try {
      const res = await fetch('/api/cameras?facilityId=1');
      if (res.ok) {
        const data = await res.json();
        const cameraList = (data.data || []).map(cam => {
          const config = typeof cam.config === 'string' ? JSON.parse(cam.config) : (cam.config || {});
          return {
            ...cam,
            image: config.image || null,
            zone: config.zone || cam.camera_type || 'Floor',
          };
        });
        setCameras(cameraList);
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

  /* ---------- Status counts ---------- */
  const statusCounts = useMemo(() => {
    const counts = { total: cameras.length, online: 0, offline: 0, pending: 0 };
    cameras.forEach((cam) => {
      const s = (cam.status || '').toLowerCase();
      if (s === 'online') counts.online++;
      else if (s === 'offline') counts.offline++;
      else if (s === 'pending_setup' || s === 'pending') counts.pending++;
    });
    return counts;
  }, [cameras]);

  /* ---------- Filtered cameras (category + search) ---------- */
  const filteredCameras = useMemo(() => {
    let result = cameras;

    // Category filter
    if (activeFilter !== 'All') {
      result = result.filter((cam) => {
        const zone = (cam.zone || cam.camera_type || '').toLowerCase();
        return zone.includes(activeFilter.toLowerCase());
      });
    }

    // Search filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (cam) =>
          (cam.name || '').toLowerCase().includes(q) ||
          (cam.location_description || '').toLowerCase().includes(q)
      );
    }

    return result;
  }, [cameras, activeFilter, searchQuery]);

  const gridClass =
    gridLayout === '3x3'
      ? styles.grid3x3
      : gridLayout === '4x4'
      ? styles.grid4x4
      : styles.grid2x2;

  // Number of slots to fill the grid with placeholder boxes
  const gridSlotCount = gridLayout === '4x4' ? 16 : gridLayout === '3x3' ? 9 : 4;



  /* ---------- Loading state ---------- */
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
          <Link href="/cameras/control-room" className="btn btn-secondary">
            <Monitor size={16} />
            Control Room
          </Link>
        </div>
      </div>

      {/* Status Summary Bar */}
      <div className={styles.statusSummary}>
        <div className={`${styles.statTile} ${styles.statTileTotal}`}>
          <div className={`${styles.statIcon} ${styles.statIconTotal}`}>
            <Camera size={16} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{statusCounts.total}</span>
            <span className={styles.statLabel}>Total Cameras</span>
          </div>
        </div>
        <div className={`${styles.statTile} ${styles.statTileOnline}`}>
          <div className={`${styles.statIcon} ${styles.statIconOnline}`}>
            <Wifi size={16} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{statusCounts.online}</span>
            <span className={styles.statLabel}>Online</span>
          </div>
        </div>
        <div className={`${styles.statTile} ${styles.statTileOffline}`}>
          <div className={`${styles.statIcon} ${styles.statIconOffline}`}>
            <WifiOff size={16} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{statusCounts.offline}</span>
            <span className={styles.statLabel}>Offline</span>
          </div>
        </div>
        <div className={`${styles.statTile} ${styles.statTilePending}`}>
          <div className={`${styles.statIcon} ${styles.statIconPending}`}>
            <CircleDot size={16} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{statusCounts.pending}</span>
            <span className={styles.statLabel}>Pending Setup</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          {/* Search */}
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>
              <Search size={15} />
            </span>
            <input
              type="text"
              className={`input ${styles.searchInput}`}
              placeholder="Search cameras..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search cameras by name or location"
            />
          </div>

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

      {/* Results count */}
      {(searchQuery || activeFilter !== 'All') && (
        <p className={styles.resultsCount}>
          Showing {filteredCameras.length} of {cameras.length} camera{cameras.length !== 1 ? 's' : ''}
          {searchQuery && <> matching &ldquo;{searchQuery}&rdquo;</>}
        </p>
      )}

      {/* Content */}
      {viewMode === 'grid' ? (
        <div className={`${styles.cameraGrid} ${gridClass}`}>
          {filteredCameras.length > 0 ? (
            filteredCameras.map((cam) => (
              <div key={cam.id} className={styles.gridTile}>
                <CameraPlaceholder
                  name={cam.name}
                  location={cam.location_description}
                  status={cam.status}
                  cameraId={cam.id}
                  image={cam.image}
                />
              </div>
            ))
          ) : (
            /* Show black placeholder boxes filling the grid */
            Array.from({ length: gridSlotCount }, (_, i) => (
              <div key={`slot-${i}`} className={styles.gridTile}>
                <div className={styles.emptySlot}>
                  <Camera size={28} className={styles.emptySlotIcon} />
                  <span className={styles.emptySlotLabel}>No Camera</span>
                </div>
              </div>
            ))
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

    </div>
  );
}
