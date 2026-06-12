'use client';

import { useState, useEffect } from 'react';
import {
  FileText,
  ShieldCheck,
  ClipboardList,
  BarChart3,
  TrendingUp,
  AlertTriangle,
  Download,
} from 'lucide-react';
import styles from './page.module.css';

const REPORT_TYPES = [
  {
    id: 'osha',
    title: 'OSHA Compliance',
    description: 'Generate a comprehensive OSHA compliance report covering safety violations, PPE adherence, zone breach incidents, and corrective actions taken.',
    icon: ShieldCheck,
  },
  {
    id: 'usda',
    title: 'USDA Audit',
    description: 'Prepare USDA audit documentation including sanitation monitoring, temperature logs, production line hygiene scores, and inspection readiness.',
    icon: ClipboardList,
  },
  {
    id: 'safety-summary',
    title: 'Safety Summary',
    description: 'Weekly or monthly safety performance summary with incident counts, near-misses, safety zone compliance rates, and employee training status.',
    icon: AlertTriangle,
  },
  {
    id: 'production',
    title: 'Production Analysis',
    description: 'Production line throughput analysis, downtime tracking, efficiency metrics, and conveyor belt performance over the selected time period.',
    icon: TrendingUp,
  },
  {
    id: 'incident-analysis',
    title: 'Incident Analysis',
    description: 'Detailed incident trend analysis with root cause breakdowns, repeat offender identification, and severity distribution over time.',
    icon: BarChart3,
  },
];

export default function ReportsPage() {
  const [hasData, setHasData] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkData() {
      try {
        const res = await fetch('/api/dashboard?facilityId=1');
        if (res.ok) {
          const data = await res.json();
          // Check if there is any monitoring data collected
          const totalData =
            (data.incidents?.length || 0) +
            (data.cameras?.length || 0) +
            (data.productionLines?.length || 0);
          setHasData(totalData > 0);
        }
      } catch (error) {
        console.error('Failed to check data availability:', error);
      } finally {
        setLoading(false);
      }
    }
    checkData();
  }, []);

  if (loading) {
    return (
      <div className={styles.page}>
        <div className={styles.pageHeader}>
          <div>
            <h1 className={styles.pageTitle}>Reports</h1>
            <p className={styles.pageSubtitle}>Compliance reports and operational analytics</p>
          </div>
        </div>
        <div className={styles.loadingContainer}>
          <span className="loading-spinner" />
          <p>Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      {/* Page Header */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Reports</h1>
          <p className={styles.pageSubtitle}>Compliance reports and operational analytics</p>
        </div>
        <div className={styles.headerActions}>
          <button className="btn btn-secondary" disabled>
            <Download size={16} />
            Export PDF
          </button>
          <button className="btn btn-secondary" disabled>
            <Download size={16} />
            Export CSV
          </button>
        </div>
      </div>

      {!hasData && (
        <div className={`alert alert-info`} style={{ marginBottom: 'var(--space-5)' }}>
          Report generation will be available once monitoring data is collected.
        </div>
      )}

      {/* Report Type Cards */}
      <div className={styles.reportGrid}>
        {REPORT_TYPES.map((report) => {
          const Icon = report.icon;
          return (
            <div key={report.id} className={`card ${styles.reportCard}`}>
              <div className={styles.reportIcon}>
                <Icon size={22} />
              </div>
              <h4 className={styles.reportTitle}>{report.title}</h4>
              <p className={styles.reportDescription}>{report.description}</p>
              <div className={styles.reportAction}>
                <button className="btn btn-secondary" disabled>
                  <FileText size={14} />
                  Generate Report
                  <span className={styles.comingSoonTag}>Coming Soon</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Export Section */}
      <div className={`card ${styles.exportSection}`}>
        <div className={styles.exportTitle}>Export Options</div>
        <div className={styles.exportButtons}>
          <button className="btn btn-secondary" disabled>
            <Download size={14} />
            Download All Reports (PDF)
          </button>
          <button className="btn btn-secondary" disabled>
            <Download size={14} />
            Download Raw Data (CSV)
          </button>
        </div>
      </div>
    </div>
  );
}
