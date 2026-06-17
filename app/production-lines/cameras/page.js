'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
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

/* ---------- Compact Confidence Badge ---------- */
function ConfidenceBadge({ value, aiStatus }) {
  let statusClass = styles.confidenceBadgeSuccess;
  if (aiStatus === 'warning') statusClass = styles.confidenceBadgeWarning;
  if (aiStatus === 'critical') statusClass = styles.confidenceBadgeCritical;

  return (
    <div className={`${styles.confidenceBadge} ${statusClass}`}>
      <span className={styles.confidenceBadgeValue}>{value.toFixed(1)}</span>
      <span className={styles.confidenceBadgeUnit}>%</span>
    </div>
  );
}

/* ============================================================
   MAIN PAGE COMPONENT
   ============================================================ */
export default function ProductionLineCamerasPage() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [gridLayout, setGridLayout] = useState('3x3');
  const [activeFilter, setActiveFilter] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCameraId, setSelectedCameraId] = useState(null);

  /* ---------- Mock event generator ---------- */
  const generateMockEvents = useCallback((cameraId, lineNumber) => {
    const now = Date.now();
    const min = (m) => m * 60 * 1000;

    const eventTemplates = [
      // Foreign object detections
      { object: 'Metal Fragment', severity: 'critical', action: 'Line paused automatically', confidence: 96 },
      { object: 'Plastic Shard', severity: 'critical', action: 'Flagged for review', confidence: 94 },
      { object: 'Bone Fragment', severity: 'warning', action: 'Flagged for review', confidence: 88 },
      { object: 'Rubber Piece', severity: 'warning', action: 'Operator notified', confidence: 82 },
      { object: 'Wire Fragment', severity: 'critical', action: 'Line paused automatically', confidence: 97 },
      // PPE violations
      { object: 'Missing Hairnet', severity: 'warning', action: 'Supervisor alerted', confidence: 91 },
      { object: 'Missing Gloves', severity: 'warning', action: 'Supervisor alerted', confidence: 87 },
      { object: 'Improper Apron', severity: 'info', action: 'Logged', confidence: 79 },
      // Zone intrusions
      { object: 'Unauthorized Zone Entry', severity: 'critical', action: 'Security alerted', confidence: 95 },
      { object: 'Restricted Area Breach', severity: 'warning', action: 'Supervisor alerted', confidence: 90 },
      // Process anomalies
      { object: 'Belt Speed Anomaly', severity: 'info', action: 'Logged', confidence: 85 },
      { object: 'Product Overlap', severity: 'info', action: 'Flagged for review', confidence: 83 },
      { object: 'Conveyor Jam Detected', severity: 'warning', action: 'Operator notified', confidence: 92 },
      { object: 'Temperature Excursion', severity: 'critical', action: 'QA team notified', confidence: 93 },
      { object: 'Spill Detected', severity: 'warning', action: 'Cleanup crew dispatched', confidence: 86 },
      { object: 'Packaging Defect', severity: 'info', action: 'Logged', confidence: 80 },
    ];

    // Use lineNumber as a seed offset so each camera gets a different set
    const seed = (cameraId * 7 + lineNumber * 13) % eventTemplates.length;
    const count = 4 + (lineNumber % 3) + (cameraId % 2); // 4-6 events per camera

    const events = [];
    for (let i = 0; i < count; i++) {
      const template = eventTemplates[(seed + i * 3) % eventTemplates.length];
      const timeAgo = min(2 + i * 8 + (cameraId % 5) * 3); // stagger timestamps
      events.push({
        id: `mock-${cameraId}-${i}`,
        timestamp: new Date(now - timeAgo).toISOString(),
        type: 'detection',
        severity: template.severity,
        object: template.object,
        confidence: template.confidence + ((cameraId + i) % 5) - 2, // slight variance
        action: template.action,
        resolved: i >= count - 1, // last event resolved
      });
    }
    return events;
  }, []);

  const fetchCameras = useCallback(async () => {
    try {
      const [camerasRes, eventsRes] = await Promise.all([
        fetch('/api/cameras?facilityId=1'),
        fetch('/api/ai-events?facilityId=1&limit=100'),
      ]);
      if (camerasRes.ok) {
        const cData = await camerasRes.json();
        const eData = eventsRes.ok ? await eventsRes.json() : { data: [] };
        const eventsByCamera = {};
        (eData.data || []).forEach(evt => {
          if (!eventsByCamera[evt.camera_id]) eventsByCamera[evt.camera_id] = [];
          eventsByCamera[evt.camera_id].push({
            id: `evt-${evt.id}`,
            timestamp: evt.created_at,
            type: evt.event_type,
            severity: evt.severity || 'info',
            object: evt.object || evt.event_type,
            confidence: Math.round((evt.confidence || 0) * 100),
            action: evt.action || 'Flagged for review',
            resolved: evt.reviewed || false,
          });
        });

        const lineCameras = (cData.data || [])
          .filter(cam => cam.camera_type === 'line' && cam.ai_enabled)
          .map(cam => {
            const config = typeof cam.config === 'string' ? JSON.parse(cam.config) : (cam.config || {});
            const camEvents = eventsByCamera[cam.id] || [];
            const lineNum = config.lineNumber || 1;
            // Use API events if available, otherwise generate mock events
            const finalEvents = camEvents.length > 0 ? camEvents : generateMockEvents(cam.id, lineNum);
            return {
              id: cam.id,
              name: cam.name,
              line: config.line || 'Line 1',
              lineNumber: lineNum,
              location: cam.location_description || config.line || '',
              cameraType: config.cameraType || 'AI Vision \u2014 Top-Down',
              status: cam.status,
              aiStatus: config.aiStatus || 'clear',
              aiConfidence: config.aiConfidence || 98,
              detections: config.detections || finalEvents.filter(e => !e.resolved).length,
              image: config.image || null,
              lastDetection: finalEvents[0]?.timestamp || null,
              events: finalEvents,
            };
          });
        setCameras(lineCameras);
      }
    } catch (error) {
      console.error('Failed to fetch line cameras:', error);
    } finally {
      setLoading(false);
    }
  }, [generateMockEvents]);

  useEffect(() => {
    fetchCameras();
  }, [fetchCameras]);

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

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Line Cameras</h1>
            <p className={styles.pageSubtitle}>Loading camera data...</p>
          </div>
        </div>
      </div>
    );
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

              {renderAiBadge(selectedCamera)}
            </div>

            {/* Sidebar: confidence badge + events */}
            <div className={styles.detailSidebar}>
              <div className={styles.sidebarHeader}>
                <ConfidenceBadge
                  value={selectedCamera.aiConfidence}
                  aiStatus={selectedCamera.aiStatus}
                />
                <div className={styles.detailEventsTitle}>Detection Events</div>
              </div>
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

                {/* Offline indicator */}
                {cam.status !== 'online' && (
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
