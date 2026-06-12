'use client';

import { Camera } from 'lucide-react';
import styles from './CameraPlaceholder.module.css';

const statusMessages = {
  pending_setup: (name, location) =>
    `Add camera ${name || ''} to see live feed of ${location || 'this location'}`,
  offline: () => 'Camera Offline',
  maintenance: () => 'Maintenance Mode',
  online: () => 'Feed connecting...',
};

const statusLabelMap = {
  pending_setup: { text: 'Pending Setup', className: styles.statusPending },
  online: { text: 'Online', className: styles.statusOnline },
  offline: { text: 'Offline', className: styles.statusOffline },
  maintenance: { text: 'Maintenance', className: styles.statusMaintenance },
};

export default function CameraPlaceholder({
  name,
  location,
  status = 'pending_setup',
  cameraId,
}) {
  const getMessage = statusMessages[status] || statusMessages.pending_setup;
  const message = getMessage(name, location);
  const statusLabel = statusLabelMap[status] || statusLabelMap.pending_setup;

  return (
    <div className={styles.placeholder} data-camera-id={cameraId}>
      <span className={`${styles.statusLabel} ${statusLabel.className}`}>
        {statusLabel.text}
      </span>
      <Camera size={40} className={styles.icon} />
      <p className={styles.text}>{message}</p>
      {name && <span className={styles.cameraName}>{name}</span>}
    </div>
  );
}
