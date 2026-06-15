'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  MapPin,
  Grid2x2,
  Square,
  Pause,
  Play,
} from 'lucide-react';
import styles from './CameraFeedGrid.module.css';

const AUTO_CYCLE_MS = 5000;

const DEFAULT_CAMERAS = [
  { id: 'cam-01', name: 'Camera 1', location: 'Main Floor — Line 1', image: '/camera-feeds/cam-01.png' },
  { id: 'cam-02', name: 'Camera 2', location: 'Main Floor — Line 2', image: '/camera-feeds/cam-02.png' },
  { id: 'cam-03', name: 'Camera 3', location: 'Entrance — Loading Dock', image: '/camera-feeds/cam-03.png' },
  { id: 'cam-04', name: 'Camera 4', location: 'Hazard Zone — Cold Storage', image: '/camera-feeds/cam-04.png' },
  { id: 'cam-05', name: 'Camera 5', location: 'Packaging Area — East', image: '/camera-feeds/cam-05.png' },
  { id: 'cam-06', name: 'Camera 6', location: 'Packaging Area — West', image: '/camera-feeds/cam-06.png' },
  { id: 'cam-07', name: 'Camera 7', location: 'Quality Control Station', image: '/camera-feeds/cam-07.png' },
  { id: 'cam-08', name: 'Camera 8', location: 'Employee Break Room', image: '/camera-feeds/cam-08.png' },
  { id: 'cam-09', name: 'Camera 9', location: 'Shipping Bay — North', image: '/camera-feeds/cam-09.png' },
  { id: 'cam-10', name: 'Camera 10', location: 'Shipping Bay — South', image: '/camera-feeds/cam-10.png' },
  { id: 'cam-11', name: 'Camera 11', location: 'Maintenance Corridor', image: '/camera-feeds/cam-11.png' },
  { id: 'cam-12', name: 'Camera 12', location: 'Exterior — Parking Lot', image: '/camera-feeds/cam-12.png' },
  { id: 'cam-13', name: 'Camera 13', location: 'Forklift Zone — A', image: '/camera-feeds/cam-13.png' },
  { id: 'cam-14', name: 'Camera 14', location: 'Forklift Zone — B', image: '/camera-feeds/cam-14.png' },
  { id: 'cam-15', name: 'Camera 15', location: 'Office Hallway', image: '/camera-feeds/cam-15.png' },
  { id: 'cam-16', name: 'Camera 16', location: 'Roof — Overview', image: '/camera-feeds/cam-16.png' },
];

/** Single camera tile with overlay */
function CameraTile({ cam, compact = false }) {
  return (
    <div className={styles.tile}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={cam.image} alt={`${cam.name} — ${cam.location}`} className={styles.tileImage} />


      {/* Expand link */}
      <Link
        href={`/cameras/${cam.id}`}
        className={styles.expandBtn}
        aria-label={`Open ${cam.name} fullscreen`}
      >
        <Maximize2 size={compact ? 12 : 14} />
      </Link>

      {/* Bottom info */}
      <div className={styles.tileBottomBar}>
        <span className={styles.tileName}>{cam.name}</span>
        {!compact && (
          <span className={styles.tileLocation}>
            <MapPin size={9} />
            {cam.location}
          </span>
        )}
      </div>
    </div>
  );
}

export default function CameraFeedGrid({ cameras }) {
  const cams = cameras && cameras.length > 0 ? cameras : DEFAULT_CAMERAS;
  const [pageIndex, setPageIndex] = useState(0);   // which "page" of cameras we're on
  const [viewMode, setViewMode] = useState('2x2');  // '1x1' or '2x2'
  const [paused, setPaused] = useState(false);
  const thumbStripRef = useRef(null);
  const timerRef = useRef(null);

  const perPage = viewMode === '2x2' ? 4 : 1;
  const totalPages = Math.ceil(cams.length / perPage);

  // Clamp pageIndex when switching modes
  useEffect(() => {
    setPageIndex((prev) => Math.min(prev, totalPages - 1));
  }, [totalPages]);

  // Get current visible cameras
  const startIdx = pageIndex * perPage;
  const visibleCams = cams.slice(startIdx, startIdx + perPage);

  // Auto-cycle
  useEffect(() => {
    if (paused) return;
    timerRef.current = setInterval(() => {
      setPageIndex((prev) => (prev + 1) % totalPages);
    }, AUTO_CYCLE_MS);
    return () => clearInterval(timerRef.current);
  }, [paused, totalPages]);

  // Scroll thumbnail strip to keep active page visible
  useEffect(() => {
    if (!thumbStripRef.current) return;
    const strip = thumbStripRef.current;
    const firstThumbIdx = pageIndex * perPage;
    const activeThumb = strip.children[firstThumbIdx];
    if (activeThumb) {
      const stripRect = strip.getBoundingClientRect();
      const thumbRect = activeThumb.getBoundingClientRect();
      if (thumbRect.left < stripRect.left || thumbRect.right > stripRect.right) {
        activeThumb.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, [pageIndex, perPage]);

  const handlePrev = useCallback(() => {
    setPageIndex((prev) => (prev === 0 ? totalPages - 1 : prev - 1));
  }, [totalPages]);

  const handleNext = useCallback(() => {
    setPageIndex((prev) => (prev + 1) % totalPages);
  }, [totalPages]);

  const handleThumbClick = useCallback((camIndex) => {
    const page = Math.floor(camIndex / perPage);
    setPageIndex(page);
  }, [perPage]);

  const isThumbInCurrentPage = (i) => {
    return i >= startIdx && i < startIdx + perPage;
  };

  return (
    <div className={styles.container}>
      {/* Toolbar: view mode toggle + play/pause */}
      <div className={styles.toolbar}>
        <div className={styles.viewToggle}>
          <button
            className={`${styles.viewBtn} ${viewMode === '1x1' ? styles.viewBtnActive : ''}`}
            onClick={() => setViewMode('1x1')}
            aria-label="Single camera view"
            type="button"
          >
            <Square size={14} />
            <span>1×1</span>
          </button>
          <button
            className={`${styles.viewBtn} ${viewMode === '2x2' ? styles.viewBtnActive : ''}`}
            onClick={() => setViewMode('2x2')}
            aria-label="Quad camera view"
            type="button"
          >
            <Grid2x2 size={14} />
            <span>2×2</span>
          </button>
        </div>

        <div className={styles.toolbarRight}>
          <button
            className={styles.playPauseBtn}
            onClick={() => setPaused((p) => !p)}
            aria-label={paused ? 'Resume auto-cycle' : 'Pause auto-cycle'}
            type="button"
          >
            {paused ? <Play size={13} /> : <Pause size={13} />}
            <span>{paused ? 'Play' : 'Auto'}</span>
          </button>
          <span className={styles.pageCounter}>
            {pageIndex + 1} / {totalPages}
          </span>
        </div>
      </div>

      {/* Camera View */}
      <div className={styles.viewArea}>
        <div className={viewMode === '2x2' ? styles.grid2x2 : styles.grid1x1}>
          {visibleCams.map((cam) => (
            <CameraTile key={cam.id} cam={cam} compact={viewMode === '2x2'} />
          ))}
        </div>

        {/* Prev / Next arrows */}
        <button
          className={`${styles.arrowBtn} ${styles.arrowLeft}`}
          onClick={handlePrev}
          aria-label="Previous"
        >
          <ChevronLeft size={16} />
        </button>
        <button
          className={`${styles.arrowBtn} ${styles.arrowRight}`}
          onClick={handleNext}
          aria-label="Next"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Thumbnail Strip */}
      <div className={styles.thumbStrip} ref={thumbStripRef}>
        {cams.map((cam, i) => (
          <button
            key={cam.id}
            className={`${styles.thumb} ${isThumbInCurrentPage(i) ? styles.thumbActive : ''}`}
            onClick={() => handleThumbClick(i)}
            aria-label={`Switch to ${cam.name}`}
            type="button"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={cam.image} alt={cam.name} className={styles.thumbImage} />
            <span className={styles.thumbLabel}>{cam.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
