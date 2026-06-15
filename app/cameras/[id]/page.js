'use client';

import { use, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  Video,
  Radio,
  Monitor,
  Clock,
  Calendar,
  Settings,
  Trash2,
  Pencil,
  ChevronUp,
  ChevronDown,
  ChevronLeft as ArrowLeftIcon,
  ChevronRight as ArrowRightIcon,
  ZoomIn,
  ZoomOut,
  Home,
  AlertTriangle,
  Activity,
  Shield,
  Eye,
} from 'lucide-react';
import VideoPlayer from '@/app/components/ui/VideoPlayer';
import StatusBadge from '@/app/components/ui/StatusBadge';
import styles from './page.module.css';

/* ── Helpers ─────────────────────────────────────────────── */

/** Map camera status to a StatusBadge-compatible value */
function mapStatusToBadge(status) {
  const map = {
    online: 'online',
    offline: 'offline',
    pending_setup: 'pending',
    maintenance: 'maintenance',
  };
  return map[status] || 'offline';
}

/** Map severity level to CSS class */
function severityStripClass(severity) {
  const map = {
    low: styles.severityLow,
    medium: styles.severityMedium,
    high: styles.severityHigh,
    critical: styles.severityCritical,
  };
  return map[severity] || styles.severityLow;
}

/** Map severity to badge class */
function severityBadgeClass(severity) {
  const map = {
    low: styles.severityBadgeLow,
    medium: styles.severityBadgeMedium,
    high: styles.severityBadgeHigh,
    critical: styles.severityBadgeCritical,
  };
  return map[severity] || styles.severityBadgeLow;
}

/** Format event type to readable label */
function formatEventType(type) {
  return (type || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Status dot color class */
function statusDotClass(status) {
  const map = {
    online: styles.statusDotOnline,
    offline: styles.statusDotOffline,
    pending_setup: styles.statusDotPending,
    maintenance: styles.statusDotMaintenance,
  };
  return map[status] || styles.statusDotOffline;
}

/** Generate timeline hour labels for last 24h */
function getTimelineHours() {
  const now = new Date();
  const hours = [];
  for (let i = 24; i >= 0; i -= 4) {
    const d = new Date(now.getTime() - i * 60 * 60 * 1000);
    hours.push(
      d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })
    );
  }
  return hours;
}

/* ── Component ───────────────────────────────────────────── */

export default function CameraDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();

  const [camera, setCamera] = useState(null);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchCamera = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/cameras/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setCamera(data.camera);
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to fetch camera:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchCamera();
  }, [fetchCamera]);

  /* ── Loading state ─────────── */
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.breadcrumb}>
          <Link href="/cameras" className={styles.breadcrumbLink}>Cameras</Link>
          <ChevronRight size={14} className={styles.breadcrumbSep} />
          <span className={styles.breadcrumbCurrent}>Loading…</span>
        </div>
        <div className={styles.loadingContainer}>
          <span className="loading-spinner" />
          <p>Loading camera details…</p>
        </div>
      </div>
    );
  }

  /* ── Error state ───────────── */
  if (error || !camera) {
    return (
      <div className={styles.page}>
        <div className={styles.breadcrumb}>
          <Link href="/cameras" className={styles.breadcrumbLink}>Cameras</Link>
          <ChevronRight size={14} className={styles.breadcrumbSep} />
          <span className={styles.breadcrumbCurrent}>Error</span>
        </div>
        <div className={styles.errorContainer}>
          <AlertTriangle size={40} className={styles.errorIcon} />
          <p className={styles.errorTitle}>Camera Not Found</p>
          <p className={styles.errorMessage}>
            {error || 'Unable to load camera details. Please try again.'}
          </p>
          <button className="btn btn-secondary" onClick={() => router.push('/cameras')}>
            <ArrowLeft size={16} />
            Back to Cameras
          </button>
        </div>
      </div>
    );
  }

  const isPTZ = camera.camera_type === 'ptz';
  const timelineHours = getTimelineHours();

  /* ── Main render ───────────── */
  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/cameras" className={styles.breadcrumbLink}>Cameras</Link>
        <ChevronRight size={14} className={styles.breadcrumbSep} />
        <span className={styles.breadcrumbCurrent}>{camera.name}</span>
      </nav>

      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <button
            className={styles.backBtn}
            onClick={() => router.push('/cameras')}
            aria-label="Back to cameras"
          >
            <ArrowLeft size={18} />
          </button>
          <div className={styles.headerInfo}>
            <h1 className={styles.pageTitle}>
              {camera.name}
              <span className={`${styles.statusDot} ${statusDotClass(camera.status)}`} />
              <StatusBadge status={mapStatusToBadge(camera.status)} />
            </h1>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-secondary btn-sm">
            <Pencil size={14} />
            Edit
          </button>
          <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-error)' }}>
            <Trash2 size={14} />
            Delete
          </button>
        </div>
      </div>

      {/* ── Two-Column Layout ─────── */}
      <div className={styles.mainLayout}>
        {/* Left — Video + Timeline + PTZ */}
        <div className={styles.videoPanel}>
          {/* Video Player */}
          <div className={styles.videoWrapper}>
            <VideoPlayer
              streamUrl={camera.stream_url}
              cameraName={camera.name}
              cameraId={camera.id}
              status={camera.status}
              showControls
              showLabel
              autoPlay
              muted
              posterImage={camera.image}
            />
          </div>

          {/* Playback Timeline */}
          <div className={styles.timeline}>
            <div className={styles.timelineHeader}>
              <span className={styles.timelineTitle}>Playback Timeline</span>
              <span className={styles.timelineDate}>
                {new Date().toLocaleDateString([], {
                  weekday: 'short',
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
            <div className={styles.timelineTrack}>
              <div className={styles.timelineProgress} />
              <div className={styles.timelinePlayhead} />
              <div className={styles.timelineTicks}>
                {timelineHours.map((_, i) => (
                  <div key={i} className={styles.timelineTick} />
                ))}
              </div>
            </div>
            <div className={styles.timelineMarkers}>
              {timelineHours.map((hour, i) => (
                <span key={i} className={styles.timelineMarker}>{hour}</span>
              ))}
            </div>
          </div>

          {/* PTZ Controls (only for PTZ cameras) */}
          {isPTZ && (
            <div className={styles.ptzPanel}>
              <div className={styles.ptzHeader}>PTZ Controls</div>
              <div className={styles.ptzControls}>
                {/* Directional Pad */}
                <div className={styles.ptzDpad}>
                  <button className={`${styles.ptzBtn} ${styles.ptzUp}`} aria-label="Pan Up">
                    <ChevronUp size={16} />
                  </button>
                  <button className={`${styles.ptzBtn} ${styles.ptzLeft}`} aria-label="Pan Left">
                    <ArrowLeftIcon size={16} />
                  </button>
                  <button className={`${styles.ptzBtn} ${styles.ptzHome}`} aria-label="Home Position">
                    <Home size={14} />
                  </button>
                  <button className={`${styles.ptzBtn} ${styles.ptzRight}`} aria-label="Pan Right">
                    <ArrowRightIcon size={16} />
                  </button>
                  <button className={`${styles.ptzBtn} ${styles.ptzDown}`} aria-label="Pan Down">
                    <ChevronDown size={16} />
                  </button>
                </div>
                {/* Zoom Controls */}
                <div className={styles.ptzZoom}>
                  <span className={styles.ptzZoomLabel}>Zoom</span>
                  <button className={styles.ptzBtn} aria-label="Zoom In">
                    <ZoomIn size={16} />
                  </button>
                  <button className={styles.ptzBtn} aria-label="Zoom Out">
                    <ZoomOut size={16} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right — Info Sidebar */}
        <div className={styles.sidebar}>
          {/* Camera Details */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>Camera Details</div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <MapPin size={14} /> Location
              </span>
              <span className={styles.infoValueText}>{camera.location_description || '—'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Video size={14} /> Type
              </span>
              <span className={styles.infoValueText} style={{ textTransform: 'uppercase' }}>
                {camera.camera_type || '—'}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Shield size={14} /> Zone
              </span>
              <span className={styles.infoValueText}>{camera.zone || '—'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Radio size={14} /> Status
              </span>
              <StatusBadge status={mapStatusToBadge(camera.status)} />
            </div>
          </div>

          {/* Technical Specs */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>Technical Specs</div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Monitor size={14} /> Resolution
              </span>
              <span className={styles.infoValue}>{camera.resolution || '—'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Activity size={14} /> Frame Rate
              </span>
              <span className={styles.infoValue}>{camera.fps ? `${camera.fps} fps` : '—'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Settings size={14} /> Codec
              </span>
              <span className={styles.infoValue}>{camera.codec || '—'}</span>
            </div>
          </div>

          {/* Uptime & Metadata */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>Uptime & Metadata</div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Clock size={14} /> Uptime
              </span>
              <span className={styles.infoValue}>{camera.uptime || '—'}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Eye size={14} /> Last Seen
              </span>
              <span className={styles.infoValue}>
                {camera.last_seen
                  ? formatDistanceToNow(new Date(camera.last_seen), { addSuffix: true })
                  : '—'}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Calendar size={14} /> Created
              </span>
              <span className={styles.infoValue}>
                {camera.created_at
                  ? new Date(camera.created_at).toLocaleDateString([], {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })
                  : '—'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Events (Full Width) ─────── */}
      <div className={styles.eventsSection}>
        <div className={styles.eventsHeader}>
          <h2 className={styles.eventsTitle}>Recent Events</h2>
          <span className={styles.eventsCount}>{events.length} event{events.length !== 1 ? 's' : ''}</span>
        </div>

        {events.length === 0 ? (
          <div className="empty-state">
            <Activity size={36} />
            <p>No recent events detected for this camera.</p>
          </div>
        ) : (
          <div className={styles.eventsList}>
            {events.map((evt) => (
              <div key={evt.id} className={styles.eventCard}>
                <div className={`${styles.eventSeverityStrip} ${severityStripClass(evt.severity)}`} />
                <div className={styles.eventContent}>
                  <div className={styles.eventTopRow}>
                    <span className={styles.eventType}>{formatEventType(evt.type)}</span>
                    <span className={severityBadgeClass(evt.severity)}>{evt.severity}</span>
                  </div>
                  <p className={styles.eventDescription}>{evt.description}</p>
                  <div className={styles.eventMeta}>
                    <span className={styles.eventTime}>
                      {formatDistanceToNow(new Date(evt.timestamp), { addSuffix: true })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
