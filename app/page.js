'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Camera,
  AlertTriangle,
  Users,
  Factory,
  ShieldCheck,
  Wifi,
  X,
  Clock,
  MapPin,
  User,
  Timer,
  Eye,
  ExternalLink,
} from 'lucide-react';
import StatTile from '@/app/components/ui/StatTile';
import CameraFeedGrid from '@/app/components/ui/CameraFeedGrid';
import ProductionLineCard from '@/app/components/ui/ProductionLineCard';
import AlertFeed from '@/app/components/ui/AlertFeed';
import DataTable from '@/app/components/ui/DataTable';
import AIInsightsPanel from '@/app/components/ui/AIInsightsPanel';
import AIAnalysisPanel from '@/app/components/ui/AIAnalysisPanel';

import styles from './page.module.css';

const REFRESH_INTERVAL = 30000; // 30 seconds



export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedIncident, setSelectedIncident] = useState(null);

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?facilityId=1');
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (error) {
      // API not available — use mock data silently
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const stats = dashboardData?.stats || { cameras: { online: 0, total: 0 }, alerts: { active: 0, critical: 0 }, employees: { onShift: 0, total: 0 }, productionLines: { running: 0, total: 0 }, devices: { online: 0, total: 0 }, safetyScore: 100 };
  const alerts = dashboardData?.alerts || [];
  const incidents = (dashboardData?.incidents || []).map(inc => ({
    ...inc,
    incident_type: (inc.incident_type || '').replace(/_/g, ' '),
    title: inc.title || inc.description,
  }));
  const productionLines = dashboardData?.productionLines || [];
  const cameras = dashboardData?.cameras || [];

  // Incident table columns
  const incidentColumns = [
    {
      key: 'severity',
      label: 'Severity',
      sortable: true,
      render: (value) => (
        <span className={`badge badge-${value === 'critical' ? 'error' : value === 'high' ? 'warning' : value === 'medium' ? 'info' : 'neutral'}`}>
          {value}
        </span>
      ),
    },
    { key: 'title', label: 'Incident', sortable: true },
    { key: 'incident_type', label: 'Type', sortable: true },
    { key: 'status', label: 'Status', sortable: true,
      render: (value) => (
        <span className={`badge ${value === 'open' ? 'badge-error' : value === 'investigating' ? 'badge-warning' : 'badge-success'}`}>
          {value}
        </span>
      ),
    },
    {
      key: 'created_at',
      label: 'Time',
      sortable: true,
      render: (value) => value ? new Date(value).toLocaleString() : '—',
    },
  ];

  return (
    <div className={styles.dashboard}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Dashboard</h1>
          <p className={styles.pageSubtitle}>
            Kansas City, KS (KCK) — Real-time monitoring overview
          </p>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.refreshIndicator}>
            {loading ? (
              <span className="loading-spinner" />
            ) : (
              <span className={styles.liveIndicator}>● Live</span>
            )}
          </span>
        </div>
      </div>

      {/* Stats Row */}
      <div className={styles.statsRow}>
        <StatTile
          title="Cameras Online"
          value={`${stats.cameras.online}/${stats.cameras.total}`}
          icon={Camera}
          severity={stats.cameras.online === 0 && stats.cameras.total === 0 ? 'default' : stats.cameras.online < stats.cameras.total ? 'warning' : 'success'}
        />
        <StatTile
          title="Active Alerts"
          value={stats.alerts.active}
          icon={AlertTriangle}
          severity={stats.alerts.critical > 0 ? 'critical' : stats.alerts.active > 0 ? 'warning' : 'success'}
          change={stats.alerts.critical > 0 ? `${stats.alerts.critical} critical` : null}
          changeDirection={stats.alerts.critical > 0 ? 'up' : 'neutral'}
        />
        <StatTile
          title="Employees On Shift"
          value={stats.employees.onShift}
          icon={Users}
          severity="default"
        />
        <StatTile
          title="Production Lines"
          value={`${stats.productionLines.running}/${stats.productionLines.total}`}
          icon={Factory}
          severity={stats.productionLines.running === 0 && stats.productionLines.total > 0 ? 'warning' : 'default'}
        />
        <StatTile
          title="Safety Score"
          value={stats.safetyScore}
          icon={ShieldCheck}
          severity={stats.safetyScore >= 90 ? 'success' : stats.safetyScore >= 70 ? 'warning' : 'critical'}
          change={stats.safetyScore >= 90 ? 'Excellent' : stats.safetyScore >= 70 ? 'Good' : 'Needs Attention'}
          changeDirection={stats.safetyScore >= 90 ? 'up' : 'down'}
        />
        <StatTile
          title="IoT Devices"
          value={`${stats.devices.online}/${stats.devices.total}`}
          icon={Wifi}
          severity={stats.devices.online < stats.devices.total ? 'warning' : 'default'}
        />
      </div>

      {/* Camera Feeds — Full Width */}
      <div className={`card ${styles.cameraCard}`}>
        <div className="card-header">
          <span className="card-title">Camera Feeds</span>
          <span className={styles.countBadge}>{cameras.length} cameras</span>
        </div>
        <CameraFeedGrid cameras={cameras} />
      </div>

      {/* Production Lines — Full Width Row */}
      <div className={`card ${styles.productionCard}`}>
        <div className="card-header">
          <span className="card-title">Production Lines</span>
          <span className={styles.countBadge}>
            {productionLines.length > 0 ? `${productionLines.length} lines` : 'No lines configured'}
          </span>
        </div>
        <div className={styles.productionGrid}>
          {productionLines.length > 0 ? (
            productionLines.map((line) => (
              <ProductionLineCard
                key={line.id}
                name={line.name}
                lineNumber={line.line_number}
                status={line.status}
                throughput={line.current_speed}
                targetThroughput={line.target_throughput}
              />
            ))
          ) : (
            <div className="empty-state">
              <Factory size={36} />
              <p>No production lines configured yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* AI Row — Insights + Analysis */}
      <div className={styles.aiRow}>
        <div className={`card ${styles.aiCard}`}>
          <AIInsightsPanel stats={stats} alerts={alerts} incidents={incidents} />
        </div>
        <div className={`card ${styles.aiCard}`}>
          <AIAnalysisPanel stats={stats} alerts={alerts} incidents={incidents} />
        </div>
      </div>

      {/* Bottom Section — Incidents + Live Alerts */}
      <div className={styles.mainGrid}>
        {/* Left — Incidents Table */}
        <div className={styles.leftCol}>
          <div className={`card ${styles.incidentCard}`}>
            <div className="card-header">
              <span className="card-title">Recent Incidents</span>
              <Link href="/incidents" className={styles.viewAllLink}>
                View All
                <ExternalLink size={12} />
              </Link>
            </div>
            <DataTable
              columns={incidentColumns}
              data={incidents}
              emptyMessage="No incidents recorded. Incident reports from cameras, zones, and sensors will appear here."
              pageSize={5}
              onRowClick={(row) => setSelectedIncident(row)}
            />
          </div>
        </div>

        {/* Right — Live Alerts */}
        <div className={styles.rightCol}>
          <div className={`card ${styles.scrollableCard}`}>
            <div className="card-header">
              <span className="card-title">Live Alerts</span>
            </div>
            <AlertFeed alerts={alerts} />
          </div>
        </div>
      </div>

      {/* Incident Detail Modal */}
      {selectedIncident && (
        <div className={styles.modalOverlay} onClick={() => setSelectedIncident(null)}>
          <div className={styles.modalPanel} onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className={styles.modalHeader}>
              <div className={styles.modalHeaderLeft}>
                <span className={`badge badge-${selectedIncident.severity === 'critical' ? 'error' : selectedIncident.severity === 'high' ? 'warning' : selectedIncident.severity === 'medium' ? 'info' : 'neutral'} ${styles.modalSeverityBadge}`}>
                  {selectedIncident.severity}
                </span>
                <h3 className={styles.modalTitle}>{selectedIncident.title || selectedIncident.description}</h3>
              </div>
              <button className={styles.modalClose} onClick={() => setSelectedIncident(null)}>
                <X size={18} />
              </button>
            </div>

            {/* Status Bar */}
            <div className={styles.modalStatusBar}>
              <span className={`badge ${selectedIncident.status === 'open' ? 'badge-error' : selectedIncident.status === 'investigating' ? 'badge-warning' : 'badge-success'}`}>
                {selectedIncident.status}
              </span>
              <span className={styles.modalIncidentType}>
                {(selectedIncident.incident_type || '').replace(/_/g, ' ')}
              </span>
            </div>

            {/* Info Grid */}
            <div className={styles.modalInfoGrid}>
              <div className={styles.modalInfoItem}>
                <Clock size={14} className={styles.modalInfoIcon} />
                <div className={styles.modalInfoContent}>
                  <span className={styles.modalInfoLabel}>Date & Time</span>
                  <span className={styles.modalInfoValue}>
                    {selectedIncident.created_at
                      ? new Date(selectedIncident.created_at).toLocaleString('en-US', {
                          month: 'short', day: 'numeric', year: 'numeric',
                          hour: '2-digit', minute: '2-digit', second: '2-digit',
                        })
                      : '—'}
                  </span>
                </div>
              </div>
              <div className={styles.modalInfoItem}>
                <User size={14} className={styles.modalInfoIcon} />
                <div className={styles.modalInfoContent}>
                  <span className={styles.modalInfoLabel}>Person Involved</span>
                  <span className={styles.modalInfoValue}>
                    {selectedIncident.metadata?.person || 'Unknown'}
                  </span>
                </div>
              </div>
              <div className={styles.modalInfoItem}>
                <MapPin size={14} className={styles.modalInfoIcon} />
                <div className={styles.modalInfoContent}>
                  <span className={styles.modalInfoLabel}>Zone / Location</span>
                  <span className={styles.modalInfoValue}>
                    {selectedIncident.metadata?.zoneName || 'Unknown Zone'}
                  </span>
                </div>
              </div>
              <div className={styles.modalInfoItem}>
                <Timer size={14} className={styles.modalInfoIcon} />
                <div className={styles.modalInfoContent}>
                  <span className={styles.modalInfoLabel}>Duration</span>
                  <span className={styles.modalInfoValue}>
                    {selectedIncident.metadata?.duration || 'N/A'}
                  </span>
                </div>
              </div>
              <div className={styles.modalInfoItem}>
                <Camera size={14} className={styles.modalInfoIcon} />
                <div className={styles.modalInfoContent}>
                  <span className={styles.modalInfoLabel}>Camera</span>
                  <span className={styles.modalInfoValue}>
                    {selectedIncident.metadata?.camera || 'Unknown'}
                  </span>
                </div>
              </div>
              <div className={styles.modalInfoItem}>
                <Eye size={14} className={styles.modalInfoIcon} />
                <div className={styles.modalInfoContent}>
                  <span className={styles.modalInfoLabel}>Incident ID</span>
                  <span className={styles.modalInfoValue}>
                    #{selectedIncident.id || '—'}
                  </span>
                </div>
              </div>
            </div>

            {/* Description */}
            {selectedIncident.description && (
              <div className={styles.modalSection}>
                <div className={styles.modalSectionTitle}>Description</div>
                <p className={styles.modalDescription}>{selectedIncident.description}</p>
              </div>
            )}

            {/* Actions */}
            <div className={styles.modalActions}>
              <Link href="/incidents" className={styles.modalViewAllBtn}>
                <ExternalLink size={14} />
                View All Incidents
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
