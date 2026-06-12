'use client';

import styles from './StatusBadge.module.css';

const statusConfig = {
  online: { label: 'Online', badgeClass: styles.online, dotClass: styles.dotOnline },
  offline: { label: 'Offline', badgeClass: styles.offline, dotClass: styles.dotOffline },
  warning: { label: 'Warning', badgeClass: styles.warning, dotClass: styles.dotWarning },
  critical: { label: 'Critical', badgeClass: styles.critical, dotClass: styles.dotCritical },
  pending: { label: 'Pending', badgeClass: styles.pending, dotClass: styles.dotPending },
  maintenance: { label: 'Maintenance', badgeClass: styles.maintenance, dotClass: styles.dotMaintenance },
};

export default function StatusBadge({ status, label }) {
  const config = statusConfig[status] || statusConfig.offline;
  const displayLabel = label || config.label;

  return (
    <span className={`${styles.badge} ${config.badgeClass}`}>
      <span className={`${styles.dot} ${config.dotClass}`} />
      {displayLabel}
    </span>
  );
}
