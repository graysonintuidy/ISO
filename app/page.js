'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Camera,
  AlertTriangle,
  Users,
  Factory,
  ShieldCheck,
  Wifi,
  TrendingUp,
  TrendingDown,
  MessageSquare,
  X,
  Send,
  Bot,
} from 'lucide-react';
import StatTile from '@/app/components/ui/StatTile';
import CameraFeedGrid from '@/app/components/ui/CameraFeedGrid';
import ProductionLineCard from '@/app/components/ui/ProductionLineCard';
import AlertFeed from '@/app/components/ui/AlertFeed';
import DataTable from '@/app/components/ui/DataTable';
import styles from './page.module.css';

const REFRESH_INTERVAL = 30000; // 30 seconds

export default function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);

  const fetchDashboardData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard?facilityId=1');
      if (res.ok) {
        const data = await res.json();
        setDashboardData(data);
      }
    } catch (error) {
      console.error('Failed to fetch dashboard data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboardData();
    const interval = setInterval(fetchDashboardData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchDashboardData]);

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMessage = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, facilityId: 1 }),
      });

      if (res.ok) {
        const data = await res.json();
        setChatMessages(prev => [...prev, { role: 'assistant', content: data.response }]);
      } else {
        setChatMessages(prev => [...prev, {
          role: 'assistant',
          content: 'Sorry, I was unable to process your request. Please try again.',
        }]);
      }
    } catch {
      setChatMessages(prev => [...prev, {
        role: 'assistant',
        content: 'Connection error. Please check your network and try again.',
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  // Extract data or use empty defaults
  const stats = dashboardData?.stats || {
    cameras: { online: 0, total: 0 },
    alerts: { active: 0, critical: 0 },
    employees: { onShift: 0, total: 0 },
    productionLines: { running: 0, total: 0 },
    devices: { online: 0, total: 0 },
    safetyScore: 0,
  };
  const alerts = dashboardData?.alerts || [];
  const incidents = dashboardData?.incidents || [];
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

      {/* Main Content Grid */}
      <div className={styles.mainGrid}>
        {/* Left Column — Cameras + Production Lines */}
        <div className={styles.leftCol}>
          {/* Camera Feeds */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Camera Feeds</span>
              <span className={styles.countBadge}>16 cameras</span>
            </div>
            <CameraFeedGrid cameras={cameras} />
          </div>

          {/* Production Lines */}
          <div className="card">
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
                  <Factory size={40} />
                  <p>No production lines configured yet. Add lines in Settings to begin monitoring conveyor belt operations.</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column — AI Chat + Alerts */}
        <div className={styles.rightCol}>
          {/* AI Chat Panel */}
          <div className={`card ${styles.chatCard}`}>
            <div className="card-header">
              <span className="card-title">
                <Bot size={14} style={{ marginRight: '6px', verticalAlign: 'middle' }} />
                AI Assistant
              </span>
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => setChatOpen(!chatOpen)}
                aria-label={chatOpen ? 'Minimize chat' : 'Expand chat'}
              >
                {chatOpen ? <X size={16} /> : <MessageSquare size={16} />}
              </button>
            </div>

            {chatOpen && (
              <>
                <div className={styles.chatMessages}>
                  {chatMessages.length === 0 && (
                    <div className={styles.chatWelcome}>
                      <Bot size={32} />
                      <p>Ask me anything about your facility data.</p>
                      <div className={styles.chatSuggestions}>
                        <button
                          className={styles.chatSuggestion}
                          onClick={() => setChatInput('How many incidents this week?')}
                        >
                          How many incidents this week?
                        </button>
                        <button
                          className={styles.chatSuggestion}
                          onClick={() => setChatInput('Show production line status')}
                        >
                          Show production line status
                        </button>
                        <button
                          className={styles.chatSuggestion}
                          onClick={() => setChatInput('Who is on shift right now?')}
                        >
                          Who is on shift right now?
                        </button>
                      </div>
                    </div>
                  )}
                  {chatMessages.map((msg, i) => (
                    <div key={i} className={`${styles.chatMessage} ${styles[msg.role]}`}>
                      {msg.role === 'assistant' && <Bot size={16} className={styles.chatAvatar} />}
                      <div className={styles.chatBubble}>
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className={`${styles.chatMessage} ${styles.assistant}`}>
                      <Bot size={16} className={styles.chatAvatar} />
                      <div className={styles.chatBubble}>
                        <span className="loading-spinner" />
                      </div>
                    </div>
                  )}
                </div>
                <form className={styles.chatForm} onSubmit={handleChatSubmit}>
                  <input
                    type="text"
                    className={`input ${styles.chatInput}`}
                    placeholder="Ask about your facility data..."
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    disabled={chatLoading}
                  />
                  <button
                    type="submit"
                    className="btn btn-primary btn-icon"
                    disabled={!chatInput.trim() || chatLoading}
                  >
                    <Send size={16} />
                  </button>
                </form>
              </>
            )}
          </div>

          {/* Alert Feed */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Live Alerts</span>
            </div>
            <AlertFeed alerts={alerts} />
          </div>
        </div>
      </div>

      {/* Incident Log Table */}
      <div className={`card ${styles.incidentCard}`}>
        <div className="card-header">
          <span className="card-title">Recent Incidents</span>
        </div>
        <DataTable
          columns={incidentColumns}
          data={incidents}
          emptyMessage="No incidents recorded. Incident reports from cameras, zones, and sensors will appear here."
          pageSize={10}
        />
      </div>
    </div>
  );
}
