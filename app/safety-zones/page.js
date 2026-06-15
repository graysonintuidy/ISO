'use client';

import { useState, useMemo, useCallback } from 'react';
import Image from 'next/image';
import {
  ShieldAlert,
  ShieldCheck,
  Camera,
  AlertTriangle,
  Clock,
  User,
  Timer,
  Filter,
  ChevronDown,
  Eye,
  X,
  MapPin,
  Activity,
  ChevronUp,
} from 'lucide-react';
import { SAFETY_ZONES, VIOLATION_LOG } from '@/lib/demoSafetyZones';
import styles from './page.module.css';

/* ---------- Helpers ---------- */

function formatTimestamp(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatTime(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '—';
  }
}

function formatViolationType(type) {
  return type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/* ---------- Sub-components ---------- */

function SeverityBadge({ severity }) {
  let cls = styles.violationSeverityBadge;
  if (severity === 'critical') cls += ` ${styles.violationSeverityCritical}`;
  else if (severity === 'warning') cls += ` ${styles.violationSeverityWarning}`;
  return <span className={cls}>{severity}</span>;
}

function StatusTag({ status }) {
  let cls = styles.violationStatusTag;
  if (status === 'unresolved') cls += ` ${styles.violationStatusUnresolved}`;
  else if (status === 'acknowledged') cls += ` ${styles.violationStatusAcknowledged}`;
  else if (status === 'resolved') cls += ` ${styles.violationStatusResolved}`;
  return <span className={cls}>{status}</span>;
}

/* ============================================================
   SafetyZonesPage
   ============================================================ */
export default function SafetyZonesPage() {
  const [selectedZoneId, setSelectedZoneId] = useState(null);
  const [logFilter, setLogFilter] = useState('all');

  /* ---------- Computed stats ---------- */
  const stats = useMemo(() => {
    const totalZones = SAFETY_ZONES.length;
    const activeBreaches = SAFETY_ZONES.filter((z) => z.status === 'breach').length;
    const todayViolations = SAFETY_ZONES.reduce((sum, z) => sum + z.todayBreaches, 0);
    const clearZones = SAFETY_ZONES.filter((z) => z.status === 'clear').length;
    const complianceScore = totalZones > 0 ? Math.round((clearZones / totalZones) * 100) : 0;
    return { totalZones, activeBreaches, todayViolations, complianceScore };
  }, []);

  /* ---------- Selected zone ---------- */
  const selectedZone = useMemo(() => {
    if (!selectedZoneId) return null;
    return SAFETY_ZONES.find((z) => z.id === selectedZoneId) || null;
  }, [selectedZoneId]);

  /* ---------- Violations for selected zone ---------- */
  const zoneViolations = useMemo(() => {
    if (!selectedZoneId) return [];
    return VIOLATION_LOG
      .filter((v) => v.zoneId === selectedZoneId)
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }, [selectedZoneId]);

  /* ---------- Filtered log ---------- */
  const filteredLog = useMemo(() => {
    let result = [...VIOLATION_LOG];
    if (logFilter === 'critical') result = result.filter((v) => v.severity === 'critical');
    else if (logFilter === 'warning') result = result.filter((v) => v.severity === 'warning');
    result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return result;
  }, [logFilter]);

  const handleCardClick = useCallback((id) => {
    setSelectedZoneId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className={styles.page}>
      {/* ======= Page Header ======= */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Safety Zones</h1>
          <p className={styles.pageSubtitle}>
            AI-powered zone breach detection and compliance monitoring
          </p>
        </div>
      </div>

      {/* ======= Stat Summary Row ======= */}
      <div className={styles.statusSummary}>
        <div className={styles.statTile}>
          <div className={styles.statIcon}>
            <ShieldCheck size={16} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.totalZones}</span>
            <span className={styles.statLabel}>Total Zones</span>
          </div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statIcon}>
            <ShieldAlert size={16} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.activeBreaches}</span>
            <span className={styles.statLabel}>Active Breaches</span>
          </div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statIcon}>
            <AlertTriangle size={16} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.todayViolations}</span>
            <span className={styles.statLabel}>Today&apos;s Violations</span>
          </div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statIcon}>
            <Activity size={16} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.complianceScore}%</span>
            <span className={styles.statLabel}>Compliance Score</span>
          </div>
        </div>
      </div>

      {/* ======= Camera Grid ======= */}
      <div className={styles.cameraGrid}>
        {SAFETY_ZONES.map((zone, i) => (
          <div
            key={zone.id}
            className={`${styles.cameraCard} ${selectedZoneId === zone.id ? styles.cameraCardSelected : ''}`}
            style={{ animationDelay: `${i * 0.04}s` }}
            onClick={() => handleCardClick(zone.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleCardClick(zone.id);
              }
            }}
          >
            {/* Image with overlays */}
            <div className={styles.cameraImageWrapper}>
              <Image
                src={zone.image}
                alt={zone.name}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1200px) 50vw, 33vw"
                className={styles.cameraImage}
              />
              {/* Camera ID — top left */}
              <div className={styles.cameraIdOverlay}>
                <Camera size={10} />
                {zone.camera}
              </div>
              {/* Status badge — top right */}
              <div
                className={`${styles.statusBadgeOverlay} ${
                  zone.status === 'breach'
                    ? styles.statusBadgeBreach
                    : styles.statusBadgeClear
                }`}
              >
                {zone.status === 'breach' ? 'BREACH' : 'CLEAR'}
              </div>
              {/* Zone name — bottom */}
              <div className={styles.zoneNameOverlay}>{zone.name}</div>
            </div>

            {/* Card body */}
            <div className={styles.cameraCardBody}>
              <div className={styles.cardMeta}>
                <div className={styles.cardMetaItem}>
                  <span className={styles.zoneTypeBadge}>{zone.type}</span>
                </div>
                <div className={styles.cardMetaItem}>
                  <MapPin size={11} />
                  <span className={styles.cardMetaValue}>{zone.location}</span>
                </div>
              </div>
              <div className={styles.cardMeta}>
                <div className={styles.cardMetaItem}>
                  <AlertTriangle size={11} />
                  <span className={styles.cardMetaValue}>{zone.breachCount}</span>
                  breaches
                </div>
                <div className={styles.cardMetaItem}>
                  <Clock size={11} />
                  <span className={styles.cardMetaMono}>
                    {zone.lastBreach ? formatTimestamp(zone.lastBreach) : 'None'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* ======= Expanded Zone Detail ======= */}
      {selectedZone && (
        <div className={styles.expandedDetail}>
          {/* Header */}
          <div className={styles.detailHeader}>
            <div className={styles.detailHeaderLeft}>
              <div className={styles.detailZoneIcon}>
                <ShieldAlert size={20} />
              </div>
              <div>
                <div className={styles.detailName}>{selectedZone.name}</div>
                <div className={styles.detailMeta}>
                  <span style={{ textTransform: 'capitalize' }}>{selectedZone.type}</span>
                  <span className={styles.detailMetaSep}>·</span>
                  <span>{selectedZone.camera}</span>
                  <span className={styles.detailMetaSep}>·</span>
                  <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                    {selectedZone.status}
                  </span>
                </div>
              </div>
            </div>
            <button className={styles.collapseBtn} onClick={() => setSelectedZoneId(null)}>
              <X size={13} />
              Close
            </button>
          </div>

          {/* Body — image + info */}
          <div className={styles.detailBody}>
            <div className={styles.detailImageCol}>
              <Image
                src={selectedZone.image}
                alt={selectedZone.name}
                width={720}
                height={405}
                className={styles.detailLargeImage}
              />
            </div>
            <div className={styles.detailInfoCol}>
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Zone Information</div>
                <div className={styles.detailInfoGrid}>
                  <span className={styles.detailInfoLabel}>Zone:</span>
                  <span className={styles.detailInfoValue}>{selectedZone.name}</span>
                  <span className={styles.detailInfoLabel}>Type:</span>
                  <span className={styles.detailInfoValue} style={{ textTransform: 'capitalize' }}>
                    {selectedZone.type}
                  </span>
                  <span className={styles.detailInfoLabel}>Camera:</span>
                  <span className={styles.detailInfoValue}>{selectedZone.camera}</span>
                  <span className={styles.detailInfoLabel}>Location:</span>
                  <span className={styles.detailInfoValue}>{selectedZone.location}</span>
                  <span className={styles.detailInfoLabel}>Total Breaches:</span>
                  <span className={styles.detailInfoValue}>{selectedZone.breachCount}</span>
                  <span className={styles.detailInfoLabel}>Today:</span>
                  <span className={styles.detailInfoValue}>{selectedZone.todayBreaches}</span>
                </div>
              </div>
              <div className={styles.detailSection}>
                <div className={styles.detailSectionTitle}>Description</div>
                <div className={styles.detailDescription}>{selectedZone.description}</div>
              </div>
            </div>
          </div>

          {/* Violation history for this zone */}
          <div className={styles.detailViolationsHeader}>
            Violation History — {zoneViolations.length} event{zoneViolations.length !== 1 ? 's' : ''}
          </div>
          {zoneViolations.length > 0 ? (
            <div className={styles.detailViolationsList}>
              {zoneViolations.map((v) => (
                <div
                  key={v.id}
                  className={`${styles.detailViolationRow} ${
                    v.severity === 'critical'
                      ? styles.detailViolationRowCritical
                      : styles.detailViolationRowWarning
                  }`}
                >
                  <span className={styles.violationTimestamp}>{formatTimestamp(v.timestamp)}</span>
                  <SeverityBadge severity={v.severity} />
                  <span className={styles.violationType}>{formatViolationType(v.type)}</span>
                  <span className={styles.violationDesc}>{v.description}</span>
                  <span className={styles.violationPerson}>
                    <User size={10} />
                    {v.person}
                  </span>
                  <span className={styles.violationDuration}>
                    <Timer size={10} />
                    {v.duration}
                  </span>
                  <StatusTag status={v.status} />
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.noViolations}>
              <ShieldCheck size={16} />
              No violations recorded for this zone.
            </div>
          )}
        </div>
      )}

      {/* ======= Full Violation Log Panel ======= */}
      <div className={styles.violationLogPanel}>
        <div className={styles.violationLogHeader}>
          <div className={styles.violationLogTitle}>
            <AlertTriangle size={15} />
            Violation Activity Log
            <span className={styles.violationLogCount}>{filteredLog.length}</span>
          </div>
          <div className={styles.violationLogFilters}>
            {['all', 'critical', 'warning'].map((key) => (
              <button
                key={key}
                className={`${styles.filterBtn} ${logFilter === key ? styles.filterBtnActive : ''}`}
                onClick={() => setLogFilter(key)}
              >
                {key === 'all' ? 'All' : key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Table header */}
        <div className={styles.logTableHeader}>
          <span>Time</span>
          <span>Camera</span>
          <span>Zone</span>
          <span>Severity</span>
          <span>Type</span>
          <span>Person</span>
          <span>Duration</span>
          <span>Status</span>
        </div>

        {/* Table body */}
        <div className={styles.logTableBody}>
          {filteredLog.map((v) => (
            <div
              key={v.id}
              className={`${styles.logRow} ${
                v.severity === 'critical'
                  ? styles.logRowCritical
                  : styles.logRowWarning
              }`}
            >
              <span className={styles.logCellTime}>{formatTime(v.timestamp)}</span>
              <span className={styles.logCellCamera}>{v.camera}</span>
              <span className={styles.logCellZone}>{v.zoneName}</span>
              <span className={styles.logCellSeverity}>
                <SeverityBadge severity={v.severity} />
              </span>
              <span className={styles.logCellType}>{formatViolationType(v.type)}</span>
              <span className={styles.logCellPerson}>{v.person}</span>
              <span className={styles.logCellDuration}>{v.duration}</span>
              <span className={styles.logCellStatus}>
                <StatusTag status={v.status} />
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
