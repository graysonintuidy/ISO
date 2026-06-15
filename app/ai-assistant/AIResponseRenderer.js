'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  CartesianGrid,
} from 'recharts';
import {
  AlertTriangle,
  Shield,
  ShieldAlert,
  ShieldCheck,
  Clock,
  MapPin,
  Camera,
  User,
  TrendingUp,
  Activity,
  CheckCircle,
  XCircle,
  Search,
  ChevronRight,
} from 'lucide-react';
import styles from './AIResponseRenderer.module.css';

/* ─── Color Palette ──────────────────────────────────── */
const SEVERITY_CONFIG = {
  critical: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)', border: 'rgba(239,68,68,0.2)', icon: '🔴', label: 'CRITICAL' },
  high: { color: '#f97316', bg: 'rgba(249,115,22,0.08)', border: 'rgba(249,115,22,0.2)', icon: '🟠', label: 'HIGH' },
  warning: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', icon: '🟡', label: 'WARNING' },
  medium: { color: '#f59e0b', bg: 'rgba(245,158,11,0.08)', border: 'rgba(245,158,11,0.2)', icon: '🟡', label: 'MEDIUM' },
  low: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', icon: '🟢', label: 'LOW' },
  clear: { color: '#10b981', bg: 'rgba(16,185,129,0.08)', border: 'rgba(16,185,129,0.2)', icon: '✅', label: 'CLEAR' },
};

const CHART_COLORS = ['#ef4444', '#f97316', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4'];

const STATUS_CONFIG = {
  open: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'OPEN' },
  investigating: { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)', label: 'INVESTIGATING' },
  resolved: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'RESOLVED' },
  breach: { color: '#ef4444', bg: 'rgba(239,68,68,0.1)', label: 'BREACH' },
  clear: { color: '#10b981', bg: 'rgba(16,185,129,0.1)', label: 'CLEAR' },
};

/* ─── Parse Special Blocks from AI Response ────────── */

/**
 * Parse the AI text response and extract:
 * - ```chart:bar ... ``` blocks (JSON for bar chart data)
 * - ```chart:pie ... ``` blocks (JSON for pie chart data)
 * - ```stats ... ``` blocks (JSON for stat cards)
 * - ```zone-card ... ``` blocks (JSON for zone detail cards)
 * - ```incident-card ... ``` blocks (JSON for incident cards)
 * - ```table ... ``` blocks (markdown table data)
 * - Regular markdown text
 */
function parseBlocks(text) {
  if (!text) return [{ type: 'text', content: '' }];

  const blocks = [];
  // Match special code blocks: ```type\n...\n```
  const blockRegex = /```(chart:bar|chart:pie|chart:timeline|stats|zone-card|incident-card|summary-header|action-items)\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = blockRegex.exec(text)) !== null) {
    // Add text before this block
    if (match.index > lastIndex) {
      const textBefore = text.slice(lastIndex, match.index).trim();
      if (textBefore) blocks.push({ type: 'text', content: textBefore });
    }

    const blockType = match[1];
    const blockContent = match[2].trim();

    try {
      const data = JSON.parse(blockContent);
      blocks.push({ type: blockType, data });
    } catch {
      // If JSON parse fails, treat as text
      blocks.push({ type: 'text', content: blockContent });
    }

    lastIndex = match.index + match[0].length;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    const remaining = text.slice(lastIndex).trim();
    if (remaining) blocks.push({ type: 'text', content: remaining });
  }

  return blocks.length > 0 ? blocks : [{ type: 'text', content: text }];
}

/* ─── Markdown Renderer (enhanced) ───────────────────── */
function renderEnhancedMarkdown(text) {
  if (!text) return '';

  let html = text
    // Code blocks (generic — non-special)
    .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // H4
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    // H3
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    // H2
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    // H1
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Horizontal rule
    .replace(/^---$/gm, '<hr/>')
    // Tables: detect | delimited rows
    .replace(
      /((?:^\|.+\|$\n?)+)/gm,
      (tableBlock) => {
        const rows = tableBlock.trim().split('\n').filter(r => r.trim());
        if (rows.length < 2) return tableBlock;

        // Check for separator row
        const sepIdx = rows.findIndex(r => /^\|[\s\-:|]+\|$/.test(r));
        const headerRow = sepIdx > 0 ? rows[0] : null;
        const dataRows = headerRow ? rows.filter((_, i) => i !== 0 && i !== sepIdx) : rows;

        const parseCells = (row) => row.split('|').filter((c, i, a) => i > 0 && i < a.length - 1).map(c => c.trim());

        let tableHtml = '<div class="' + styles.tableWrapper + '"><table class="' + styles.table + '">';

        if (headerRow) {
          const headers = parseCells(headerRow);
          tableHtml += '<thead><tr>' + headers.map(h => `<th>${h}</th>`).join('') + '</tr></thead>';
        }

        tableHtml += '<tbody>';
        for (const row of dataRows) {
          const cells = parseCells(row);
          tableHtml += '<tr>' + cells.map(c => {
            // Color code severity / status values
            const lower = c.toLowerCase();
            if (STATUS_CONFIG[lower]) {
              const cfg = STATUS_CONFIG[lower];
              return `<td><span style="color:${cfg.color};background:${cfg.bg};padding:2px 8px;border-radius:4px;font-weight:600;font-size:0.7rem;letter-spacing:0.03em">${cfg.label}</span></td>`;
            }
            if (SEVERITY_CONFIG[lower]) {
              const cfg = SEVERITY_CONFIG[lower];
              return `<td><span style="color:${cfg.color};background:${cfg.bg};padding:2px 8px;border-radius:4px;font-weight:600;font-size:0.7rem;letter-spacing:0.03em">${cfg.icon} ${cfg.label}</span></td>`;
            }
            return `<td>${c}</td>`;
          }).join('') + '</tr>';
        }
        tableHtml += '</tbody></table></div>';

        return tableHtml;
      }
    )
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // Numbered list items
    .replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>')
    // Severity badges: [CRITICAL], [HIGH], [WARNING], [OPEN], [RESOLVED], [INVESTIGATING], [BREACH], [CLEAR]
    .replace(
      /\[(CRITICAL|HIGH|WARNING|MEDIUM|LOW|CLEAR|OPEN|RESOLVED|INVESTIGATING|BREACH)\]/gi,
      (_, status) => {
        const lower = status.toLowerCase();
        const cfg = STATUS_CONFIG[lower] || SEVERITY_CONFIG[lower] || { color: '#71717a', bg: 'rgba(113,113,122,0.1)', label: status };
        return `<span class="${styles.inlineBadge}" style="color:${cfg.color};background:${cfg.bg}">${cfg.label || status.toUpperCase()}</span>`;
      }
    )
    // Paragraphs — double newlines
    .replace(/\n\n/g, '</p><p>')
    // Single newlines
    .replace(/\n/g, '<br/>');

  if (!html.startsWith('<')) {
    html = `<p>${html}</p>`;
  }

  return html;
}

/* ─── Chart Components ───────────────────────────────── */

function BarChartBlock({ data }) {
  const { title, items, xKey = 'name', yKey = 'value', color } = data;
  return (
    <div className={styles.chartBlock}>
      {title && <div className={styles.chartTitle}>{title}</div>}
      <div className={styles.chartContainer}>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={items} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(113,113,122,0.15)" />
            <XAxis
              dataKey={xKey}
              tick={{ fontSize: 11, fill: '#71717a' }}
              axisLine={{ stroke: 'rgba(113,113,122,0.2)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fontSize: 11, fill: '#71717a' }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 12,
                color: '#f4f4f5',
              }}
            />
            <Bar
              dataKey={yKey}
              radius={[4, 4, 0, 0]}
              fill={color || '#3b82f6'}
            >
              {items.map((_, idx) => (
                <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function PieChartBlock({ data }) {
  const { title, items, nameKey = 'name', valueKey = 'value' } = data;
  return (
    <div className={styles.chartBlock}>
      {title && <div className={styles.chartTitle}>{title}</div>}
      <div className={styles.chartContainer} style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <ResponsiveContainer width="50%" height={200}>
          <PieChart>
            <Pie
              data={items}
              dataKey={valueKey}
              nameKey={nameKey}
              cx="50%"
              cy="50%"
              outerRadius={80}
              innerRadius={40}
              strokeWidth={2}
              stroke="rgba(0,0,0,0.1)"
            >
              {items.map((_, idx) => (
                <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                background: '#18181b',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 8,
                fontSize: 12,
                color: '#f4f4f5',
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className={styles.pieChartLegend}>
          {items.map((item, idx) => (
            <div key={idx} className={styles.legendItem}>
              <span
                className={styles.legendDot}
                style={{ background: CHART_COLORS[idx % CHART_COLORS.length] }}
              />
              <span className={styles.legendLabel}>{item[nameKey]}</span>
              <span className={styles.legendValue}>{item[valueKey]}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Stat Cards ─────────────────────────────────────── */
function StatsBlock({ data }) {
  const { items } = data;
  const iconMap = {
    alert: AlertTriangle,
    shield: Shield,
    'shield-alert': ShieldAlert,
    'shield-check': ShieldCheck,
    clock: Clock,
    camera: Camera,
    user: User,
    trend: TrendingUp,
    activity: Activity,
    check: CheckCircle,
    x: XCircle,
    search: Search,
  };

  return (
    <div className={styles.statsGrid}>
      {items.map((stat, idx) => {
        const IconComp = iconMap[stat.icon] || Activity;
        const severity = stat.severity ? SEVERITY_CONFIG[stat.severity.toLowerCase()] : null;

        return (
          <div
            key={idx}
            className={styles.statCard}
            style={severity ? { borderColor: severity.border, background: severity.bg } : {}}
          >
            <div className={styles.statIcon} style={severity ? { color: severity.color } : {}}>
              <IconComp size={18} />
            </div>
            <div className={styles.statValue} style={severity ? { color: severity.color } : {}}>
              {stat.value}
            </div>
            <div className={styles.statLabel}>{stat.label}</div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Summary Header ─────────────────────────────────── */
function SummaryHeader({ data }) {
  const { title, subtitle, severity, stats } = data;
  const sev = severity ? SEVERITY_CONFIG[severity.toLowerCase()] : null;

  return (
    <div className={styles.summaryHeader} style={sev ? { borderLeftColor: sev.color } : {}}>
      <div className={styles.summaryHeaderTop}>
        <div>
          <div className={styles.summaryTitle}>{title}</div>
          {subtitle && <div className={styles.summarySubtitle}>{subtitle}</div>}
        </div>
        {sev && (
          <span
            className={styles.severityBadgeLg}
            style={{ color: sev.color, background: sev.bg, borderColor: sev.border }}
          >
            {sev.icon} {sev.label}
          </span>
        )}
      </div>
      {stats && stats.length > 0 && (
        <div className={styles.summaryStats}>
          {stats.map((s, i) => (
            <div key={i} className={styles.summaryStat}>
              <span className={styles.summaryStatValue}>{s.value}</span>
              <span className={styles.summaryStatLabel}>{s.label}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Zone Card ──────────────────────────────────────── */
function ZoneCard({ data }) {
  const { name, zoneId, location, camera, severity, status, breaches, todayBreaches, description, lastBreach, incidents } = data;
  const sev = severity ? SEVERITY_CONFIG[severity.toLowerCase()] : SEVERITY_CONFIG.low;
  const stat = status ? STATUS_CONFIG[status.toLowerCase()] : STATUS_CONFIG.clear;

  return (
    <div className={styles.zoneCard} style={{ borderLeftColor: sev.color }}>
      <div className={styles.zoneCardHeader}>
        <div className={styles.zoneCardTitle}>
          <span className={styles.zoneCardIcon} style={{ color: sev.color }}>{sev.icon}</span>
          {name}
          {zoneId && <span className={styles.zoneIdBadge}>Zone {zoneId}</span>}
        </div>
        <span
          className={styles.statusBadge}
          style={{ color: stat.color, background: stat.bg }}
        >
          {stat.label}
        </span>
      </div>

      <div className={styles.zoneCardMeta}>
        {location && (
          <span className={styles.zoneMeta}><MapPin size={12} /> {location}</span>
        )}
        {camera && (
          <span className={styles.zoneMeta}><Camera size={12} /> {camera}</span>
        )}
        {lastBreach && (
          <span className={styles.zoneMeta}><Clock size={12} /> Last: {lastBreach}</span>
        )}
      </div>

      {description && <div className={styles.zoneCardDesc}>{description}</div>}

      <div className={styles.zoneCardStats}>
        <div className={styles.zoneStatItem}>
          <span className={styles.zoneStatValue}>{breaches ?? 0}</span>
          <span className={styles.zoneStatLabel}>Total Breaches</span>
        </div>
        <div className={styles.zoneStatItem}>
          <span className={styles.zoneStatValue}>{todayBreaches ?? 0}</span>
          <span className={styles.zoneStatLabel}>Today</span>
        </div>
      </div>

      {incidents && incidents.length > 0 && (
        <div className={styles.incidentsList}>
          <div className={styles.incidentsTitle}>Related Incidents</div>
          {incidents.map((inc, idx) => {
            const incStatus = inc.status ? STATUS_CONFIG[inc.status.toLowerCase()] : null;
            return (
              <div key={idx} className={styles.incidentItem}>
                <ChevronRight size={12} className={styles.incidentArrow} />
                <div className={styles.incidentText}>{inc.description}</div>
                {incStatus && (
                  <span
                    className={styles.incidentStatusBadge}
                    style={{ color: incStatus.color, background: incStatus.bg }}
                  >
                    {incStatus.label}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ─── Incident Card ──────────────────────────────────── */
function IncidentCard({ data }) {
  const { title, severity, status, description, zone, camera, person, duration, timestamp } = data;
  const sev = severity ? SEVERITY_CONFIG[severity.toLowerCase()] : SEVERITY_CONFIG.medium;
  const stat = status ? STATUS_CONFIG[status.toLowerCase()] : null;

  return (
    <div className={styles.incidentCard} style={{ borderLeftColor: sev.color }}>
      <div className={styles.incidentCardHeader}>
        <span className={styles.incidentSeverity} style={{ color: sev.color, background: sev.bg }}>
          {sev.icon} {sev.label}
        </span>
        {stat && (
          <span className={styles.statusBadge} style={{ color: stat.color, background: stat.bg }}>
            {stat.label}
          </span>
        )}
      </div>
      {title && <div className={styles.incidentCardTitle}>{title}</div>}
      {description && <div className={styles.incidentCardDesc}>{description}</div>}
      <div className={styles.incidentCardMeta}>
        {zone && <span><MapPin size={11} /> {zone}</span>}
        {camera && <span><Camera size={11} /> {camera}</span>}
        {person && <span><User size={11} /> {person}</span>}
        {duration && <span><Clock size={11} /> {duration}</span>}
        {timestamp && <span><Clock size={11} /> {timestamp}</span>}
      </div>
    </div>
  );
}

/* ─── Action Items ───────────────────────────────────── */
function ActionItems({ data }) {
  const { title, items } = data;
  return (
    <div className={styles.actionItemsBlock}>
      {title && <div className={styles.actionItemsTitle}>{title}</div>}
      <div className={styles.actionItemsList}>
        {items.map((item, idx) => {
          const sev = item.severity ? SEVERITY_CONFIG[item.severity.toLowerCase()] : null;
          return (
            <div
              key={idx}
              className={styles.actionItem}
              style={sev ? { borderLeftColor: sev.color } : {}}
            >
              <AlertTriangle size={14} style={sev ? { color: sev.color } : {}} className={styles.actionIcon} />
              <div className={styles.actionContent}>
                <div className={styles.actionText}>{item.text}</div>
                {item.detail && <div className={styles.actionDetail}>{item.detail}</div>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Main Renderer ──────────────────────────────────── */
export default function AIResponseRenderer({ content }) {
  const blocks = useMemo(() => parseBlocks(content), [content]);

  return (
    <div className={styles.responseContainer}>
      {blocks.map((block, idx) => {
        switch (block.type) {
          case 'chart:bar':
            return <BarChartBlock key={idx} data={block.data} />;
          case 'chart:pie':
            return <PieChartBlock key={idx} data={block.data} />;
          case 'stats':
            return <StatsBlock key={idx} data={block.data} />;
          case 'summary-header':
            return <SummaryHeader key={idx} data={block.data} />;
          case 'zone-card':
            return <ZoneCard key={idx} data={block.data} />;
          case 'incident-card':
            return <IncidentCard key={idx} data={block.data} />;
          case 'action-items':
            return <ActionItems key={idx} data={block.data} />;
          case 'text':
          default:
            return (
              <div
                key={idx}
                className={styles.richText}
                dangerouslySetInnerHTML={{ __html: renderEnhancedMarkdown(block.content) }}
              />
            );
        }
      })}
    </div>
  );
}
