'use client';

import { useState, useMemo } from 'react';
import Image from 'next/image';
import {
  AlertTriangle, Clock, MapPin, User, Play, X, Camera,
  ChevronDown, ChevronUp, ShieldAlert, Timer, Eye,
} from 'lucide-react';
import { VIOLATION_LOG } from '@/lib/demoSafetyZones';
import styles from './page.module.css';

function formatTimestamp(ts) {
  if (!ts) return '—';
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  }) + ' at ' + d.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

function formatDate(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
  });
}

function formatTime(ts) {
  if (!ts) return '—';
  return new Date(ts).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

const TYPE_LABELS = {
  unauthorized_entry: 'Unauthorized Entry',
  boundary_breach: 'Boundary Breach',
  pedestrian_in_vehicle_zone: 'Pedestrian in Vehicle Zone',
  vehicle_in_pedestrian_zone: 'Vehicle in Pedestrian Zone',
  slip_hazard_entry: 'Slip Hazard Entry',
};

export default function IncidentsPage() {
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [severityFilter, setSeverityFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortField, setSortField] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');

  const incidents = VIOLATION_LOG;

  const stats = useMemo(() => {
    const total = incidents.length;
    const critical = incidents.filter(i => i.severity === 'critical').length;
    const unresolved = incidents.filter(i => i.status === 'unresolved').length;
    const today = incidents.filter(i => {
      const d = new Date(i.timestamp);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    }).length;
    return { total, critical, unresolved, today: total };
  }, [incidents]);

  const filtered = useMemo(() => {
    let list = [...incidents];
    if (severityFilter !== 'all') list = list.filter(i => i.severity === severityFilter);
    if (statusFilter !== 'all') list = list.filter(i => i.status === statusFilter);
    list.sort((a, b) => {
      const aVal = a[sortField] || '';
      const bVal = b[sortField] || '';
      const cmp = aVal > bVal ? 1 : aVal < bVal ? -1 : 0;
      return sortDir === 'desc' ? -cmp : cmp;
    });
    return list;
  }, [incidents, severityFilter, statusFilter, sortField, sortDir]);

  const toggleSort = (field) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  return (
    <div className={styles.page}>
      {/* Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Incidents</h1>
          <p className={styles.pageSubtitle}>Safety zone violations and breach events captured by AI cameras</p>
        </div>
      </div>

      {/* Stats */}
      <div className={styles.statsRow}>
        <div className={styles.statTile}>
          <div className={styles.statIcon}><AlertTriangle size={18} /></div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.total}</span>
            <span className={styles.statLabel}>Total Incidents</span>
          </div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statIcon}><ShieldAlert size={18} /></div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.critical}</span>
            <span className={styles.statLabel}>Critical</span>
          </div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statIcon}><Clock size={18} /></div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.unresolved}</span>
            <span className={styles.statLabel}>Unresolved</span>
          </div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statIcon}><Eye size={18} /></div>
          <div className={styles.statContent}>
            <span className={styles.statValue}>{stats.today}</span>
            <span className={styles.statLabel}>Today</span>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className={styles.toolbar}>
        <div className={styles.filters}>
          {['all', 'critical', 'warning'].map(s => (
            <button
              key={s}
              className={`${styles.filterBtn} ${severityFilter === s ? styles.filterBtnActive : ''}`}
              onClick={() => setSeverityFilter(s)}
            >
              {s === 'all' ? 'All Severity' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
        <div className={styles.filters}>
          {['all', 'unresolved', 'acknowledged', 'resolved'].map(s => (
            <button
              key={s}
              className={`${styles.filterBtn} ${statusFilter === s ? styles.filterBtnActive : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s === 'all' ? 'All Status' : s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Incident Cards */}
      <div className={styles.incidentList}>
        {filtered.map((incident, idx) => (
          <div
            key={incident.id}
            className={`${styles.incidentCard} ${
              incident.severity === 'critical' ? styles.incidentCardCritical : styles.incidentCardWarning
            } ${selectedIncident?.id === incident.id ? styles.incidentCardSelected : ''}`}
            style={{ animationDelay: `${idx * 50}ms` }}
            onClick={() => setSelectedIncident(
              selectedIncident?.id === incident.id ? null : incident
            )}
          >
            {/* Thumbnail */}
            <div className={styles.incidentThumb}>
              <Image
                src={incident.image}
                alt={incident.zoneName}
                fill
                sizes="200px"
                style={{ objectFit: 'cover' }}
              />
              <div className={styles.thumbOverlay}>
                <div className={styles.thumbCameraId}>
                  <Camera size={10} />
                  <span>{incident.camera}</span>
                </div>
                <div className={`${styles.thumbSeverity} ${
                  incident.severity === 'critical' ? styles.thumbSeverityCritical : styles.thumbSeverityWarning
                }`}>
                  {incident.severity}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className={styles.incidentBody}>
              <div className={styles.incidentTop}>
                <span className={styles.incidentType}>
                  {TYPE_LABELS[incident.type] || incident.type}
                </span>
                <span className={`${styles.statusTag} ${styles[`status_${incident.status}`]}`}>
                  {incident.status}
                </span>
              </div>
              <p className={styles.incidentDescription}>{incident.description}</p>
              <div className={styles.incidentMeta}>
                <span className={styles.metaItem}>
                  <Clock size={12} />
                  <span className={styles.metaDate}>{formatDate(incident.timestamp)}</span>
                  <span className={styles.metaTime}>{formatTime(incident.timestamp)}</span>
                </span>
                <span className={styles.metaItem}>
                  <User size={12} />
                  {incident.person}
                </span>
                <span className={styles.metaItem}>
                  <MapPin size={12} />
                  {incident.zoneName}
                </span>
                <span className={styles.metaItem}>
                  <Timer size={12} />
                  {incident.duration}
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className={styles.incidentActions}>
              <button
                className={styles.playbackBtn}
                onClick={(e) => { e.stopPropagation(); }}
                title="View Playback"
              >
                <Play size={14} />
                Playback
              </button>
              <button
                className={styles.expandBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedIncident(
                    selectedIncident?.id === incident.id ? null : incident
                  );
                }}
              >
                {selectedIncident?.id === incident.id
                  ? <ChevronUp size={14} />
                  : <ChevronDown size={14} />
                }
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className={styles.emptyState}>
          <AlertTriangle size={40} />
          <p>No incidents match the selected filters.</p>
        </div>
      )}

      {/* Expanded Detail Modal */}
      {selectedIncident && (
        <div className={styles.detailOverlay} onClick={() => setSelectedIncident(null)}>
          <div className={styles.detailPanel} onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className={styles.detailHeader}>
              <div>
                <h3 className={styles.detailTitle}>
                  {TYPE_LABELS[selectedIncident.type] || selectedIncident.type}
                </h3>
                <span className={styles.detailMeta}>
                  {selectedIncident.camera} • {formatTimestamp(selectedIncident.timestamp)}
                </span>
              </div>
              <button className={styles.detailClose} onClick={() => setSelectedIncident(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Image */}
            <div className={styles.detailImage}>
              <Image
                src={selectedIncident.image}
                alt={selectedIncident.zoneName}
                fill
                sizes="(max-width: 768px) 100vw, 700px"
                style={{ objectFit: 'cover' }}
              />
              <div className={styles.detailImageOverlay}>
                <button className={styles.playbackBtnLarge} onClick={() => {}}>
                  <Play size={20} />
                  View Full Playback
                </button>
              </div>
            </div>

            {/* Info Grid */}
            <div className={styles.detailInfoGrid}>
              <div className={styles.detailInfoItem}>
                <span className={styles.detailInfoLabel}>Employee</span>
                <span className={styles.detailInfoValue}>{selectedIncident.person}</span>
              </div>
              <div className={styles.detailInfoItem}>
                <span className={styles.detailInfoLabel}>Date & Time</span>
                <span className={styles.detailInfoValue}>{formatTimestamp(selectedIncident.timestamp)}</span>
              </div>
              <div className={styles.detailInfoItem}>
                <span className={styles.detailInfoLabel}>Location</span>
                <span className={styles.detailInfoValue}>{selectedIncident.zoneName}</span>
              </div>
              <div className={styles.detailInfoItem}>
                <span className={styles.detailInfoLabel}>Duration</span>
                <span className={styles.detailInfoValue}>{selectedIncident.duration}</span>
              </div>
              <div className={styles.detailInfoItem}>
                <span className={styles.detailInfoLabel}>Severity</span>
                <span className={`${styles.detailInfoValue} ${styles[`severity_${selectedIncident.severity}`]}`}>
                  {selectedIncident.severity}
                </span>
              </div>
              <div className={styles.detailInfoItem}>
                <span className={styles.detailInfoLabel}>Status</span>
                <span className={`${styles.statusTag} ${styles[`status_${selectedIncident.status}`]}`}>
                  {selectedIncident.status}
                </span>
              </div>
            </div>

            {/* Description */}
            <div className={styles.detailSection}>
              <div className={styles.detailSectionTitle}>Description</div>
              <p className={styles.detailDescription}>{selectedIncident.description}</p>
            </div>

            {/* Actions */}
            <div className={styles.detailActions}>
              <button className={styles.playbackBtnLarge} onClick={() => {}}>
                <Play size={16} />
                View Playback
              </button>
              <button className={styles.acknowledgeBtn}>
                Mark as Acknowledged
              </button>
              <button className={styles.resolveBtn}>
                Mark as Resolved
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
