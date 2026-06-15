'use client';

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import Link from 'next/link';
import {
  Monitor,
  ArrowLeft,
  Maximize,
  Minimize,
  Filter,
  Camera,
  ChevronLeft,
} from 'lucide-react';
import VideoPlayer from '@/app/components/ui/VideoPlayer';
import DEMO_CAMERA_FEEDS from '@/lib/demoCameraFeeds';
import styles from './page.module.css';

/** Grid layout presets */
const GRID_OPTIONS = [
  { label: '1×1', value: '1x1', cols: 1 },
  { label: '2×2', value: '2x2', cols: 2 },
  { label: '3×3', value: '3x3', cols: 3 },
  { label: '4×4', value: '4x4', cols: 4 },
  { label: '5×5', value: '5x5', cols: 5 },
];

const GRID_CLASS_MAP = {
  '1x1': 'grid1x1',
  '2x2': 'grid2x2',
  '3x3': 'grid3x3',
  '4x4': 'grid4x4',
  '5x5': 'grid5x5',
};

export default function ControlRoomPage() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gridLayout, setGridLayout] = useState('3x3');
  const [focusedCameraId, setFocusedCameraId] = useState(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [filterZone, setFilterZone] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentTime, setCurrentTime] = useState('');
  const containerRef = useRef(null);

  /* ---- Data Fetching ---- */
  const fetchCameras = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?facilityId=1');
      if (res.ok) {
        const data = await res.json();
        const realCameras = data.cameras || [];
        setCameras(realCameras.length > 0 ? realCameras : DEMO_CAMERA_FEEDS);
      } else {
        setCameras(DEMO_CAMERA_FEEDS);
      }
    } catch (error) {
      console.error('Failed to fetch cameras:', error);
      setCameras(DEMO_CAMERA_FEEDS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

  /* ---- Live clock ---- */
  useEffect(() => {
    const update = () =>
      setCurrentTime(
        new Date().toLocaleTimeString([], {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        })
      );
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, []);

  /* ---- Fullscreen API ---- */
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
  }, []);

  useEffect(() => {
    const onFSChange = () =>
      setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onFSChange);
    return () =>
      document.removeEventListener('fullscreenchange', onFSChange);
  }, []);

  /* ---- Filtering ---- */
  const zones = useMemo(() => {
    const set = new Set();
    cameras.forEach((c) => {
      if (c.zone) set.add(c.zone);
    });
    return Array.from(set).sort();
  }, [cameras]);

  const filteredCameras = useMemo(() => {
    return cameras.filter((cam) => {
      if (filterZone !== 'all' && cam.zone !== filterZone) return false;
      if (filterStatus !== 'all' && cam.status !== filterStatus)
        return false;
      return true;
    });
  }, [cameras, filterZone, filterStatus]);

  /* ---- Status counts ---- */
  const statusCounts = useMemo(() => {
    const counts = { total: cameras.length, online: 0, offline: 0, recording: 0 };
    cameras.forEach((cam) => {
      if (cam.status === 'online') {
        counts.online++;
        counts.recording++; // treat online cameras as recording
      } else if (cam.status === 'offline') {
        counts.offline++;
      }
    });
    return counts;
  }, [cameras]);

  /* ---- Focus camera ---- */
  const handleFeedClick = useCallback((cameraId) => {
    setFocusedCameraId(cameraId);
  }, []);

  const clearFocus = useCallback(() => {
    setFocusedCameraId(null);
  }, []);

  const focusedCamera = useMemo(
    () => filteredCameras.find((c) => c.id === focusedCameraId) || null,
    [filteredCameras, focusedCameraId]
  );

  const sidebarCameras = useMemo(
    () =>
      focusedCameraId
        ? filteredCameras.filter((c) => c.id !== focusedCameraId)
        : [],
    [filteredCameras, focusedCameraId]
  );

  /* ---- Grid class ---- */
  const gridClassName = styles[GRID_CLASS_MAP[gridLayout]] || styles.grid3x3;

  // Number of slots to show in empty state
  const gridSlotCount = {
    '1x1': 1, '2x2': 4, '3x3': 9, '4x4': 16, '5x5': 25,
  }[gridLayout] || 9;

  /* ---- Render ---- */
  return (
    <div
      ref={containerRef}
      className={`${styles.controlRoom} ${isFullscreen ? styles.isFullscreen : ''}`}
    >
      {/* ===== HEADER BAR ===== */}
      <header className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.titleGroup}>
            <Monitor size={16} className={styles.titleIcon} />
            <span className={styles.title}>Control Room</span>
          </div>
          <span className={styles.cameraBadge}>
            {filteredCameras.length} camera{filteredCameras.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Center — Grid selector */}
        <div className={styles.headerCenter}>
          <div className={styles.gridSelector}>
            {GRID_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                className={`${styles.gridBtn} ${gridLayout === opt.value ? styles.active : ''}`}
                onClick={() => {
                  setGridLayout(opt.value);
                  setFocusedCameraId(null);
                }}
                aria-label={`${opt.label} grid layout`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          <div className={styles.headerDivider} />

          {/* Zone filter */}
          <select
            className={styles.filterSelect}
            value={filterZone}
            onChange={(e) => setFilterZone(e.target.value)}
            aria-label="Filter by zone"
          >
            <option value="all">All Zones</option>
            {zones.map((z) => (
              <option key={z} value={z}>
                {z}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            className={styles.filterSelect}
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="all">All Status</option>
            <option value="online">Online</option>
            <option value="offline">Offline</option>
            <option value="pending_setup">Pending</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </div>

        {/* Right — Actions */}
        <div className={styles.headerRight}>
          <button
            className={`${styles.iconBtn} ${isFullscreen ? styles.active : ''}`}
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
            title={isFullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            {isFullscreen ? <Minimize size={16} /> : <Maximize size={16} />}
          </button>
          <Link href="/cameras" className={styles.backLink}>
            <ArrowLeft size={12} />
            Cameras
          </Link>
        </div>
      </header>

      {/* ===== MAIN CONTENT ===== */}
      <div className={styles.content}>
        {loading ? (
          <div className={styles.loadingState}>
            <span className="loading-spinner" />
            <p>Connecting to camera feeds…</p>
          </div>
        ) : filteredCameras.length === 0 ? (
          /* ===== EMPTY — Show placeholder dark boxes ===== */
          <div className={`${styles.cameraGrid} ${gridClassName}`}>
            {Array.from({ length: gridSlotCount }, (_, i) => (
              <div key={`slot-${i}`} className={styles.cameraTile}>
                <div className={styles.emptySlot}>
                  <Camera size={24} className={styles.emptySlotIcon} />
                </div>
              </div>
            ))}
          </div>
        ) : focusedCamera ? (
          /* ===== FOCUSED 1+N LAYOUT ===== */
          <div className={styles.focusedLayout}>
            <div className={styles.focusedMain}>
              <button
                className={styles.focusedBackBtn}
                onClick={clearFocus}
              >
                <ChevronLeft size={12} />
                Back to Grid
              </button>
              <VideoPlayer
                streamUrl={null}
                cameraName={focusedCamera.name}
                cameraId={String(focusedCamera.id)}
                status={focusedCamera.status || 'pending_setup'}
                compact={false}
                showControls={true}
                showLabel={true}
                autoPlay={true}
                muted={true}
                posterImage={focusedCamera.image}
              />
            </div>
            <div className={styles.focusedSidebar}>
              {sidebarCameras.map((cam) => (
                <div
                  key={cam.id}
                  className={styles.cameraTile}
                  onClick={() => handleFeedClick(cam.id)}
                >
                  <VideoPlayer
                    streamUrl={null}
                    cameraName={cam.name}
                    cameraId={String(cam.id)}
                    status={cam.status || 'pending_setup'}
                    compact={true}
                    showControls={false}
                    showLabel={true}
                    autoPlay={true}
                    muted={true}
                    onClickFeed={() => handleFeedClick(cam.id)}
                    posterImage={cam.image}
                  />
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* ===== NORMAL GRID ===== */
          <div className={`${styles.cameraGrid} ${gridClassName}`}>
            {filteredCameras.map((cam) => (
              <div
                key={cam.id}
                className={styles.cameraTile}
              >
                <VideoPlayer
                  streamUrl={null}
                  cameraName={cam.name}
                  cameraId={String(cam.id)}
                  status={cam.status || 'pending_setup'}
                  compact={true}
                  showControls={false}
                  showLabel={true}
                  autoPlay={true}
                  muted={true}
                  onClickFeed={handleFeedClick}
                  posterImage={cam.image}
                />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ===== STATUS BAR ===== */}
      <div className={styles.statusBar}>
        <span className={styles.statusItem}>
          Total: {statusCounts.total}
        </span>
        <span className={styles.statusItem}>
          <span className={`${styles.statusDot} ${styles.statusDotOnline}`} />
          Online: {statusCounts.online}
        </span>
        <span className={styles.statusItem}>
          <span className={`${styles.statusDot} ${styles.statusDotOffline}`} />
          Offline: {statusCounts.offline}
        </span>
        <span className={styles.statusItem}>
          <span className={`${styles.statusDot} ${styles.statusDotRecording}`} />
          Recording: {statusCounts.recording}
        </span>
        <span className={styles.statusSpacer} />
        <span className={styles.statusTimestamp}>{currentTime}</span>
      </div>
    </div>
  );
}
