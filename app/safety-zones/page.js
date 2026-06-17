'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ShieldAlert,
  ShieldCheck,
  Camera,
  AlertTriangle,
  Clock,
  User,
  Timer,
  MapPin,
  Activity,
} from 'lucide-react';

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
  const router = useRouter();
  const [logFilter, setLogFilter] = useState('all');
  const [zones, setZones] = useState([]);
  const [violations, setViolations] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [zonesRes, incidentsRes] = await Promise.all([
        fetch('/api/zones?facilityId=1'),
        fetch('/api/incidents?facilityId=1&limit=50'),
      ]);
      if (zonesRes.ok) {
        const zData = await zonesRes.json();
        const mappedZones = (zData.data || []).map(z => {
          const meta = typeof z.metadata === 'string' ? JSON.parse(z.metadata) : (z.metadata || {});
          return {
            id: z.id,
            name: z.name,
            type: z.zone_type === 'restricted' ? 'restricted' : z.zone_type === 'hazardous' ? 'caution' : z.zone_type === 'authorized' ? 'emergency' : 'general',
            camera: meta.camera || 'Unknown',
            image: meta.image || '/camera-feeds/cam-01.png',
            location: meta.location || z.name,
            status: meta.status || 'clear',
            severity: meta.severity || 'low',
            zoneColor: z.color || '#FF0000',
            description: meta.description || '',
            breachCount: meta.breachCount || 0,
            todayBreaches: meta.todayBreaches || 0,
            lastBreach: meta.lastBreach || null,
          };
        });
        // Deduplicate zones by name (DB may contain duplicate rows)
        const seen = new Set();
        const uniqueZones = mappedZones.filter(z => {
          if (seen.has(z.name)) return false;
          seen.add(z.name);
          return true;
        });
        setZones(uniqueZones);
      }
      if (incidentsRes.ok) {
        const iData = await incidentsRes.json();
        const mappedViolations = (iData.data || []).map(inc => {
          const meta = typeof inc.metadata === 'string' ? JSON.parse(inc.metadata) : (inc.metadata || {});
          return {
            id: inc.id,
            zoneId: inc.zone_id,
            zoneName: meta.zoneName || 'Unknown Zone',
            camera: meta.camera || 'Unknown',
            timestamp: inc.created_at,
            severity: inc.severity,
            type: inc.incident_type === 'unauthorized_access' ? 'unauthorized_entry'
              : inc.incident_type === 'zone_breach' ? 'boundary_breach'
              : inc.incident_type,
            description: inc.description || inc.title,
            person: meta.person || 'Unknown',
            duration: meta.duration || 'N/A',
            status: inc.status === 'open' ? 'unresolved' : inc.status === 'investigating' ? 'acknowledged' : 'resolved',
            image: meta.image || '/camera-feeds/cam-01.png',
          };
        });
        setViolations(mappedViolations);
      }
    } catch (error) {
      console.error('Failed to fetch safety zone data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  /* ---------- Computed stats ---------- */
  const stats = useMemo(() => {
    const totalZones = zones.length;
    const activeBreaches = zones.filter((z) => z.status === 'breach').length;
    const todayViolations = zones.reduce((sum, z) => sum + z.todayBreaches, 0);
    const clearZones = zones.filter((z) => z.status === 'clear').length;
    const complianceScore = totalZones > 0 ? Math.round((clearZones / totalZones) * 100) : 0;
    return { totalZones, activeBreaches, todayViolations, complianceScore };
  }, [zones]);

  /* ---------- Filtered log ---------- */
  const filteredLog = useMemo(() => {
    let result = [...violations];
    if (logFilter === 'critical') result = result.filter((v) => v.severity === 'critical');
    else if (logFilter === 'warning') result = result.filter((v) => v.severity === 'warning');
    result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return result;
  }, [logFilter, violations]);

  const handleCardClick = useCallback((id) => {
    router.push(`/safety-zones/${id}`);
  }, [router]);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Safety Zones</h1>
            <p className={styles.pageSubtitle}>Loading safety zone data...</p>
          </div>
        </div>
      </div>
    );
  }

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
        {zones.map((zone, i) => (
          <div
            key={zone.id}
            className={styles.cameraCard}
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
