'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Cpu,
  Activity,
  Thermometer,
  Waves,
  Zap,
  AlertTriangle,
  AlertOctagon,
  Search,
  Check,
  X,
  Clock,
  ChevronUp,
  ChevronDown,
  Wrench,
  Gauge,
  Power,
  Filter,
} from 'lucide-react';

import MachineCard from '@/app/components/ui/MachineCard';
import styles from './page.module.css';

const STATUS_FILTERS = [
  { key: 'all', label: 'All', styleClass: '' },
  { key: 'running', label: 'Running', styleClass: styles.filterBtnRunning },
  { key: 'fault', label: 'Fault', styleClass: styles.filterBtnFault },
  { key: 'warning', label: 'Warning', styleClass: styles.filterBtnWarning },
  { key: 'idle', label: 'Idle', styleClass: styles.filterBtnIdle },
  { key: 'maintenance', label: 'Maintenance', styleClass: styles.filterBtnMaintenance },
];

const SORT_OPTIONS = [
  { value: 'name', label: 'Name' },
  { value: 'status', label: 'Status' },
  { value: 'output', label: 'Output %' },
  { value: 'line', label: 'Line' },
];

const STATUS_PRIORITY = { fault: 0, warning: 1, maintenance: 2, running: 3, idle: 4 };

const SENSOR_ICON_MAP = {
  temperature: Thermometer,
  vibration: Waves,
  powerDraw: Zap,
  motorRPM: Gauge,
  bladeRPM: Gauge,
  beltSpeed: Activity,
  vacuumPressure: Gauge,
  formingPressure: Gauge,
  refrigerantPressure: Gauge,
  sensitivity: Activity,
  labelStock: Activity,
  jointStress: Wrench,
  accuracy: Activity,
};

/* Default min/max/threshold ranges per sensor key */
const SENSOR_DEFAULTS = {
  temperature:         { min: 20, max: 70, threshold: 50 },
  vibration:           { min: 0, max: 12, threshold: 8 },
  powerDraw:           { min: 0, max: 30, threshold: 22 },
  motorRPM:            { min: 0, max: 3000, threshold: 2500 },
  beltSpeed:           { min: 0, max: 6, threshold: 5 },
  bladeRPM:            { min: 0, max: 4000, threshold: 3500 },
  vacuumPressure:      { min: -30, max: 0, threshold: -25 },
  formingPressure:     { min: 0, max: 80, threshold: 65 },
  refrigerantPressure: { min: 100, max: 250, threshold: 220 },
  sensitivity:         { min: 90, max: 100, threshold: 99.5 },
  labelStock:          { min: 0, max: 100, threshold: 80 },
  jointStress:         { min: 0, max: 200, threshold: 150 },
  accuracy:            { min: 95, max: 100, threshold: 99.9 },
};

function enrichSensor(key, sensor) {
  const defaults = SENSOR_DEFAULTS[key] || { min: 0, max: 100, threshold: 80 };
  return {
    ...defaults,
    ...sensor,
    min: sensor.min ?? defaults.min,
    max: sensor.max ?? defaults.max,
    threshold: sensor.threshold ?? defaults.threshold,
  };
}

function formatSensorName(key) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase());
}

function getSensorGaugeState(sensor) {
  if (sensor.threshold === undefined) return 'normal';
  if (sensor.value > sensor.threshold) return 'critical';
  if (sensor.value / sensor.threshold >= 0.85) return 'warning';
  return 'normal';
}

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

function formatDate(d) {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return '—';
  }
}

export default function MachinesPage() {
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState('status');
  const [expandedId, setExpandedId] = useState(null);

  const fetchMachines = useCallback(async () => {
    try {
      const res = await fetch('/api/devices?facilityId=1');
      if (res.ok) {
        const data = await res.json();
        const mapped = (data.data || []).map(device => {
          const config = typeof device.config === 'string' ? JSON.parse(device.config) : (device.config || {});
          return {
            id: device.id,
            name: device.device_name,
            type: config.machineType || device.device_type || 'Unknown',
            line: config.line || 'Line 1',
            lineNumber: config.lineNumber || 1,
            status: config.originalStatus || (device.status === 'online' ? 'running' : device.status === 'error' ? 'fault' : device.status === 'offline' ? 'idle' : device.status),
            outputRate: config.outputRate || 0,
            targetOutput: config.targetOutput || 0,
            unit: config.unit || 'units/hr',
            uptime: config.uptime || 0,
            lastMaintenance: config.lastMaintenance || null,
            nextMaintenance: config.nextMaintenance || null,
            sensors: config.sensors || {},
            alerts: config.alerts || [],
          };
        });
        setMachines(mapped);
      }
    } catch (error) {
      console.error('Failed to fetch machines:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  /* ---------- Counts ---------- */
  const counts = useMemo(() => {
    const c = { total: machines.length, running: 0, fault: 0, alerts: 0 };
    machines.forEach((m) => {
      if (m.status === 'running') c.running++;
      if (m.status === 'fault') c.fault++;
      c.alerts += m.alerts.filter((a) => !a.acknowledged).length;
    });
    return c;
  }, [machines]);

  /* ---------- Filtered + sorted ---------- */
  const filteredMachines = useMemo(() => {
    let result = machines;

    if (statusFilter !== 'all') {
      result = result.filter((m) => m.status === statusFilter);
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.type.toLowerCase().includes(q) ||
          m.line.toLowerCase().includes(q)
      );
    }

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'status':
          return (STATUS_PRIORITY[a.status] ?? 5) - (STATUS_PRIORITY[b.status] ?? 5);
        case 'output': {
          const pctA = a.targetOutput ? a.outputRate / a.targetOutput : 0;
          const pctB = b.targetOutput ? b.outputRate / b.targetOutput : 0;
          return pctA - pctB;
        }
        case 'line':
          return (a.lineNumber ?? 0) - (b.lineNumber ?? 0);
        default:
          return 0;
      }
    });

    return result;
  }, [machines, statusFilter, searchQuery, sortBy]);

  /* ---------- Expanded machine ---------- */
  const expandedMachine = useMemo(() => {
    if (!expandedId) return null;
    return machines.find((m) => m.id === expandedId) || null;
  }, [machines, expandedId]);

  /* ---------- Dynamic sensor jitter (±1% every second) ---------- */
  const [sensorJitter, setSensorJitter] = useState({});
  const jitterRef = useRef(null);

  useEffect(() => {
    // Clear any previous interval
    if (jitterRef.current) {
      clearInterval(jitterRef.current);
      jitterRef.current = null;
    }

    if (!expandedMachine) {
      setSensorJitter({});
      return;
    }

    // Initialize jitter offsets to 0
    const initialJitter = {};
    Object.keys(expandedMachine.sensors).forEach((key) => {
      initialJitter[key] = 0;
    });
    setSensorJitter(initialJitter);

    // Every second, walk each sensor's offset by ±1% of its range
    jitterRef.current = setInterval(() => {
      setSensorJitter((prev) => {
        const next = { ...prev };
        Object.entries(expandedMachine.sensors).forEach(([key, rawSensor]) => {
          const sensor = enrichSensor(key, rawSensor);
          const range = sensor.max - sensor.min;
          const step = range * 0.01; // 1% of range
          const direction = Math.random() > 0.5 ? 1 : -1;
          const currentOffset = prev[key] || 0;
          let newOffset = currentOffset + direction * step;
          // Clamp offset so value stays within [min, max]
          const baseValue = sensor.value;
          const newValue = baseValue + newOffset;
          if (newValue > sensor.max) newOffset = sensor.max - baseValue;
          if (newValue < sensor.min) newOffset = sensor.min - baseValue;
          next[key] = newOffset;
        });
        return next;
      });
    }, 1000);

    return () => {
      if (jitterRef.current) {
        clearInterval(jitterRef.current);
        jitterRef.current = null;
      }
    };
  }, [expandedMachine]);

  /* ---------- All unacknowledged alerts ---------- */
  const activeAlerts = useMemo(() => {
    const allAlerts = [];
    machines.forEach((m) => {
      m.alerts
        .filter((a) => !a.acknowledged)
        .forEach((a) => allAlerts.push({ ...a, machineName: m.name, machineId: m.id }));
    });
    allAlerts.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return allAlerts;
  }, [machines]);

  /* ---------- Acknowledge alert ---------- */
  const acknowledgeAlert = useCallback((machineId, alertId) => {
    setMachines((prev) =>
      prev.map((m) => {
        if (m.id !== machineId) return m;
        return {
          ...m,
          alerts: m.alerts.map((a) =>
            a.id === alertId ? { ...a, acknowledged: true } : a
          ),
        };
      })
    );
  }, []);

  const handleCardClick = useCallback((id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  }, []);

  /* ---------- Severity badge class ---------- */
  function sevBadgeClass(severity) {
    if (severity === 'critical') return styles.badgeCritical;
    if (severity === 'warning') return styles.badgeWarning;
    return styles.badgeInfo;
  }

  function sevRowClass(severity) {
    if (severity === 'critical') return styles.alertRowCritical;
    if (severity === 'warning') return styles.alertRowWarning;
    return styles.alertRowInfo;
  }

  function sevHistoryClass(severity) {
    if (severity === 'critical') return styles.alertHistoryItemCritical;
    if (severity === 'warning') return styles.alertHistoryItemWarning;
    return styles.alertHistoryItemInfo;
  }

  function detailAccentClass(status) {
    const map = {
      running: styles.expandedDetailRunning,
      fault: styles.expandedDetailFault,
      warning: styles.expandedDetailWarning,
      idle: styles.expandedDetailIdle,
      maintenance: styles.expandedDetailMaintenance,
    };
    return map[status] || '';
  }

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Machine Overview</h1>
            <p className={styles.pageSubtitle}>Loading machine data...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Machine Overview</h1>
          <p className={styles.pageSubtitle}>
            Real-time IoT sensor monitoring and failure detection
          </p>
        </div>
      </div>

      {/* Status Summary */}
      <div className={styles.statusSummary}>
        <div className={`${styles.statTile} ${styles.statTileTotal}`}>
          <div className={`${styles.statIcon} ${styles.statIconTotal}`}>
            <Cpu size={16} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{counts.total}</span>
            <span className={styles.statLabel}>Total Machines</span>
          </div>
        </div>
        <div className={`${styles.statTile} ${styles.statTileRunning}`}>
          <div className={`${styles.statIcon} ${styles.statIconRunning}`}>
            <Power size={16} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{counts.running}</span>
            <span className={styles.statLabel}>Running</span>
          </div>
        </div>
        <div className={`${styles.statTile} ${styles.statTileFault}`}>
          <div className={`${styles.statIcon} ${styles.statIconFault}`}>
            <AlertOctagon size={16} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{counts.fault}</span>
            <span className={styles.statLabel}>Faulted</span>
          </div>
        </div>
        <div className={`${styles.statTile} ${styles.statTileAlerts}`}>
          <div className={`${styles.statIcon} ${styles.statIconAlerts}`}>
            <AlertTriangle size={16} />
          </div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{counts.alerts}</span>
            <span className={styles.statLabel}>Active Alerts</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <div className={styles.searchWrapper}>
            <span className={styles.searchIcon}>
              <Search size={15} />
            </span>
            <input
              type="text"
              className={`input ${styles.searchInput}`}
              placeholder="Search machines..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search machines by name, type, or line"
            />
          </div>
          <div className={styles.filters}>
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.key}
                className={`${styles.filterBtn} ${f.styleClass} ${statusFilter === f.key ? styles.filterBtnActive : ''}`}
                onClick={() => setStatusFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className={styles.toolbarRight}>
          <div className={styles.sortWrapper}>
            <Filter size={13} className={styles.sortLabel} />
            <select
              className={styles.sortSelect}
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              aria-label="Sort machines"
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Results count */}
      {(searchQuery || statusFilter !== 'all') && (
        <p className={styles.resultsCount}>
          Showing {filteredMachines.length} of {machines.length} machine
          {machines.length !== 1 ? 's' : ''}
          {searchQuery && <> matching &ldquo;{searchQuery}&rdquo;</>}
        </p>
      )}

      {/* Expanded Machine Detail */}
      {expandedMachine && (
        <div className={`${styles.expandedDetail} ${detailAccentClass(expandedMachine.status)}`}>
          <div className={styles.detailHeader}>
            <div className={styles.detailHeaderLeft}>
              <div className={styles.detailMachineIcon}>
                <Cpu size={24} />
              </div>
              <div>
                <div className={styles.detailName}>{expandedMachine.name}</div>
                <div className={styles.detailMeta}>
                  <span>{expandedMachine.type}</span>
                  <span className={styles.detailMetaSep}>·</span>
                  <span>{expandedMachine.line}</span>
                  <span className={styles.detailMetaSep}>·</span>
                  <span style={{ textTransform: 'capitalize', fontWeight: 600 }}>
                    {expandedMachine.status}
                  </span>
                </div>
              </div>
            </div>
            <button
              className={styles.collapseBtn}
              onClick={() => setExpandedId(null)}
            >
              <ChevronUp size={14} />
              Collapse
            </button>
          </div>

          {/* Sensor Gauges */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>Sensor Readings</div>
            <div className={styles.sensorGaugesGrid}>
              {Object.entries(expandedMachine.sensors).map(([key, rawSensor]) => {
                const sensor = enrichSensor(key, rawSensor);
                const jitterOffset = sensorJitter[key] || 0;
                const liveValue = parseFloat((sensor.value + jitterOffset).toFixed(1));
                const liveSensor = { ...sensor, value: liveValue };
                const state = getSensorGaugeState(liveSensor);
                const range = sensor.max - sensor.min;
                const pct = range > 0
                  ? ((liveValue - sensor.min) / range) * 100
                  : 0;
                const thresholdPct = range > 0
                  ? ((sensor.threshold - sensor.min) / range) * 100
                  : null;
                const SIcon = SENSOR_ICON_MAP[key] || Activity;
                const fillClass =
                  state === 'critical'
                    ? styles.sensorGaugeFillCritical
                    : state === 'warning'
                    ? styles.sensorGaugeFillWarning
                    : styles.sensorGaugeFillNormal;
                const gaugeClass = state === 'critical' ? styles.sensorGaugeCritical
                  : state === 'warning' ? styles.sensorGaugeWarning
                  : '';

                return (
                  <div key={key} className={`${styles.sensorGauge} ${gaugeClass}`}>
                    <div className={styles.sensorGaugeHeader}>
                      <span className={styles.sensorGaugeName}>
                        <SIcon size={13} className={`${styles.sensorGaugeNameIcon} ${state !== 'normal' ? (state === 'critical' ? styles.sensorGaugeIconCritical : styles.sensorGaugeIconWarning) : ''}`} />
                        {formatSensorName(key)}
                      </span>
                      <span
                        className={`${styles.sensorGaugeReading} ${state === 'critical' ? styles.sensorGaugeReadingCritical : state === 'warning' ? styles.sensorGaugeReadingWarning : styles.sensorGaugeReadingNormal}`}
                      >
                        {liveValue}
                        {sensor.unit}
                        {state === 'critical' && (
                          <AlertTriangle
                            size={11}
                            style={{ marginLeft: 4, verticalAlign: 'middle', color: 'var(--color-error)' }}
                          />
                        )}
                      </span>
                    </div>
                    <div className={styles.sensorGaugeTrack}>
                      <div
                        className={`${styles.sensorGaugeFill} ${fillClass}`}
                        style={{ width: `${Math.max(0, Math.min(100, pct))}%` }}
                      />
                      {thresholdPct !== null && (
                        <div
                          className={styles.sensorThresholdMarker}
                          style={{ left: `${Math.max(0, Math.min(100, thresholdPct))}%` }}
                        />
                      )}
                    </div>
                    <div className={styles.sensorGaugeRange}>
                      <span>{sensor.min}{sensor.unit}</span>
                      <span>{sensor.max}{sensor.unit}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Maintenance Info */}
          <div className={styles.detailSection}>
            <div className={styles.detailSectionTitle}>Maintenance &amp; Uptime</div>
            <div className={styles.maintenanceRow}>
              <div className={styles.maintenanceItem}>
                <Activity size={13} />
                <span className={styles.maintenanceLabel}>Uptime:</span>
                <span className={styles.maintenanceValue}>{expandedMachine.uptime}%</span>
              </div>
              <div className={styles.maintenanceItem}>
                <Clock size={13} />
                <span className={styles.maintenanceLabel}>Last Maintenance:</span>
                <span className={styles.maintenanceValue}>
                  {formatDate(expandedMachine.lastMaintenance)}
                </span>
              </div>
              <div className={styles.maintenanceItem}>
                <Wrench size={13} />
                <span className={styles.maintenanceLabel}>Next Maintenance:</span>
                <span className={styles.maintenanceValue}>
                  {formatDate(expandedMachine.nextMaintenance)}
                </span>
              </div>
            </div>
          </div>

          {/* Alert History */}
          {expandedMachine.alerts.length > 0 && (
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>Alert History</div>
              <div className={styles.alertHistoryList}>
                {expandedMachine.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className={`${styles.alertHistoryItem} ${sevHistoryClass(alert.severity)}`}
                  >
                    <div className={styles.alertHistoryContent}>
                      <div className={styles.alertHistoryTop}>
                        <span className={`${styles.alertSeverityBadge} ${sevBadgeClass(alert.severity)}`}>
                          {alert.severity}
                        </span>
                        <span className={styles.alertHistoryType}>
                          {alert.type.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className={styles.alertHistoryMessage}>{alert.message}</div>
                      <div className={styles.alertHistoryTimestamp}>
                        {formatTimestamp(alert.timestamp)}
                      </div>
                    </div>
                    <div className={styles.alertHistoryActions}>
                      {!alert.acknowledged ? (
                        <button
                          className={styles.ackBtn}
                          onClick={(e) => {
                            e.stopPropagation();
                            acknowledgeAlert(expandedMachine.id, alert.id);
                          }}
                        >
                          <Check size={10} />
                          Acknowledge
                        </button>
                      ) : (
                        <span className={styles.ackedLabel}>
                          <Check size={10} /> Ack&apos;d
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Machine Grid */}
      {filteredMachines.length > 0 ? (
        <div className={styles.machineGrid}>
          {filteredMachines.map((m) => (
            <div
              key={m.id}
              className={`${styles.machineGridItem} ${m.status === 'fault' ? styles.machineGridItemFault : ''}`}
            >
              <MachineCard
                name={m.name}
                type={m.type}
                line={m.line}
                status={m.status}
                outputRate={m.outputRate}
                targetOutput={m.targetOutput}
                unit={m.unit}
                uptime={m.uptime}
                sensors={m.sensors}
                alerts={m.alerts}
                onClick={() => handleCardClick(m.id)}
                isExpanded={expandedId === m.id}
              />
            </div>
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <Cpu size={40} />
          <p>No machines match the current filters.</p>
        </div>
      )}

      {/* Active Alerts Panel */}
      <div className={styles.alertsPanel}>
        <div className={styles.alertsPanelHeader}>
          <div className={styles.alertsPanelTitle}>
            <AlertTriangle size={15} />
            Active Machine Alerts
            {activeAlerts.length > 0 && (
              <span className={styles.alertsPanelCount}>{activeAlerts.length}</span>
            )}
          </div>
        </div>

        {activeAlerts.length > 0 ? (
          <div className={styles.alertsList}>
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`${styles.alertRow} ${sevRowClass(alert.severity)} ${alert.severity === 'critical' ? styles.alertRowCriticalPulse : ''}`}
              >
                <div className={styles.alertRowContent}>
                  <div className={styles.alertRowTop}>
                    <span className={`${styles.alertSeverityBadge} ${sevBadgeClass(alert.severity)}`}>
                      {alert.severity}
                    </span>
                    <span className={styles.alertMachineName}>{alert.machineName}</span>
                    <span className={styles.alertHistoryType}>
                      {alert.type.replace(/_/g, ' ')}
                    </span>
                  </div>
                  <div className={styles.alertRowMessage}>{alert.message}</div>
                  <div className={styles.alertRowTimestamp}>
                    {formatTimestamp(alert.timestamp)}
                  </div>
                </div>
                <div className={styles.alertRowActions}>
                  <button
                    className={styles.ackBtn}
                    onClick={() => acknowledgeAlert(alert.machineId, alert.id)}
                  >
                    <Check size={10} />
                    Acknowledge
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className={styles.noAlerts}>
            <div className={styles.noAlertsIcon}>
              <Check size={20} />
            </div>
            <p>All alerts have been acknowledged. No active alerts.</p>
          </div>
        )}
      </div>
    </div>
  );
}
