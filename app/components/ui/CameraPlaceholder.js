'use client';

import Link from 'next/link';
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
  lastSeen,
  image,
}) {
  const getMessage = statusMessages[status] || statusMessages.pending_setup;
  const message = getMessage(name, location);
  const statusLabel = statusLabelMap[status] || statusLabelMap.pending_setup;

  const formattedLastSeen = lastSeen
    ? `Last seen: ${new Date(lastSeen).toLocaleString([], { hour: '2-digit', minute: '2-digit' })}`
    : status === 'online'
    ? 'Live now'
    : null;

  return (
    <Link
      href={`/cameras/${cameraId}`}
      className={styles.placeholderLink}
      aria-label={`View ${name || 'camera'} details`}
    >
      <div
        className={styles.placeholder}
        data-camera-id={cameraId}
        style={image ? {
          backgroundImage: `url(${image})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        } : undefined}
      >
        {/* Recording / Live indicator */}
        {status === 'online' && (
          <div className={styles.liveIndicator}>
            <span className={styles.liveDot} />
            <span className={styles.liveLabel}>LIVE</span>
          </div>
        )}

        <span className={`${styles.statusLabel} ${statusLabel.className}`}>
          {statusLabel.text}
        </span>

        {/* Only show camera icon + message when no image */}
        {!image && (
          <>
            <Camera size={40} className={styles.icon} />
            <p className={styles.text}>{message}</p>
          </>
        )}

        {/* Bottom bar: camera name + timestamp */}
        <div className={styles.bottomBar}>
          {name && <span className={styles.cameraName}>{name}</span>}
          {formattedLastSeen && (
            <span className={styles.timestamp}>{formattedLastSeen}</span>
          )}
        </div>
      </div>
    </Link>
  );
}

