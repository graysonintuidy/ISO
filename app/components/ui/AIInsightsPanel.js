'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  Sparkles,
  RefreshCw,
  AlertTriangle,
  Shield,
  TrendingUp,
  Lightbulb,
  Zap,
} from 'lucide-react';
import styles from './AIInsightsPanel.module.css';

/* ---------- Demo / Fallback Insights ---------- */
const DEMO_INSIGHTS = [
  {
    id: 1,
    category: 'critical',
    text: 'Grinder Area (Zone A) has had 3 breaches today — repeat unauthorized entries suggest a badge-reader or signage issue at the north entrance.',
    confidence: 94,
    timestamp: new Date(Date.now() - 120000),
  },
  {
    id: 2,
    category: 'warning',
    text: 'Forklift zone breach frequency is trending 40% above baseline. Consider adding a physical barrier or proximity alert sensor.',
    confidence: 87,
    timestamp: new Date(Date.now() - 300000),
  },
  {
    id: 3,
    category: 'positive',
    text: 'Emergency Exit Corridor has maintained 0 breaches for the past 72 hours — compliance training for Dock Crew appears effective.',
    confidence: 91,
    timestamp: new Date(Date.now() - 600000),
  },
  {
    id: 4,
    category: 'info',
    text: 'Camera SZ-CAM-04 (High Voltage Panel) detection confidence dropped to 72% — recommend lens cleaning or repositioning during next maintenance window.',
    confidence: 78,
    timestamp: new Date(Date.now() - 900000),
  },
  {
    id: 5,
    category: 'warning',
    text: 'Production Line 2 throughput is 15% below target. Correlated with increased pedestrian traffic in Conveyor Belt Zone during shift change.',
    confidence: 82,
    timestamp: new Date(Date.now() - 1200000),
  },
  {
    id: 6,
    category: 'info',
    text: 'Shift change pattern detected: 85% of zone breaches occur within ±15 minutes of shift transitions. Consider staggered shift schedules.',
    confidence: 89,
    timestamp: new Date(Date.now() - 1500000),
  },
];

const CATEGORY_CONFIG = {
  critical: { label: 'Critical', dotClass: styles.dotCritical, labelClass: styles.categoryCritical, icon: AlertTriangle },
  warning: { label: 'Warning', dotClass: styles.dotWarning, labelClass: styles.categoryWarning, icon: Shield },
  positive: { label: 'Positive', dotClass: styles.dotPositive, labelClass: styles.categoryPositive, icon: TrendingUp },
  info: { label: 'Recommendation', dotClass: styles.dotInfo, labelClass: styles.categoryInfo, icon: Lightbulb },
};

function formatInsightTime(date) {
  const now = new Date();
  const diffMs = now - date;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'Just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return date.toLocaleDateString();
}

/* ---------- Parse AI response into insights ---------- */
function parseInsightsFromAI(responseText) {
  try {
    // Try to parse JSON directly first
    const jsonMatch = responseText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.map((item, i) => ({
        id: Date.now() + i,
        category: item.category || 'info',
        text: item.text || item.insight || item.message || '',
        confidence: item.confidence || 80,
        timestamp: new Date(),
      })).filter(item => item.text);
    }
  } catch {
    // Fall through to line parsing
  }

  // Fallback: parse line by line
  const lines = responseText.split('\n').filter(l => l.trim());
  const insights = [];
  for (const line of lines) {
    const cleaned = line.replace(/^[-•*\d.)\]]+\s*/, '').trim();
    if (cleaned.length < 15) continue;

    let category = 'info';
    const lower = cleaned.toLowerCase();
    if (lower.includes('critical') || lower.includes('urgent') || lower.includes('immediate') || lower.includes('danger')) {
      category = 'critical';
    } else if (lower.includes('warning') || lower.includes('concern') || lower.includes('risk') || lower.includes('above') || lower.includes('breach')) {
      category = 'warning';
    } else if (lower.includes('positive') || lower.includes('improved') || lower.includes('excellent') || lower.includes('complian') || lower.includes('good')) {
      category = 'positive';
    }

    insights.push({
      id: Date.now() + insights.length,
      category,
      text: cleaned,
      confidence: 75 + Math.floor(Math.random() * 20),
      timestamp: new Date(),
    });
  }

  return insights.slice(0, 8);
}

/* ============================================================
   InsightItem Component
   ============================================================ */
function InsightItem({ insight, index }) {
  const config = CATEGORY_CONFIG[insight.category] || CATEGORY_CONFIG.info;

  return (
    <div className={styles.insightItem} style={{ animationDelay: `${index * 0.06}s` }}>
      <div className={`${styles.severityDot} ${config.dotClass}`} />
      <div className={styles.insightContent}>
        <p className={styles.insightText}>{insight.text}</p>
        <div className={styles.insightMeta}>
          <span className={`${styles.insightCategory} ${config.labelClass}`}>
            {config.label}
          </span>
          <span className={styles.insightTime}>
            {formatInsightTime(insight.timestamp)}
          </span>
          <span className={styles.confidenceBadge}>
            <Zap size={7} />
            {insight.confidence}%
          </span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   Loading Skeleton
   ============================================================ */
function InsightsSkeleton() {
  return (
    <div className={styles.skeletonList}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className={styles.skeletonItem} style={{ animationDelay: `${i * 0.1}s` }}>
          <div className={styles.skeletonDot} />
          <div className={styles.skeletonLines}>
            <div className={`${styles.skeletonLine} ${styles.skeletonLineMedium}`} />
            <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ============================================================
   AI Insights Panel
   ============================================================ */
export default function AIInsightsPanel({ stats, alerts, incidents }) {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [usedDemo, setUsedDemo] = useState(false);
  const intervalRef = useRef(null);

  const fetchInsights = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      // Build a context-aware prompt from current dashboard data
      const contextSummary = [
        `Cameras: ${stats?.cameras?.online || 0}/${stats?.cameras?.total || 0} online`,
        `Active Alerts: ${stats?.alerts?.active || 0} (${stats?.alerts?.critical || 0} critical)`,
        `Safety Score: ${stats?.safetyScore ?? 'N/A'}`,
        `Production Lines: ${stats?.productionLines?.running || 0}/${stats?.productionLines?.total || 0} running`,
        `Employees on Shift: ${stats?.employees?.onShift || 0}`,
        alerts?.length ? `Recent alerts: ${alerts.slice(0, 5).map(a => `${a.severity}: ${a.title}`).join('; ')}` : '',
        incidents?.length ? `Recent incidents: ${incidents.slice(0, 5).map(i => `${i.severity}: ${i.title || i.description}`).join('; ')}` : '',
      ].filter(Boolean).join('\n');

      const prompt = `Based on the current facility monitoring data, provide exactly 6 brief safety insights as a JSON array. Each insight should be an object with: "category" (one of: "critical", "warning", "positive", "info"), "text" (a concise 1-2 sentence insight), and "confidence" (number 70-99).

Current Facility Data:
${contextSummary}

Focus on:
- Immediate safety concerns or breach patterns
- Positive compliance trends worth noting
- Camera or sensor health issues
- Production-safety correlations
- Actionable recommendations

Return ONLY a JSON array, no other text.`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, history: [] }),
      });

      if (!res.ok) throw new Error('API error');

      const data = await res.json();
      const parsed = parseInsightsFromAI(data.response || '');

      if (parsed.length > 0) {
        setInsights(parsed);
        setUsedDemo(false);
      } else {
        throw new Error('No insights parsed');
      }
    } catch {
      // Use demo data as fallback
      if (insights.length === 0) {
        setInsights(DEMO_INSIGHTS);
        setUsedDemo(true);
      }
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [stats, alerts, incidents, insights.length]);

  useEffect(() => {
    fetchInsights();
    // Auto-refresh every 60 seconds
    intervalRef.current = setInterval(fetchInsights, 60000);
    return () => clearInterval(intervalRef.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.aiIconWrapper}>
            <Sparkles size={14} />
          </div>
          <span className={styles.headerTitle}>AI Insights</span>
          <span className={styles.aiBadge}>
            <Sparkles size={7} className={styles.sparkle} />
            {usedDemo ? 'Demo' : 'Live'}
          </span>
        </div>
        <button
          className={styles.refreshBtn}
          onClick={fetchInsights}
          disabled={loading}
          title="Refresh insights"
        >
          <RefreshCw size={12} className={loading ? styles.spinning : ''} />
        </button>
      </div>

      {/* Content */}
      {loading && insights.length === 0 ? (
        <InsightsSkeleton />
      ) : insights.length > 0 ? (
        <div className={styles.feed}>
          {insights.map((insight, i) => (
            <InsightItem key={insight.id} insight={insight} index={i} />
          ))}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <Sparkles size={28} className={styles.emptyIcon} />
          <span className={styles.emptyTitle}>No Insights Available</span>
          <p className={styles.emptyDesc}>
            AI insights will appear here once facility data is being monitored.
          </p>
          <button className={styles.retryBtn} onClick={fetchInsights}>
            <RefreshCw size={10} />
            Try Again
          </button>
        </div>
      )}
    </div>
  );
}
