'use client';

import { Factory, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import styles from './ProductionLineCard.module.css';

const statusDotMap = {
  running: styles.dotRunning,
  stopped: styles.dotStopped,
  maintenance: styles.dotMaintenance,
  alert: styles.dotAlert,
};

const statusTextMap = {
  running: styles.textRunning,
  stopped: styles.textStopped,
  maintenance: styles.textMaintenance,
  alert: styles.textAlert,
};

const statusLabels = {
  running: 'Running',
  stopped: 'Stopped',
  maintenance: 'Maintenance',
  alert: 'Alert',
};

function getThroughputPercentage(throughput, targetThroughput) {
  if (!targetThroughput || targetThroughput === 0) return 0;
  return Math.min(100, Math.round((throughput / targetThroughput) * 100));
}

function getThroughputFillClass(percentage) {
  if (percentage >= 80) return styles.fillNormal;
  if (percentage >= 50) return styles.fillWarning;
  return styles.fillCritical;
}

function formatLastEvent(lastEvent) {
  if (!lastEvent) return 'No recent events';
  try {
    const date = typeof lastEvent === 'string' ? new Date(lastEvent) : lastEvent;
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return 'Unknown';
  }
}

export default function ProductionLineCard({
  name,
  lineNumber,
  status = 'stopped',
  throughput = 0,
  targetThroughput = 0,
  lastEvent,
}) {
  const percentage = getThroughputPercentage(throughput, targetThroughput);
  const fillClass = getThroughputFillClass(percentage);
  const dotClass = statusDotMap[status] || statusDotMap.stopped;
  const textClass = statusTextMap[status] || statusTextMap.stopped;
  const statusLabel = statusLabels[status] || 'Unknown';

  return (
    <div className={styles.card}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <Factory size={18} className={styles.factoryIcon} />
          <div className={styles.nameBlock}>
            <div className={styles.name}>{name}</div>
            {lineNumber !== undefined && lineNumber !== null && (
              <span className={styles.lineNumber}>Line {lineNumber}</span>
            )}
          </div>
        </div>
        <div className={styles.statusBlock}>
          <span className={`${styles.statusDot} ${dotClass}`} />
          <span className={`${styles.statusText} ${textClass}`}>{statusLabel}</span>
        </div>
      </div>

      {/* Throughput */}
      <div className={styles.throughputSection}>
        <div className={styles.throughputLabel}>
          <span>
            Throughput:{' '}
            <span className={styles.throughputValue}>{throughput}</span>
          </span>
          <span className={styles.throughputTarget}>
            Target: {targetThroughput}
          </span>
        </div>
        <div className={styles.throughputBarTrack}>
          <div
            className={`${styles.throughputBarFill} ${fillClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className={styles.footer}>
        <Clock size={12} />
        <span>Last event: {formatLastEvent(lastEvent)}</span>
      </div>
    </div>
  );
}
