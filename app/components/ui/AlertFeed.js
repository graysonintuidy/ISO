'use client';

import { Bell } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import styles from './AlertFeed.module.css';

const severityBarMap = {
  info: styles.barInfo,
  warning: styles.barWarning,
  critical: styles.barCritical,
  emergency: styles.barEmergency,
};

function formatTimestamp(timestamp) {
  if (!timestamp) return '';
  try {
    const date = typeof timestamp === 'string' ? new Date(timestamp) : timestamp;
    return formatDistanceToNow(date, { addSuffix: true });
  } catch {
    return '';
  }
}

function AlertItem({ alert }) {
  const barClass = severityBarMap[alert.severity] || severityBarMap.info;
  const isEmergency = alert.severity === 'emergency';

  return (
    <div className={styles.alertItem}>
      <div className={`${styles.severityBar} ${barClass}`} />
      <div className={styles.alertContent}>
        <div className={styles.alertHeader}>
          <span
            className={`${styles.alertTitle} ${
              isEmergency ? styles.alertTitleEmergency : ''
            }`}
          >
            {alert.title}
          </span>
          <span className={styles.alertTimestamp}>
            {formatTimestamp(alert.timestamp)}
          </span>
        </div>
        {alert.message && (
          <p className={styles.alertMessage}>{alert.message}</p>
        )}
        {alert.source && (
          <span className={styles.alertSource}>Source: {alert.source}</span>
        )}
      </div>
    </div>
  );
}

export default function AlertFeed({ alerts = [] }) {
  if (!alerts.length) {
    return (
      <div className={styles.feed}>
        <div className={styles.empty}>
          <Bell size={24} className={styles.emptyIcon} />
          <span className={styles.emptyText}>No active alerts</span>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.feed}>
      <div className={styles.list}>
        {alerts.map((alert) => (
          <AlertItem key={alert.id} alert={alert} />
        ))}
      </div>
    </div>
  );
}
