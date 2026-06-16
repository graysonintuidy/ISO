'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BrainCircuit,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Target,
  FileText,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import styles from './AIAnalysisPanel.module.css';

/* ---------- Demo / Fallback Data ---------- */
const DEMO_TREND_DATA = [
  { day: 'Mon', incidents: 3 },
  { day: 'Tue', incidents: 5 },
  { day: 'Wed', incidents: 2 },
  { day: 'Thu', incidents: 7 },
  { day: 'Fri', incidents: 4 },
  { day: 'Sat', incidents: 1 },
  { day: 'Sun', incidents: 3 },
];

const DEMO_ANALYSIS = {
  riskScore: 34,
  riskLevel: 'Medium',
  riskChange: '-8% from last week',
  totalIncidents: 25,
  trendDirection: 'down',
  trendLabel: '↓ 12% vs. prior week',
  narrative: 'Facility safety performance has improved modestly this week, with a 12% reduction in total incidents compared to the prior period. However, the Grinder Area and Forklift zones continue to account for 68% of all breaches. The concentration of violations during shift transitions (6:00–6:30 AM and 2:00–2:30 PM) suggests a structural scheduling issue rather than individual non-compliance.',
  patterns: [
    'Shift-change windows account for 63% of all zone breaches — staggered transitions could reduce by ~40%.',
    'Camera SZ-CAM-03 has flagged 3x more events than baseline — possible calibration drift or environmental change.',
    'Weekend breach rates are 70% lower than weekdays, correlating with reduced headcount rather than improved compliance.',
    'Conveyor Belt Zone violations cluster near Bay 3 loading dock — a physical barrier pilot is recommended.',
  ],
  trendData: DEMO_TREND_DATA,
};

/* ---------- Parse AI Analysis Response ---------- */
function parseAnalysisFromAI(responseText) {
  try {
    // Try JSON parse
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        riskScore: parsed.riskScore ?? parsed.risk_score ?? 50,
        riskLevel: parsed.riskLevel ?? parsed.risk_level ?? 'Medium',
        riskChange: parsed.riskChange ?? parsed.risk_change ?? '',
        totalIncidents: parsed.totalIncidents ?? parsed.total_incidents ?? 0,
        trendDirection: parsed.trendDirection ?? parsed.trend_direction ?? 'flat',
        trendLabel: parsed.trendLabel ?? parsed.trend_label ?? '',
        narrative: parsed.narrative ?? parsed.summary ?? '',
        patterns: parsed.patterns ?? parsed.key_patterns ?? [],
        trendData: parsed.trendData ?? parsed.trend_data ?? DEMO_TREND_DATA,
      };
    }
  } catch {
    // Fall through
  }

  // Fallback: try to extract structured info from text
  const lines = responseText.split('\n').filter(l => l.trim());
  const patterns = [];
  let narrative = '';
  let foundPatterns = false;

  for (const line of lines) {
    const cleaned = line.replace(/^[-•*\d.)\]]+\s*/, '').trim();
    if (cleaned.toLowerCase().includes('pattern') || cleaned.toLowerCase().includes('key finding')) {
      foundPatterns = true;
      continue;
    }
    if (foundPatterns && cleaned.length > 15) {
      patterns.push(cleaned);
    } else if (!foundPatterns && cleaned.length > 30) {
      narrative += (narrative ? ' ' : '') + cleaned;
    }
  }

  return {
    ...DEMO_ANALYSIS,
    narrative: narrative || DEMO_ANALYSIS.narrative,
    patterns: patterns.length > 0 ? patterns.slice(0, 4) : DEMO_ANALYSIS.patterns,
  };
}

/* ---------- Risk Ring Component ---------- */
function RiskRing({ score, level }) {
  const circumference = 2 * Math.PI * 22; // r=22
  const fillPercent = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (fillPercent / 100) * circumference;

  const riskColorClass =
    level === 'Low' ? styles.riskLow :
    level === 'High' ? styles.riskHigh :
    level === 'Critical' ? styles.riskCritical :
    styles.riskMedium;

  const riskLevelClass =
    level === 'Low' ? styles.riskLevelLow :
    level === 'High' ? styles.riskLevelHigh :
    level === 'Critical' ? styles.riskLevelCritical :
    styles.riskLevelMedium;

  return (
    <div className={styles.riskCard}>
      <div className={styles.riskRing}>
        <svg className={styles.riskRingSvg} viewBox="0 0 48 48">
          <circle className={styles.riskRingBg} cx="24" cy="24" r="22" />
          <circle
            className={`${styles.riskRingFill} ${riskColorClass}`}
            cx="24"
            cy="24"
            r="22"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
          />
        </svg>
        <div className={styles.riskScoreLabel}>
          <span className={styles.riskScoreValue}>{score}</span>
          <span className={styles.riskScoreUnit}>risk</span>
        </div>
      </div>
      <div className={styles.riskInfo}>
        <span className={styles.riskLabel}>Risk Level</span>
        <span className={`${styles.riskLevel} ${riskLevelClass}`}>{level}</span>
        <span className={styles.riskChange}>↓ vs. last week</span>
      </div>
    </div>
  );
}

/* ---------- Trend Chart Tooltip ---------- */
function CustomTooltip({ active, payload, label }) {
  if (active && payload?.[0]) {
    return (
      <div style={{
        background: 'var(--color-surface-elevated)',
        border: '1px solid var(--color-border)',
        borderRadius: '8px',
        padding: '6px 10px',
        fontSize: '0.75rem',
        boxShadow: 'var(--shadow-md)',
      }}>
        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)' }}>{label}</div>
        <div style={{ color: 'var(--color-text-secondary)' }}>
          {payload[0].value} incidents
        </div>
      </div>
    );
  }
  return null;
}

/* ---------- Loading Skeleton ---------- */
function AnalysisSkeleton() {
  return (
    <div className={styles.skeletonContent}>
      <div className={styles.skeletonRow}>
        <div className={styles.skeletonCard} />
        <div className={styles.skeletonCard} />
      </div>
      <div className={styles.skeletonNarrative}>
        <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonLineFull}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonLineFull}`} />
        <div className={`${styles.skeletonLine} ${styles.skeletonLineMedium}`} />
      </div>
      <div className={styles.skeletonPatterns}>
        <div className={`${styles.skeletonLine} ${styles.skeletonLineShort}`} />
        {[0, 1, 2].map(i => (
          <div key={i} className={styles.skeletonPattern} />
        ))}
      </div>
    </div>
  );
}

/* ============================================================
   AI Analysis Panel
   ============================================================ */
export default function AIAnalysisPanel({ stats, alerts, incidents }) {
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(true);
  const [usedDemo, setUsedDemo] = useState(false);

  const fetchAnalysis = useCallback(async () => {
    setLoading(true);

    try {
      const contextSummary = [
        `Safety Score: ${stats?.safetyScore ?? 'N/A'}`,
        `Cameras: ${stats?.cameras?.online || 0}/${stats?.cameras?.total || 0} online`,
        `Active Alerts: ${stats?.alerts?.active || 0} (${stats?.alerts?.critical || 0} critical)`,
        `Production Lines: ${stats?.productionLines?.running || 0}/${stats?.productionLines?.total || 0} running`,
        `Employees on Shift: ${stats?.employees?.onShift || 0}`,
        alerts?.length ? `Recent alerts (${alerts.length}): ${alerts.slice(0, 8).map(a => `[${a.severity}] ${a.title}`).join('; ')}` : 'No recent alerts',
        incidents?.length ? `Recent incidents (${incidents.length}): ${incidents.slice(0, 8).map(i => `[${i.severity}] ${i.title || i.description}`).join('; ')}` : 'No recent incidents',
      ].filter(Boolean).join('\n');

      const prompt = `Analyze the current facility safety and operational data. Return a JSON object with:
- "riskScore": number 0-100 (higher = more risk)
- "riskLevel": "Low" | "Medium" | "High" | "Critical"
- "riskChange": brief trend vs. previous period (e.g. "-8% from last week")
- "totalIncidents": estimated total incident count from context
- "trendDirection": "up" | "down" | "flat"
- "trendLabel": brief trend summary (e.g. "↓ 12% vs. prior week")
- "narrative": 2-3 sentence analytical summary of facility safety status, key risks, and overall trends
- "patterns": array of 3-4 specific pattern observations (each a concise sentence)
- "trendData": array of 7 objects with "day" (Mon-Sun) and "incidents" (number) for weekly trend

Current Facility Data:
${contextSummary}

Return ONLY a JSON object, no other text.`;

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, history: [] }),
      });

      if (!res.ok) throw new Error('API error');

      const data = await res.json();
      const parsed = parseAnalysisFromAI(data.response || '');

      if (parsed.narrative) {
        setAnalysis(parsed);
        setUsedDemo(false);
      } else {
        throw new Error('No analysis parsed');
      }
    } catch {
      setAnalysis(DEMO_ANALYSIS);
      setUsedDemo(true);
    } finally {
      setLoading(false);
    }
  }, [stats, alerts, incidents]);

  useEffect(() => {
    fetchAnalysis();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const TrendIcon = analysis?.trendDirection === 'up' ? TrendingUp :
                    analysis?.trendDirection === 'down' ? TrendingDown : Minus;

  const trendClass = analysis?.trendDirection === 'up' ? styles.trendUp :
                     analysis?.trendDirection === 'down' ? styles.trendDown : styles.trendFlat;

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerLeft}>
          <div className={styles.aiIconWrapper}>
            <BrainCircuit size={14} />
          </div>
          <span className={styles.headerTitle}>AI Analysis</span>
        </div>
        <div className={styles.headerActions}>
          <span className={styles.poweredBadge}>
            <Zap size={7} />
            {usedDemo ? 'Demo' : 'AI'}
          </span>
          <button
            className={styles.refreshBtn}
            onClick={fetchAnalysis}
            disabled={loading}
            title="Regenerate analysis"
          >
            <RefreshCw size={12} className={loading ? styles.spinning : ''} />
          </button>
        </div>
      </div>

      {/* Content */}
      {loading && !analysis ? (
        <AnalysisSkeleton />
      ) : analysis ? (
        <div className={styles.content}>
          {/* Risk Score + Trend Chart */}
          <div className={styles.statsRow}>
            <RiskRing score={analysis.riskScore} level={analysis.riskLevel} />

            <div className={styles.trendCard}>
              <span className={styles.trendLabel}>Incident Trend</span>
              <div className={styles.trendChart}>
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={analysis.trendData} margin={{ top: 2, right: 2, bottom: 0, left: -20 }}>
                    <defs>
                      <linearGradient id="trendGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--brand-primary)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="var(--brand-primary)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="day"
                      tick={{ fontSize: 9, fill: 'var(--color-text-muted)' }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis hide />
                    <Tooltip content={<CustomTooltip />} />
                    <Area
                      type="monotone"
                      dataKey="incidents"
                      stroke="var(--brand-primary)"
                      strokeWidth={2}
                      fill="url(#trendGradient)"
                      dot={false}
                      activeDot={{ r: 3, strokeWidth: 2, fill: 'var(--color-surface)' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className={styles.trendSummary}>
                <span className={styles.trendValue}>{analysis.totalIncidents}</span>
                <span className={`${styles.trendChange} ${trendClass}`}>
                  <TrendIcon size={11} />
                  {analysis.trendLabel}
                </span>
              </div>
            </div>
          </div>

          {/* AI Narrative */}
          <div className={styles.narrativeSection}>
            <span className={styles.sectionLabel}>
              <FileText size={10} className={styles.sectionLabelIcon} />
              Analysis Summary
            </span>
            <p className={styles.narrative}>{analysis.narrative}</p>
          </div>

          {/* Key Patterns */}
          {analysis.patterns?.length > 0 && (
            <div className={styles.patternsSection}>
              <span className={styles.sectionLabel}>
                <Target size={10} className={styles.sectionLabelIcon} />
                Key Patterns Detected
              </span>
              <div className={styles.patternsList}>
                {analysis.patterns.map((pattern, i) => (
                  <div key={i} className={styles.patternItem}>
                    <Zap size={12} className={styles.patternIcon} />
                    <span className={styles.patternText}>{pattern}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className={styles.emptyState}>
          <BrainCircuit size={28} className={styles.emptyIcon} />
          <span className={styles.emptyTitle}>Analysis Unavailable</span>
          <p className={styles.emptyDesc}>
            AI analysis will generate once facility data is available.
          </p>
          <button className={styles.retryBtn} onClick={fetchAnalysis}>
            <RefreshCw size={10} />
            Generate
          </button>
        </div>
      )}
    </div>
  );
}
