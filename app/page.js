'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  AlertTriangle,
  Users,
  Factory,
  ShieldCheck,
  Wifi,
} from 'lucide-react';
import StatTile from '@/app/components/ui/StatTile';
import CameraFeedGrid from '@/app/components/ui/CameraFeedGrid';
import ProductionLineCard from '@/app/components/ui/ProductionLineCard';
import AlertFeed from '@/app/components/ui/AlertFeed';
import DataTable from '@/app/components/ui/DataTable';
import { VIOLATION_LOG } from '@/lib/demoSafetyZones';
import styles from './page.module.css';

const REFRESH_INTERVAL = 30000; // 30 seconds

/* ============================================================
   MOCK DASHBOARD DATA
   ============================================================ */
const MOCK_STATS = {
  cameras: { online: 14, total: 16 },
  alerts: { active: 5, critical: 2 },
  employees: { onShift: 47, total: 62 },
  productionLines: { running: 3, total: 4 },
  devices: { online: 28, total: 32 },
  safetyScore: 82,
};

const MOCK_ALERTS = [
  {
    id: 'a1',
    title: 'Zone Breach — Grinder Area',
    message: 'Unauthorized worker entered restricted grinder zone without lockout clearance.',
    severity: 'critical',
    source: 'SZ-CAM-01',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
  },
  {
    id: 'a2',
    title: 'High Voltage Panel Access',
    message: 'Maintenance worker accessed electrical panel without clearance.',
    severity: 'critical',
    source: 'SZ-CAM-04',
    timestamp: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: 'a3',
    title: 'Conveyor Belt Boundary Breach',
    message: 'Personnel crossed conveyor safety boundary during operation.',
    severity: 'warning',
    source: 'SZ-CAM-02',
    timestamp: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: 'a4',
    title: 'Grinder A-2 Temperature High',
    message: 'Temperature sensor reading 58°F — exceeds threshold of 55°F.',
    severity: 'warning',
    source: 'IoT Sensor — Grinder A-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 120).toISOString(),
  },
  {
    id: 'a5',
    title: 'Forklift Zone — Pedestrian Detected',
    message: 'Pedestrian entered active forklift operating zone in Aisle 4.',
    severity: 'warning',
    source: 'SZ-CAM-03',
    timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
  },
  {
    id: 'a6',
    title: 'Camera CAM-07 Offline',
    message: 'Camera feed lost — last heartbeat 4 minutes ago.',
    severity: 'info',
    source: 'System',
    timestamp: new Date(Date.now() - 1000 * 60 * 240).toISOString(),
  },
  {
    id: 'a7',
    title: 'Shift Change Complete',
    message: 'Day shift handoff to evening shift completed. 47 employees checked in.',
    severity: 'info',
    source: 'System',
    timestamp: new Date(Date.now() - 1000 * 60 * 300).toISOString(),
  },
];

const MOCK_PRODUCTION_LINES = [
  {
    id: 'pl-1',
    name: 'Ground Beef — Line 1',
    line_number: 1,
    status: 'running',
    current_speed: 1180,
    target_throughput: 1250,
    last_event: new Date(Date.now() - 1000 * 60 * 15).toISOString(),
  },
  {
    id: 'pl-2',
    name: 'Patties — Line 2',
    line_number: 2,
    status: 'running',
    current_speed: 890,
    target_throughput: 1000,
    last_event: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
  },
  {
    id: 'pl-3',
    name: 'Trim Processing — Line 3',
    line_number: 3,
    status: 'running',
    current_speed: 460,
    target_throughput: 500,
    last_event: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
  },
  {
    id: 'pl-4',
    name: 'Packaging — Line 4',
    line_number: 4,
    status: 'maintenance',
    current_speed: 0,
    target_throughput: 800,
    last_event: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
  },
];

const MOCK_INCIDENTS = VIOLATION_LOG.slice(0, 6).map((v) => ({
  id: v.id,
  severity: v.severity === 'critical' ? 'critical' : 'high',
  title: v.description,
  incident_type: v.type.replace(/_/g, ' '),
  status: v.status === 'unresolved' ? 'open' : v.status === 'acknowledged' ? 'investigating' : 'resolved',
  location: v.zoneName,
  created_at: v.timestamp,
}));

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);

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

  // Use API data only if it contains real values, otherwise fall back to mock data
  const apiHasData = dashboardData?.stats?.cameras?.total > 0;
  const stats = apiHasData ? dashboardData.stats : MOCK_STATS;
  const alerts = dashboardData?.alerts?.length ? dashboardData.alerts : MOCK_ALERTS;
  const incidents = dashboardData?.incidents?.length ? dashboardData.incidents : MOCK_INCIDENTS;
  const productionLines = dashboardData?.productionLines?.length ? dashboardData.productionLines : MOCK_PRODUCTION_LINES;
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

      {/* Top Row — Camera Feeds + Production Lines side by side */}
      <div className={styles.topRow}>
        <div className={`card ${styles.compactCard}`}>
          <div className="card-header">
            <span className="card-title">Camera Feeds</span>
            <span className={styles.countBadge}>16 cameras</span>
          </div>
          <CameraFeedGrid cameras={cameras} />
        </div>

        <div className={`card ${styles.compactCard}`}>
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
      </div>

      {/* Bottom Section — Incidents + Live Alerts */}
      <div className={styles.mainGrid}>
        {/* Left — Incidents Table */}
        <div className={styles.leftCol}>
          <div className={`card ${styles.incidentCard}`}>
            <div className="card-header">
              <span className="card-title">Recent Incidents</span>
            </div>
            <DataTable
              columns={incidentColumns}
              data={incidents}
              emptyMessage="No incidents recorded. Incident reports from cameras, zones, and sensors will appear here."
              pageSize={5}
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
    </div>
  );
}
