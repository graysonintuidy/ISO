'use client';

import { useState, useMemo } from 'react';
import {
  ScanEye,
  Camera,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Search,
  Eye,
  X,
  Check,
  Clock,
  ChevronUp,
  Wifi,
  WifiOff,
  Activity,
} from 'lucide-react';
import DEMO_PRODUCTION_CAMERAS from '@/lib/demoProductionCameras';
import styles from './page.module.css';

/* ---------- Constants ---------- */
const FILTER_OPTIONS = [
  { key: 'All', label: 'All' },
  { key: 'clear', label: 'Clear' },
  { key: 'warning', label: 'Warning' },
  { key: 'critical', label: 'Critical' },
];

const GRID_OPTIONS = [
  { label: '2×2', value: '2x2' },
  { label: '3×3', value: '3x3' },
];

/* ---------- Helpers ---------- */
function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function severityIcon(severity, size = 14) {
  switch (severity) {
    case 'critical':
      return <AlertOctagon size={size} />;
    case 'warning':
      return <AlertTriangle size={size} />;
    default:
      return <Eye size={size} />;
  }
}

/* ---------- SVG Gauge Component ---------- */
function ConfidenceGauge({ value, aiStatus }) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  let fillClass = styles.gaugeFillSuccess;
  if (aiStatus === 'warning') fillClass = styles.gaugeFillWarning;
  if (aiStatus === 'critical') fillClass = styles.gaugeFillCritical;

  return (
    <div className={styles.gaugeCard}>
      <div className={styles.gaugeTitle}>AI Confidence</div>
      <div className={styles.gaugeWrap}>
        <svg className={styles.gaugeSvg} viewBox="0 0 120 120">
          <circle className={styles.gaugeTrack} cx="60" cy="60" r={radius} />
          <circle
            className={`${styles.gaugeFill} ${fillClass}`}
            cx="60"
            cy="60"
            r={radius}
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className={styles.gaugeValueLabel}>
          <span className={styles.gaugePercent}>
            {value.toFixed(1)}
            <span className={styles.gaugePercentUnit}>%</span>
          </span>
        </div>
      </div>
      <div className={styles.gaugeLabel}>Model certainty score</div>
    </div>
  );
}

/* ============================================================
   MAIN PAGE COMPONENT
   ============================================================ */
export default function ProductionLineCamerasPage() {
  const [cameras, setCameras] = useState(DEMO_PRODUCTION_CAMERAS);
  const [gridLayout, setGridLayout] = useState('3x3');
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCameraId, setSelectedCameraId] = useState(null);

  /* ---------- Computed values ---------- */
  const statusCounts = useMemo(() => {
    const uniqueLines = new Set(cameras.map((c) => c.lineNumber));
    const totalDetections = cameras.reduce((sum, c) => sum + c.detections, 0);
    const onlineCount = cameras.filter((c) => c.status === 'online').length;
    const uptime = cameras.length > 0 ? ((onlineCount / cameras.length) * 100).toFixed(1) : '0.0';
    return {
      total: cameras.length,
      lines: uniqueLines.size,
      detections: totalDetections,
      uptime,
    };
  }, [cameras]);

  /* ---------- Filtered cameras ---------- */
  const filteredCameras = useMemo(() => {
    let result = cameras;

    if (activeFilter !== 'All') {
      result = result.filter((cam) => cam.aiStatus === activeFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (cam) =>
          cam.name.toLowerCase().includes(q) ||
          cam.line.toLowerCase().includes(q) ||
          cam.location.toLowerCase().includes(q)
      );
    }
    return result;
  }, [cameras, activeFilter, searchQuery]);

  /* ---------- All events across all cameras ---------- */
  const allEvents = useMemo(() => {
    const events = [];
    cameras.forEach((cam) => {
      cam.events.forEach((evt) => {
        events.push({ ...evt, cameraName: cam.name, cameraId: cam.id });
      });
    });
    events.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return events;
  }, [cameras]);

  /* ---------- Selected camera ---------- */
  const selectedCamera = selectedCameraId ? cameras.find((c) => c.id === selectedCameraId) : null;

  /* ---------- Handlers ---------- */
  const handleResolveEvent = (cameraId, eventId) => {
    setCameras((prev) =>
      prev.map((cam) => {
        if (cam.id !== cameraId) return cam;
        return {
          ...cam,
          events: cam.events.map((evt) =>
            evt.id === eventId ? { ...evt, resolved: true } : evt
          ),
        };
      })
    );
  };

  const handleDismissEvent = (cameraId, eventId) => {
    setCameras((prev) =>
      prev.map((cam) => {
        if (cam.id !== cameraId) return cam;
        return {
          ...cam,
          events: cam.events.filter((evt) => evt.id !== eventId),
        };
      })
    );
  };

  const gridClass = gridLayout === '3x3' ? styles.grid3x3 : styles.grid2x2;

  /* ---------- AI Badge renderer ---------- */
  function renderAiBadge(cam) {
    switch (cam.aiStatus) {
      case 'clear':
        return (
          <div className={`${styles.aiBadge} ${styles.aiBadgeClear}`}>
            <ShieldCheck size={12} />
            Line Clear ✓
          </div>
        );
      case 'warning':
        return (
          <div className={`${styles.aiBadge} ${styles.aiBadgeWarning}`}>
            <AlertTriangle size={12} />
            {cam.detections} Detection{cam.detections !== 1 ? 's' : ''}
          </div>
        );
      case 'critical':
        return (
          <div className={`${styles.aiBadge} ${styles.aiBadgeCritical}`}>
            <AlertOctagon size={12} />
            {cam.detections} Detection{cam.detections !== 1 ? 's' : ''} — CRITICAL
          </div>
        );
      case 'alert':
        return (
          <div className={`${styles.aiBadge} ${styles.aiBadgeCritical}`}>
            <AlertOctagon size={12} />
            {cam.detections} Detection{cam.detections !== 1 ? 's' : ''} — ALERT
          </div>
        );
      case 'offline':
        return (
          <div className={`${styles.aiBadge} ${styles.aiBadgeOffline}`}>
            <WifiOff size={12} />
            Offline
          </div>
        );
      default:
        return null;
    }
  }

  return (
    <div className={styles.page}>
      {/* ============ Page Header ============ */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Line Cameras</h1>
          <p className={styles.pageSubtitle}>
            AI-powered foreign object detection across production lines
          </p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-secondary" disabled>
            <ScanEye size={16} />
            AI Model v3.2
          </button>
        </div>
      </div>

      {/* ============ Status Summary Bar ============ */}
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
        <div className={`${styles.statTile} ${styles.statTileLines}`}>
          <div className={`${styles.statIcon} ${styles.statIconLines}`}>
            <Activity size={16} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{statusCounts.lines}</span>
            <span className={styles.statLabel}>Lines Monitored</span>
          </div>
        </div>
        <div className={`${styles.statTile} ${styles.statTileDetections}`}>
          <div className={`${styles.statIcon} ${styles.statIconDetections}`}>
            <AlertTriangle size={16} />
          </div>
          <div className={styles.statContent}>
            <span
              className={`${styles.statValue} ${statusCounts.detections > 0 ? styles.statValuePulse : ''}`}
            >
              {statusCounts.detections}
            </span>
            <span className={styles.statLabel}>Active Detections</span>
          </div>
        </div>
        <div className={`${styles.statTile} ${styles.statTileUptime}`}>
          <div className={`${styles.statIcon} ${styles.statIconUptime}`}>
            <ShieldCheck size={16} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{statusCounts.uptime}%</span>
            <span className={styles.statLabel}>AI Model Uptime</span>
          </div>
        </div>
      </div>

      {/* ============ Toolbar ============ */}
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

          {/* Filter Buttons */}
          <div className={styles.filters}>
            {FILTER_OPTIONS.map((opt) => {
              let extraClass = '';
              if (opt.key === 'warning') extraClass = styles.filterBtnWarning;
              if (opt.key === 'critical') extraClass = styles.filterBtnCritical;
              if (opt.key === 'clear') extraClass = styles.filterBtnClear;

              return (
                <button
                  key={opt.key}
                  className={`${styles.filterBtn} ${extraClass} ${
                    activeFilter === opt.key ? styles.filterBtnActive : ''
                  }`}
                  onClick={() => setActiveFilter(opt.key)}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className={styles.toolbarRight}>
          {/* Grid Layout Selector */}
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
        </div>
      </div>

      {/* Results count */}
      {(searchQuery || activeFilter !== 'All') && (
        <p className={styles.resultsCount}>
          Showing {filteredCameras.length} of {cameras.length} camera
          {cameras.length !== 1 ? 's' : ''}
          {searchQuery && <> matching &ldquo;{searchQuery}&rdquo;</>}
        </p>
      )}

      {/* ============ Expanded Camera Detail ============ */}
      {selectedCamera && (
        <div className={`card ${styles.detailCard}`}>
          <div className={styles.detailHeader}>
            <div className={styles.detailHeaderLeft}>
              <div className={styles.detailIconWrap}>
                <ScanEye size={20} />
              </div>
              <div>
                <div className={styles.detailTitle}>{selectedCamera.name}</div>
                <div className={styles.detailSubtitle}>
                  {selectedCamera.line} — {selectedCamera.location}
                </div>
              </div>
            </div>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedCameraId(null)}
            >
              <ChevronUp size={16} />
              Collapse
            </button>
          </div>

          <div className={styles.detailGrid}>
            {/* Large camera preview */}
            <div className={styles.detailCameraWrap}>
              {selectedCamera.image && (
                <div
                  className={styles.cameraImage}
                  style={{ backgroundImage: `url(${selectedCamera.image})` }}
                />
              )}
              <div className={styles.scanLines} />
              <div className={styles.cameraOverlay} />
              <div className={styles.cameraInfo}>
                <span className={styles.cameraName}>{selectedCamera.name}</span>
                <span className={styles.cameraLine}>{selectedCamera.location}</span>
              </div>
              {selectedCamera.status === 'online' && (
                <div className={styles.liveIndicator}>
                  <span className={styles.liveDot} />
                  <span className={styles.liveText}>LIVE</span>
                </div>
              )}
              {renderAiBadge(selectedCamera)}
            </div>

            {/* Sidebar: gauge + events */}
            <div className={styles.detailSidebar}>
              <ConfidenceGauge
                value={selectedCamera.aiConfidence}
                aiStatus={selectedCamera.aiStatus}
              />

              <div className={styles.detailEventsTitle}>Detection Events</div>
              <div className={styles.detailEvents}>
                {selectedCamera.events.length > 0 ? (
                  selectedCamera.events.map((evt) => {
                    const rowClass =
                      evt.severity === 'critical'
                        ? styles.detailEventRowCritical
                        : evt.severity === 'warning'
                        ? styles.detailEventRowWarning
                        : styles.detailEventRowInfo;

                    return (
                      <div key={evt.id} className={`${styles.detailEventRow} ${rowClass}`}>
                        <div
                          className={styles.detailEventIcon}
                          style={{
                            color:
                              evt.severity === 'critical'
                                ? 'var(--color-error)'
                                : evt.severity === 'warning'
                                ? 'var(--color-warning)'
                                : 'var(--color-info)',
                          }}
                        >
                          {severityIcon(evt.severity)}
                        </div>
                        <div className={styles.detailEventContent}>
                          <div className={styles.detailEventObject}>{evt.object}</div>
                          <div className={styles.detailEventMeta}>
                            <span>{evt.confidence}% confidence</span>
                            <span>·</span>
                            <span>{formatTimestamp(evt.timestamp)}</span>
                            <span>·</span>
                            <span>{evt.action}</span>
                          </div>
                        </div>
                        <div className={styles.detailEventActions}>
                          {evt.resolved ? (
                            <span className={styles.resolvedTag}>
                              <Check size={10} />
                              Resolved
                            </span>
                          ) : (
                            <>
                              <button
                                className={styles.resolveBtn}
                                title="Mark resolved"
                                onClick={() => handleResolveEvent(selectedCamera.id, evt.id)}
                              >
                                <Check size={12} />
                              </button>
                              <button
                                className={styles.dismissBtn}
                                title="Dismiss"
                                onClick={() => handleDismissEvent(selectedCamera.id, evt.id)}
                              >
                                <X size={12} />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className={styles.noEvents}>No detection events recorded</div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============ Camera Grid ============ */}
      <div className={`${styles.cameraGrid} ${gridClass}`}>
        {filteredCameras.map((cam) => {
          const isCritical = cam.aiStatus === 'critical' || cam.aiStatus === 'alert';
          const isSelected = selectedCameraId === cam.id;

          return (
            <div key={cam.id} className={styles.gridTile}>
              <div
                className={`${styles.cameraCard} ${isSelected ? styles.cameraCardSelected : ''} ${
                  isCritical ? styles.cameraCardCritical : ''
                }`}
                onClick={() => setSelectedCameraId(isSelected ? null : cam.id)}
                role="button"
                tabIndex={0}
                aria-label={`View details for ${cam.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedCameraId(isSelected ? null : cam.id);
                  }
                }}
              >
                {/* Camera image */}
                {cam.image && (
                  <div
                    className={styles.cameraImage}
                    style={{ backgroundImage: `url(${cam.image})` }}
                  />
                )}

                {/* Scan-line overlay */}
                <div className={styles.scanLines} />

                {/* Bottom gradient */}
                <div className={styles.cameraOverlay} />

                {/* Camera name / line */}
                <div className={styles.cameraInfo}>
                  <span className={styles.cameraName}>{cam.name}</span>
                  <span className={styles.cameraLine}>{cam.line} — {cam.location}</span>
                </div>

                {/* LIVE / Offline indicator */}
                {cam.status === 'online' ? (
                  <div className={styles.liveIndicator}>
                    <span className={styles.liveDot} />
                    <span className={styles.liveText}>LIVE</span>
                  </div>
                ) : (
                  <div className={styles.offlineIndicator}>
                    <WifiOff size={10} />
                    Offline
                  </div>
                )}

                {/* AI Detection Badge */}
                {renderAiBadge(cam)}
              </div>
            </div>
          );
        })}
      </div>

      {/* ============ Detection Event Log ============ */}
      <div className={`card ${styles.eventLogCard}`}>
        <div className={styles.eventLogHeader}>
          <h2 className={styles.eventLogTitle}>
            <ScanEye size={18} />
            Recent Detection Events
          </h2>
          <span className={styles.eventLogCount}>{allEvents.length} events</span>
        </div>

        {allEvents.length > 0 ? (
          <div className={styles.eventLogList}>
            {allEvents.map((evt) => {
              const rowClass =
                evt.severity === 'critical'
                  ? styles.eventLogRowCritical
                  : evt.severity === 'warning'
                  ? styles.eventLogRowWarning
                  : styles.eventLogRowInfo;
              const iconClass =
                evt.severity === 'critical'
                  ? styles.eventLogIconCritical
                  : evt.severity === 'warning'
                  ? styles.eventLogIconWarning
                  : styles.eventLogIconInfo;

              return (
                <div key={evt.id} className={`${styles.eventLogRow} ${rowClass}`}>
                  <div className={`${styles.eventLogIcon} ${iconClass}`}>
                    {severityIcon(evt.severity)}
                  </div>
                  <span className={styles.eventLogCamera}>{evt.cameraName}</span>
                  <span className={styles.eventLogObject}>{evt.object}</span>
                  <span className={styles.eventLogConfidence}>{evt.confidence}%</span>
                  <span className={styles.eventLogTime}>
                    <Clock size={10} />
                    {formatTimestamp(evt.timestamp)}
                  </span>
                  <span className={styles.eventLogStatus}>
                    {evt.resolved ? (
                      <span className={styles.resolvedTag}>
                        <Check size={10} />
                        Resolved
                      </span>
                    ) : (
                      <span className={styles.unresolvedTag}>
                        <AlertTriangle size={10} />
                        Open
                      </span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className={styles.emptyLog}>
            <ShieldCheck size={24} style={{ opacity: 0.3, marginBottom: 8 }} />
            <p>No detection events. All lines are clear.</p>
          </div>
        )}
      </div>
    </div>
  );
}
