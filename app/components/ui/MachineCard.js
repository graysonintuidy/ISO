'use client';

import { Thermometer, Waves, AlertTriangle, Activity } from 'lucide-react';
import styles from './MachineCard.module.css';

const STATUS_CONFIG = {
  running: {
    dotClass: styles.dotRunning,
    labelClass: styles.labelRunning,
    cardClass: styles.statusRunning,
    label: 'Running',
  },
  fault: {
    dotClass: styles.dotFault,
    labelClass: styles.labelFault,
    cardClass: styles.statusFault,
    label: 'Fault',
  },
  warning: {
    dotClass: styles.dotWarning,
    labelClass: styles.labelWarning,
    cardClass: styles.statusWarning,
    label: 'Warning',
  },
  idle: {
    dotClass: styles.dotIdle,
    labelClass: styles.labelIdle,
    cardClass: styles.statusIdle,
    label: 'Idle',
  },
  maintenance: {
    dotClass: styles.dotMaintenance,
    labelClass: styles.labelMaintenance,
    cardClass: styles.statusMaintenance,
    label: 'Maintenance',
  },
};

const SENSOR_ICONS = {
  temperature: Thermometer,
  vibration: Waves,
};

function getOutputPercentage(outputRate, targetOutput) {
  if (!targetOutput || targetOutput === 0) return 0;
  return Math.min(100, Math.round((outputRate / targetOutput) * 100));
}

function getGaugeFillClass(percentage) {
  if (percentage >= 80) return styles.fillGreen;
  if (percentage >= 50) return styles.fillOrange;
  return styles.fillRed;
}

function getSensorState(sensor) {
  if (!sensor || sensor.threshold === undefined) return 'normal';
  const ratio = sensor.value / sensor.threshold;
  if (sensor.value > sensor.threshold) return 'critical';
  if (ratio >= 0.85) return 'warning';
  return 'normal';
}

const sensorStateClasses = {
  normal: styles.sensorNormal,
  warning: styles.sensorWarning,
  critical: styles.sensorCritical,
};

export default function MachineCard({
  name,
  type,
  line,
  status = 'idle',
  outputRate = 0,
  targetOutput = 0,
  unit,
  uptime,
  sensors = {},
  alerts = [],
  onClick,
  isExpanded = false,
}) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.idle;
  const percentage = getOutputPercentage(outputRate, targetOutput);
  const fillClass = getGaugeFillClass(percentage);
  const unacknowledgedAlerts = alerts.filter((a) => !a.acknowledged);

  // Get first two sensor keys (temperature + vibration preferred)
  const sensorKeys = Object.keys(sensors);
  const displaySensors = [];
  const preferred = ['temperature', 'vibration'];
  for (const key of preferred) {
    if (sensors[key]) displaySensors.push({ key, ...sensors[key] });
  }
  // Fill remaining from others
  for (const key of sensorKeys) {
    if (displaySensors.length >= 2) break;
    if (!preferred.includes(key) && sensors[key]) {
      displaySensors.push({ key, ...sensors[key] });
    }
  }

  const cardClasses = [
    styles.card,
    cfg.cardClass,
    isExpanded ? styles.cardExpanded : '',
  ].filter(Boolean).join(' ');

  return (
    <div
      className={cardClasses}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onClick?.(); }}
    >
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.nameBlock}>
            <div className={styles.name}>{name}</div>
            {type && <span className={styles.typeBadge}>{type}</span>}
          </div>
        </div>
        <div className={styles.headerRight}>
          {unacknowledgedAlerts.length > 0 && (
            <span className={styles.alertBadge}>
              {unacknowledgedAlerts.length}
            </span>
          )}
          <div className={styles.statusIndicator}>
            <span className={`${styles.statusDot} ${cfg.dotClass}`} />
            <span className={`${styles.statusLabel} ${cfg.labelClass}`}>
              {cfg.label}
            </span>
          </div>
        </div>
      </div>

      {/* Output Gauge */}
      <div className={styles.gaugeSection}>
        <div className={styles.gaugeLabel}>
          <span>
            Output:{' '}
            <span className={styles.gaugeValue}>
              {outputRate.toLocaleString()}
            </span>
            {unit && <span className={styles.gaugeTarget}> {unit}</span>}
            <span className={`${styles.gaugePercent} ${fillClass === styles.fillGreen ? styles.labelRunning : fillClass === styles.fillOrange ? styles.labelWarning : styles.labelFault}`}>
              {percentage}%
            </span>
          </span>
          <span className={styles.gaugeTarget}>
            Target: {targetOutput.toLocaleString()}
          </span>
        </div>
        <div className={styles.gaugeTrack}>
          <div
            className={`${styles.gaugeFill} ${fillClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Sensor Readings */}
      {displaySensors.length > 0 && (
        <div className={styles.sensorsRow}>
          {displaySensors.map((sensor) => {
            const state = getSensorState(sensor);
            const stateClass = sensorStateClasses[state];
            const SensorIcon = SENSOR_ICONS[sensor.key] || Activity;
            return (
              <div key={sensor.key} className={`${styles.sensorChip} ${stateClass}`}>
                <SensorIcon size={14} className={styles.sensorIcon} />
                <div className={styles.sensorInfo}>
                  <span className={styles.sensorName}>{sensor.key}</span>
                  <span className={styles.sensorValue}>
                    {sensor.value}{sensor.unit}
                    {state === 'critical' && (
                      <AlertTriangle size={10} style={{ marginLeft: 3, verticalAlign: 'middle' }} />
                    )}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className={styles.footer}>
        <div className={styles.uptimeRow}>
          <Activity size={11} />
          <span>Uptime: <span className={styles.uptimeValue}>{uptime}%</span></span>
        </div>
        {line && <span className={styles.lineLabel}>{line}</span>}
      </div>
    </div>
  );
}
