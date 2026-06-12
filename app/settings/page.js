'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Settings as SettingsIcon,
  Building2,
  Camera,
  Factory,
  Bell,
  Activity,
  Palette,
  ChevronRight,
  RefreshCw,
} from 'lucide-react';
import styles from './page.module.css';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [vantageStatus, setVantageStatus] = useState(null);
  const [facilityForm, setFacilityForm] = useState({
    name: 'National Beef Kansas City',
    code: 'KCK',
    address: '12200 N Ambassador Dr, Kansas City, KS 66109',
    timezone: 'America/Chicago',
  });
  const [alertForm, setAlertForm] = useState({
    zone_breach_threshold: '5',
    ppe_violation_threshold: '3',
    temperature_alert: '45',
    idle_camera_timeout: '300',
  });
  const [brandingForm, setBrandingForm] = useState({
    company_name: 'National Beef',
    logo_url: '',
    primary_color: '#002D72',
    accent_color: '#009DD9',
  });

  const checkSystemStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/vantage/workflows');
      setVantageStatus(res.ok ? 'connected' : 'error');
    } catch {
      setVantageStatus('unreachable');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    checkSystemStatus();
  }, [checkSystemStatus]);

  const handleFacilityChange = (field, value) => {
    setFacilityForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAlertChange = (field, value) => {
    setAlertForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleBrandingChange = (field, value) => {
    setBrandingForm((prev) => ({ ...prev, [field]: value }));
  };

  const getStatusDot = (status) => {
    switch (status) {
      case 'connected':
        return styles.statusDotGreen;
      case 'error':
        return styles.statusDotYellow;
      case 'unreachable':
        return styles.statusDotRed;
      default:
        return styles.statusDotGray;
    }
  };

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Settings</h1>
            <p className={styles.pageSubtitle}>Facility configuration and system preferences</p>
          </div>
        </div>
        <div className={styles.loadingContainer}>
          <span className="loading-spinner" />
          <p>Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Settings</h1>
          <p className={styles.pageSubtitle}>Facility configuration and system preferences</p>
        </div>
      </div>

      <div className={styles.sections}>
        {/* Facility Management */}
        <div className={`card ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              <Building2 size={20} className={styles.sectionIcon} />
              Facility Management
            </h3>
          </div>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className="label" htmlFor="facility-name">Facility Name</label>
              <input
                id="facility-name"
                className="input"
                type="text"
                value={facilityForm.name}
                onChange={(e) => handleFacilityChange('name', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className="label" htmlFor="facility-code">Facility Code</label>
              <input
                id="facility-code"
                className="input"
                type="text"
                value={facilityForm.code}
                onChange={(e) => handleFacilityChange('code', e.target.value)}
              />
            </div>
            <div className={`${styles.formGroup} ${styles.formGroupFull}`}>
              <label className="label" htmlFor="facility-address">Address</label>
              <input
                id="facility-address"
                className="input"
                type="text"
                value={facilityForm.address}
                onChange={(e) => handleFacilityChange('address', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className="label" htmlFor="facility-timezone">Timezone</label>
              <select
                id="facility-timezone"
                className="input select"
                value={facilityForm.timezone}
                onChange={(e) => handleFacilityChange('timezone', e.target.value)}
              >
                <option value="America/Chicago">Central (America/Chicago)</option>
                <option value="America/New_York">Eastern (America/New_York)</option>
                <option value="America/Denver">Mountain (America/Denver)</option>
                <option value="America/Los_Angeles">Pacific (America/Los_Angeles)</option>
              </select>
            </div>
          </div>
        </div>

        {/* Camera & Production Links */}
        <div className={`card ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              <Camera size={20} className={styles.sectionIcon} />
              Monitoring Configuration
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            <Link href="/cameras" className={styles.linkCard}>
              <div className={styles.linkCardInfo}>
                <span className={styles.linkCardTitle}>Camera Registration</span>
                <span className={styles.linkCardDescription}>Manage camera feeds, positions, and zones</span>
              </div>
              <ChevronRight size={18} />
            </Link>
            <Link href="/production-lines" className={styles.linkCard}>
              <div className={styles.linkCardInfo}>
                <span className={styles.linkCardTitle}>Production Lines</span>
                <span className={styles.linkCardDescription}>Configure conveyor belt monitoring and throughput targets</span>
              </div>
              <ChevronRight size={18} />
            </Link>
          </div>
        </div>

        {/* Alert Configuration */}
        <div className={`card ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              <Bell size={20} className={styles.sectionIcon} />
              Alert Configuration
            </h3>
          </div>
          <p className={styles.sectionDescription}>
            Configure notification thresholds for automated alerting.
          </p>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className="label" htmlFor="zone-breach">Zone Breach Threshold (per hour)</label>
              <input
                id="zone-breach"
                className="input"
                type="number"
                placeholder="5"
                value={alertForm.zone_breach_threshold}
                onChange={(e) => handleAlertChange('zone_breach_threshold', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className="label" htmlFor="ppe-violation">PPE Violation Threshold</label>
              <input
                id="ppe-violation"
                className="input"
                type="number"
                placeholder="3"
                value={alertForm.ppe_violation_threshold}
                onChange={(e) => handleAlertChange('ppe_violation_threshold', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className="label" htmlFor="temp-alert">Temperature Alert (°F)</label>
              <input
                id="temp-alert"
                className="input"
                type="number"
                placeholder="45"
                value={alertForm.temperature_alert}
                onChange={(e) => handleAlertChange('temperature_alert', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className="label" htmlFor="camera-timeout">Idle Camera Timeout (seconds)</label>
              <input
                id="camera-timeout"
                className="input"
                type="number"
                placeholder="300"
                value={alertForm.idle_camera_timeout}
                onChange={(e) => handleAlertChange('idle_camera_timeout', e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* System Status */}
        <div className={`card ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              <Activity size={20} className={styles.sectionIcon} />
              System Status
            </h3>
            <button className="btn btn-ghost btn-sm" onClick={checkSystemStatus}>
              <RefreshCw size={14} />
              Refresh
            </button>
          </div>
          <div className={styles.statusGrid}>
            <div className={styles.statusItem}>
              <span className={`${styles.statusDot} ${getStatusDot(vantageStatus)}`} />
              <div>
                <div className={styles.statusLabel}>Vantage API</div>
                <div className={styles.statusValue}>
                  {vantageStatus === 'connected' ? 'Connected' : vantageStatus === 'error' ? 'Error Response' : 'Unreachable'}
                </div>
              </div>
            </div>
            <div className={styles.statusItem}>
              <span className={`${styles.statusDot} ${styles.statusDotGray}`} />
              <div>
                <div className={styles.statusLabel}>Database</div>
                <div className={styles.statusValue}>Pending configuration</div>
              </div>
            </div>
            <div className={styles.statusItem}>
              <span className={`${styles.statusDot} ${styles.statusDotGray}`} />
              <div>
                <div className={styles.statusLabel}>AI Models</div>
                <div className={styles.statusValue}>Pending deployment</div>
              </div>
            </div>
            <div className={styles.statusItem}>
              <span className={`${styles.statusDot} ${styles.statusDotGray}`} />
              <div>
                <div className={styles.statusLabel}>Camera Streams</div>
                <div className={styles.statusValue}>No active streams</div>
              </div>
            </div>
          </div>
        </div>

        {/* Branding */}
        <div className={`card ${styles.section}`}>
          <div className={styles.sectionHeader}>
            <h3 className={styles.sectionTitle}>
              <Palette size={20} className={styles.sectionIcon} />
              Branding
            </h3>
          </div>
          <p className={styles.sectionDescription}>
            Customize the platform appearance for your organization.
          </p>
          <div className={styles.formGrid}>
            <div className={styles.formGroup}>
              <label className="label" htmlFor="brand-name">Company Name</label>
              <input
                id="brand-name"
                className="input"
                type="text"
                value={brandingForm.company_name}
                onChange={(e) => handleBrandingChange('company_name', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className="label" htmlFor="brand-logo">Logo URL</label>
              <input
                id="brand-logo"
                className="input"
                type="text"
                placeholder="https://example.com/logo.png"
                value={brandingForm.logo_url}
                onChange={(e) => handleBrandingChange('logo_url', e.target.value)}
              />
            </div>
            <div className={styles.formGroup}>
              <label className="label" htmlFor="brand-primary">Primary Color</label>
              <div className={styles.colorPickerGroup}>
                <input
                  type="color"
                  className={styles.colorSwatch}
                  value={brandingForm.primary_color}
                  onChange={(e) => handleBrandingChange('primary_color', e.target.value)}
                />
                <input
                  id="brand-primary"
                  className="input"
                  type="text"
                  value={brandingForm.primary_color}
                  onChange={(e) => handleBrandingChange('primary_color', e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
            <div className={styles.formGroup}>
              <label className="label" htmlFor="brand-accent">Accent Color</label>
              <div className={styles.colorPickerGroup}>
                <input
                  type="color"
                  className={styles.colorSwatch}
                  value={brandingForm.accent_color}
                  onChange={(e) => handleBrandingChange('accent_color', e.target.value)}
                />
                <input
                  id="brand-accent"
                  className="input"
                  type="text"
                  value={brandingForm.accent_color}
                  onChange={(e) => handleBrandingChange('accent_color', e.target.value)}
                  style={{ flex: 1 }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
