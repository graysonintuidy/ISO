'use client';

import { use, useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronRight,
  MapPin,
  Camera,
  AlertTriangle,
  Clock,
  User,
  Timer,
  ShieldAlert,
  ShieldCheck,
  Pencil,
  X,
  Activity,
  Shield,
  Calendar,
  Hash,
  Palette,
  FileText,
  Save,
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
  return (type || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(ts) {
  if (!ts) return '—';
  try {
    return new Date(ts).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '—';
  }
}

/* ---------- Sub-components ---------- */

function SeverityBadge({ severity }) {
  let cls = styles.severityBadge;
  if (severity === 'critical') cls += ` ${styles.severityCritical}`;
  else if (severity === 'warning') cls += ` ${styles.severityWarning}`;
  return <span className={cls}>{severity}</span>;
}

function StatusTag({ status }) {
  let cls = styles.statusTag;
  if (status === 'unresolved') cls += ` ${styles.statusUnresolved}`;
  else if (status === 'acknowledged') cls += ` ${styles.statusAcknowledged}`;
  else if (status === 'resolved') cls += ` ${styles.statusResolved}`;
  return <span className={cls}>{status}</span>;
}

const ZONE_COLORS = [
  '#DC2626', '#F97316', '#F59E0B', '#10B981',
  '#2563EB', '#7C3AED', '#EC4899', '#6B7280',
];

/* ---------- Edit Modal ---------- */

function EditZoneModal({ zone, onClose, onSave }) {
  const [name, setName] = useState(zone.name);
  const [zoneType, setZoneType] = useState(zone.zone_type || zone.type);
  const [location, setLocation] = useState(zone.location);
  const [description, setDescription] = useState(zone.description);
  const [color, setColor] = useState(zone.zoneColor);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        name,
        zone_type: zoneType,
        color,
        metadata: {
          camera: zone.camera,
          image: zone.image,
          location,
          status: zone.status,
          severity: zone.severity,
          description,
          breachCount: zone.breachCount,
          todayBreaches: zone.todayBreaches,
          lastBreach: zone.lastBreach,
        },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className={styles.modalOverlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <div className={styles.modalHeader}>
          <span className={styles.modalTitle}>Edit Safety Zone</span>
          <button className={styles.modalCloseBtn} onClick={onClose} aria-label="Close">
            <X size={16} />
          </button>
        </div>
        <form onSubmit={handleSubmit}>
          <div className={styles.modalBody}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="zone-name">Zone Name</label>
              <input
                id="zone-name"
                className={styles.formInput}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="zone-type">Zone Type</label>
              <select
                id="zone-type"
                className={styles.formSelect}
                value={zoneType}
                onChange={(e) => setZoneType(e.target.value)}
              >
                <option value="restricted">Restricted</option>
                <option value="hazardous">Hazardous / Caution</option>
                <option value="authorized">Emergency</option>
                <option value="general">General</option>
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="zone-location">Location</label>
              <input
                id="zone-location"
                className={styles.formInput}
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="zone-desc">Description</label>
              <textarea
                id="zone-desc"
                className={styles.formTextarea}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel}>Zone Color</label>
              <div className={styles.colorSwatches}>
                {ZONE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className={`${styles.colorSwatch} ${color === c ? styles.colorSwatchSelected : ''}`}
                    style={{ background: c }}
                    onClick={() => setColor(c)}
                    aria-label={`Select color ${c}`}
                  />
                ))}
              </div>
            </div>
          </div>
          <div className={styles.modalFooter}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary btn-sm" disabled={saving}>
              <Save size={14} />
              {saving ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ============================================================
   SafetyZoneDetailPage
   ============================================================ */
export default function SafetyZoneDetailPage({ params }) {
  const { id } = use(params);
  const router = useRouter();

  const [zone, setZone] = useState(null);
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [incidentFilter, setIncidentFilter] = useState('all');

  const fetchZone = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await fetch(`/api/zones/${id}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setZone(data.zone);
      setIncidents(data.incidents || []);
    } catch (err) {
      console.error('Failed to fetch zone:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchZone();
  }, [fetchZone]);

  /* ---------- Filtered incidents ---------- */
  const filteredIncidents = useMemo(() => {
    let result = [...incidents];
    if (incidentFilter === 'critical') result = result.filter((v) => v.severity === 'critical');
    else if (incidentFilter === 'warning') result = result.filter((v) => v.severity === 'warning');
    result.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    return result;
  }, [incidentFilter, incidents]);

  /* ---------- Save handler ---------- */
  const handleSave = useCallback(async (updateData) => {
    try {
      const res = await fetch(`/api/zones/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updateData),
      });
      if (!res.ok) throw new Error('Failed to save');
      setShowEditModal(false);
      // Refresh data
      await fetchZone();
    } catch (err) {
      console.error('Save failed:', err);
      alert('Failed to save changes. Please try again.');
    }
  }, [id, fetchZone]);

  /* ---------- Loading state ---------- */
  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.breadcrumb}>
          <Link href="/safety-zones" className={styles.breadcrumbLink}>Safety Zones</Link>
          <ChevronRight size={14} className={styles.breadcrumbSep} />
          <span className={styles.breadcrumbCurrent}>Loading…</span>
        </div>
        <div className={styles.loadingContainer}>
          <span className="loading-spinner" />
          <p>Loading zone details…</p>
        </div>
      </div>
    );
  }

  /* ---------- Error state ---------- */
  if (error || !zone) {
    return (
      <div className={styles.page}>
        <div className={styles.breadcrumb}>
          <Link href="/safety-zones" className={styles.breadcrumbLink}>Safety Zones</Link>
          <ChevronRight size={14} className={styles.breadcrumbSep} />
          <span className={styles.breadcrumbCurrent}>Error</span>
        </div>
        <div className={styles.errorContainer}>
          <AlertTriangle size={40} className={styles.errorIcon} />
          <p className={styles.errorTitle}>Zone Not Found</p>
          <p className={styles.errorMessage}>
            {error || 'Unable to load zone details. Please try again.'}
          </p>
          <button className="btn btn-secondary" onClick={() => router.push('/safety-zones')}>
            <ArrowLeft size={16} />
            Back to Safety Zones
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Breadcrumb */}
      <nav className={styles.breadcrumb} aria-label="Breadcrumb">
        <Link href="/safety-zones" className={styles.breadcrumbLink}>Safety Zones</Link>
        <ChevronRight size={14} className={styles.breadcrumbSep} />
        <span className={styles.breadcrumbCurrent}>{zone.name}</span>
      </nav>

      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div className={styles.headerLeft}>
          <button
            className={styles.backBtn}
            onClick={() => router.push('/safety-zones')}
            aria-label="Back to safety zones"
          >
            <ArrowLeft size={18} />
          </button>
          <div className={styles.headerInfo}>
            <h1 className={styles.pageTitle}>
              {zone.name}
              <span
                className={`${styles.statusBadge} ${
                  zone.status === 'breach' ? styles.statusBreach : styles.statusClear
                }`}
              >
                {zone.status === 'breach' ? 'BREACH' : 'CLEAR'}
              </span>
            </h1>
            <div className={styles.headerMeta}>
              <span className={styles.zoneTypeBadge}>{zone.type}</span>
              <span className={styles.headerMetaSep}>·</span>
              <span>{zone.camera}</span>
              <span className={styles.headerMetaSep}>·</span>
              <span>{zone.location}</span>
            </div>
          </div>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-secondary btn-sm" onClick={() => setShowEditModal(true)}>
            <Pencil size={14} />
            Edit Zone
          </button>
        </div>
      </div>

      {/* ── Two-Column Layout ─────── */}
      <div className={styles.mainLayout}>
        {/* Left — Camera Feed + Description */}
        <div className={styles.cameraPanel}>
          {/* Camera Image */}
          <div className={styles.cameraWrapper}>
            <Image
              src={zone.image}
              alt={zone.name}
              fill
              sizes="(max-width: 900px) 100vw, 60vw"
              className={styles.cameraImage}
            />
            <div className={styles.cameraOverlay}>
              <span className={styles.cameraId}>
                <Camera size={12} />
                {zone.camera}
              </span>
              <span
                className={`${styles.cameraStatusBadge} ${
                  zone.status === 'breach'
                    ? styles.cameraStatusBreach
                    : styles.cameraStatusClear
                }`}
              >
                {zone.status === 'breach' ? 'BREACH' : 'CLEAR'}
              </span>
            </div>
          </div>

          {/* Description */}
          <div className={styles.descriptionCard}>
            <div className={styles.descriptionTitle}>
              <FileText size={12} style={{ display: 'inline', marginRight: 4, verticalAlign: 'middle' }} />
              Zone Description
            </div>
            <div className={styles.descriptionText}>
              {zone.description || 'No description provided.'}
            </div>
          </div>
        </div>

        {/* Right — Info Sidebar */}
        <div className={styles.sidebar}>
          {/* Zone Details */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>Zone Information</div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Shield size={14} /> Zone
              </span>
              <span className={styles.infoValue}>{zone.name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Hash size={14} /> Type
              </span>
              <span className={styles.infoValue} style={{ textTransform: 'capitalize' }}>
                {zone.type}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Camera size={14} /> Camera
              </span>
              <span className={styles.infoValueMono}>{zone.camera}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <MapPin size={14} /> Location
              </span>
              <span className={styles.infoValue}>{zone.location}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Palette size={14} /> Zone Color
              </span>
              <span
                style={{
                  display: 'inline-block',
                  width: 16,
                  height: 16,
                  borderRadius: 4,
                  background: zone.zoneColor,
                  border: '1px solid var(--color-border)',
                }}
              />
            </div>
          </div>

          {/* Breach Statistics */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>Breach Statistics</div>
            <div className={styles.statRow}>
              <div className={styles.statTile}>
                <span className={`${styles.statValue} ${zone.breachCount > 0 ? styles.statValueError : ''}`}>
                  {zone.breachCount}
                </span>
                <span className={styles.statLabel}>Total Breaches</span>
              </div>
              <div className={styles.statTile}>
                <span className={`${styles.statValue} ${zone.todayBreaches > 0 ? styles.statValueWarning : ''}`}>
                  {zone.todayBreaches}
                </span>
                <span className={styles.statLabel}>Today</span>
              </div>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Activity size={14} /> Status
              </span>
              <span
                className={`${styles.statusBadge} ${
                  zone.status === 'breach' ? styles.statusBreach : styles.statusClear
                }`}
              >
                {zone.status === 'breach' ? 'BREACH' : 'CLEAR'}
              </span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Clock size={14} /> Last Breach
              </span>
              <span className={styles.infoValueMono}>
                {zone.lastBreach ? formatTimestamp(zone.lastBreach) : 'None'}
              </span>
            </div>
          </div>

          {/* Timestamps */}
          <div className={styles.infoCard}>
            <div className={styles.infoCardTitle}>Metadata</div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Calendar size={14} /> Created
              </span>
              <span className={styles.infoValue}>{formatDate(zone.created_at)}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>
                <Clock size={14} /> Updated
              </span>
              <span className={styles.infoValue}>{formatDate(zone.updated_at)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Incident History (Full Width) ─────── */}
      <div className={styles.incidentSection}>
        <div className={styles.incidentHeader}>
          <div className={styles.incidentTitle}>
            <AlertTriangle size={15} />
            Incident History
            <span className={styles.incidentCount}>{filteredIncidents.length}</span>
          </div>
          <div className={styles.filterGroup}>
            {['all', 'critical', 'warning'].map((key) => (
              <button
                key={key}
                className={`${styles.filterBtn} ${incidentFilter === key ? styles.filterBtnActive : ''}`}
                onClick={() => setIncidentFilter(key)}
              >
                {key === 'all' ? 'All' : key.charAt(0).toUpperCase() + key.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {filteredIncidents.length > 0 ? (
          <>
            <div className={styles.incidentTableHeader}>
              <span>Time</span>
              <span>Camera</span>
              <span>Severity</span>
              <span>Type</span>
              <span>Description</span>
              <span>Person</span>
              <span>Duration</span>
              <span>Status</span>
            </div>
            <div className={styles.incidentTableBody}>
              {filteredIncidents.map((v) => (
                <div
                  key={v.id}
                  className={`${styles.incidentRow} ${
                    v.severity === 'critical'
                      ? styles.incidentRowCritical
                      : styles.incidentRowWarning
                  }`}
                >
                  <span className={styles.cellTime}>{formatTime(v.timestamp)}</span>
                  <span className={styles.cellCamera}>{v.camera}</span>
                  <span><SeverityBadge severity={v.severity} /></span>
                  <span className={styles.cellType}>{formatViolationType(v.type)}</span>
                  <span className={styles.cellDesc}>{v.description}</span>
                  <span className={styles.cellPerson}>
                    <User size={10} />
                    {v.person}
                  </span>
                  <span className={styles.cellDuration}>
                    <Timer size={10} />
                    {v.duration}
                  </span>
                  <span><StatusTag status={v.status} /></span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.noIncidents}>
            <ShieldCheck size={32} />
            <p>No incidents recorded for this zone.</p>
          </div>
        )}
      </div>

      {/* ── Edit Modal ─────── */}
      {showEditModal && (
        <EditZoneModal
          zone={zone}
          onClose={() => setShowEditModal(false)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}
