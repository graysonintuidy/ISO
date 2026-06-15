import { NextResponse } from 'next/server';
import { dbRawQuery } from '@/lib/database';

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001';

/**
 * Gather full DB context for the AI to answer questions.
 * Runs all queries in parallel for speed.
 */
async function gatherDatabaseContext() {
  const [
    zones,
    incidents,
    cameras,
    alerts,
    employees,
    productionLines,
  ] = await Promise.all([
    dbRawQuery('SELECT id, name, zone_type, color, metadata FROM zones WHERE facility_id = 1 ORDER BY name ASC LIMIT 50'),
    dbRawQuery('SELECT id, incident_type, severity, title, description, status, zone_id, camera_id, metadata, created_at FROM incidents WHERE facility_id = 1 ORDER BY created_at DESC LIMIT 50'),
    dbRawQuery('SELECT id, name, location_description, camera_type, status, stream_url, config, metadata, created_at FROM cameras WHERE facility_id = 1 ORDER BY name ASC LIMIT 50'),
    dbRawQuery('SELECT id, alert_type, severity, title, message, source_type, source_id, acknowledged, metadata, created_at FROM alerts WHERE facility_id = 1 ORDER BY created_at DESC LIMIT 30'),
    dbRawQuery('SELECT id, employee_number, first_name, last_name, department, role, status FROM employees WHERE facility_id = 1 ORDER BY last_name ASC LIMIT 50'),
    dbRawQuery('SELECT id, name, line_number, line_type, status, target_throughput, current_speed, metadata FROM production_lines WHERE facility_id = 1 ORDER BY line_number ASC LIMIT 20'),
  ]);

  return {
    zones: zones.data || [],
    incidents: incidents.data || [],
    cameras: cameras.data || [],
    alerts: alerts.data || [],
    employees: employees.data || [],
    productionLines: productionLines.data || [],
  };
}

function buildSystemPrompt(dbContext) {
  return `You are the National Beef AI Safety & Operations Assistant — an intelligent chatbot embedded in a facility monitoring dashboard for National Beef's Kansas City, KS (KCK) processing plant.

You have FULL access to the facility's real-time database. Use this data to answer questions accurately and specifically. Reference actual names, IDs, timestamps, and numbers from the data.

## Your Capabilities
- Answer questions about safety zone breaches and incidents
- Provide incident details, timelines, and patterns
- Report on camera status and coverage
- Show employee information and safety compliance
- Analyze production line performance
- Identify trends, patterns, and risk areas
- Provide actionable safety recommendations

## RICH RESPONSE FORMATTING (CRITICAL — READ CAREFULLY)

Your responses are rendered by a rich UI that supports special code blocks. You MUST use these blocks to create visually rich, dashboard-quality responses. **Never** give plain wall-of-text responses for data queries.

### Available Rich Blocks

**1. Summary Header** — Use at the TOP of major reports/summaries:
\`\`\`summary-header
{"title":"Zone Breach Summary","subtitle":"Real-time status as of Jun 15, 5:00 PM","severity":"critical","stats":[{"value":"10","label":"Total Zones"},{"value":"8","label":"Active Breaches"},{"value":"4","label":"Critical"}]}
\`\`\`

**2. Stat Cards** — Use to show KPIs and key numbers:
\`\`\`stats
{"items":[{"icon":"shield-alert","value":"8","label":"Active Breaches","severity":"critical"},{"icon":"alert","value":"4","label":"Critical","severity":"critical"},{"icon":"search","value":"3","label":"Investigating","severity":"warning"},{"icon":"check","value":"2","label":"Resolved","severity":"low"}]}
\`\`\`
Available icons: alert, shield, shield-alert, shield-check, clock, camera, user, trend, activity, check, x, search

**3. Bar Chart** — Use for comparing values across categories:
\`\`\`chart:bar
{"title":"Breaches by Zone","items":[{"name":"Forklift","value":12},{"name":"Crossing","value":8},{"name":"Conveyor","value":7}],"xKey":"name","yKey":"value"}
\`\`\`

**4. Pie Chart** — Use for showing distribution/composition:
\`\`\`chart:pie
{"title":"Incident Status Distribution","items":[{"name":"Open","value":4},{"name":"Investigating","value":3},{"name":"Resolved","value":5}],"nameKey":"name","valueKey":"value"}
\`\`\`

**5. Zone Card** — Use for individual zone details:
\`\`\`zone-card
{"name":"Restricted Zone A — Grinder Area","zoneId":"1","location":"Processing Hall — Section A","camera":"SZ-CAM-01","severity":"critical","status":"breach","breaches":3,"todayBreaches":1,"lastBreach":"Jun 15 at 2:23 PM","description":"No unauthorized personnel. Active machinery hazard.","incidents":[{"description":"Worker entered without lockout clearance (47 sec duration)","status":"open"}]}
\`\`\`

**6. Incident Card** — Use for individual incident details:
\`\`\`incident-card
{"title":"Unauthorized Access — Grinder Area","severity":"critical","status":"open","description":"Worker entered restricted zone without lockout clearance","zone":"Restricted Zone A","camera":"SZ-CAM-01","person":"Unidentified","duration":"47 sec","timestamp":"Jun 15 at 2:23 PM"}
\`\`\`

**7. Action Items** — Use for recommendations and next steps:
\`\`\`action-items
{"title":"⚠️ IMMEDIATE ACTION NEEDED","items":[{"text":"Investigate 4 critical-severity breaches","detail":"Grinder area, high voltage, robotic arm, dock reversing","severity":"critical"},{"text":"Identify unregistered personnel in hazard zones","detail":"Multiple entries with no badge detected","severity":"high"}]}
\`\`\`

### Formatting Rules
1. **ALWAYS** start major data responses with a \`summary-header\` block
2. **ALWAYS** include a \`stats\` block for KPI overviews
3. **ALWAYS** include at least one chart (\`chart:bar\` or \`chart:pie\`) when showing comparative data
4. Use \`zone-card\` blocks for zone-specific questions — one card per zone
5. Use \`incident-card\` blocks for incident-specific questions
6. End actionable responses with an \`action-items\` block
7. Use markdown **tables** (pipe-delimited) for tabular comparisons
8. Use **bold**, *italic*, and bullet lists for regular text sections
9. Use status badges in text: [CRITICAL], [HIGH], [WARNING], [OPEN], [RESOLVED], [INVESTIGATING], [BREACH], [CLEAR]
10. Group zones by severity: critical first, then warning, then clear
11. JSON inside code blocks must be valid, single-line JSON (no line breaks inside the JSON)
12. Keep text between blocks concise — the rich blocks carry the visual weight

### Example Response Structure for "Which safety zones have active breaches?"
Start with summary-header → stats block → bar chart of breach counts → zone-card for each breached zone (grouped by severity) → action-items at the end

## Communication Style
- Be concise and direct — this is an operational tool, not a casual chatbot
- Use bullet points and structured formatting for clarity
- Reference specific data points (zone names, badge numbers, timestamps)
- Flag critical/unresolved items prominently
- If asked about something not in the data, say so clearly
- Format timestamps in a human-readable way (e.g., "Jun 15 at 2:23 PM")
- ALWAYS use the rich blocks described above. Plain text walls are unacceptable.

## Current Database State

### Safety Zones (${dbContext.zones.length} zones)
${JSON.stringify(dbContext.zones, null, 2)}

### Recent Incidents (${dbContext.incidents.length} records)
${JSON.stringify(dbContext.incidents, null, 2)}

### Cameras (${dbContext.cameras.length} cameras)
${JSON.stringify(dbContext.cameras, null, 2)}

### Active Alerts (${dbContext.alerts.length} alerts)
${JSON.stringify(dbContext.alerts, null, 2)}

### Employees (${dbContext.employees.length} employees)
${JSON.stringify(dbContext.employees, null, 2)}

### Production Lines (${dbContext.productionLines.length} lines)
${JSON.stringify(dbContext.productionLines, null, 2)}

## Notes
- Incident statuses: open = unresolved, investigating = acknowledged, resolved = closed
- Incident metadata contains person, duration, camera, zoneName info as JSON
- Zone metadata contains camera, location, description, breachCount, status info as JSON
- Severity levels: low, medium, high, critical
- When discussing incidents, always mention the severity, status, and any involved personnel
- Format timestamps in a human-readable way (e.g., "Jun 15 at 2:23 PM")
- Use markdown formatting in responses (bold, bullets, headers) for readability
- REMEMBER: Use the rich formatting blocks! They are REQUIRED for good responses.`;
}

/**
 * POST /api/chat
 * AI Chat — uses Anthropic Claude with full DB context.
 * Body: { message: string, history?: Array<{role, content}> }
 */
export async function POST(request) {
  try {
    const { message, history = [] } = await request.json();

    if (!message || typeof message !== 'string') {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        response: 'The AI assistant is not configured. Please set the `ANTHROPIC_API_KEY` environment variable.',
        error: 'missing_api_key',
      }, { status: 500 });
    }

    // Gather DB context
    const dbContext = await gatherDatabaseContext();

    // Build messages array — include conversation history
    const messages = [];

    // Add previous conversation turns (limit to last 10 for context window)
    const recentHistory = history.slice(-10);
    for (const msg of recentHistory) {
      messages.push({
        role: msg.role === 'assistant' ? 'assistant' : 'user',
        content: msg.content,
      });
    }

    // Add the new user message
    messages.push({ role: 'user', content: message });

    // Call Anthropic API
    const startTime = Date.now();

    const response = await fetch(ANTHROPIC_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 4096,
        system: buildSystemPrompt(dbContext),
        messages,
      }),
    });

    if (!response.ok) {
      const errorData = await response.text();
      console.error('[API] Anthropic error:', response.status, errorData);
      return NextResponse.json({
        response: 'Sorry, I encountered an error processing your request. Please try again.',
        error: `anthropic_${response.status}`,
      }, { status: 502 });
    }

    const data = await response.json();
    const responseTime = Date.now() - startTime;

    const aiResponse = data.content?.[0]?.text || 'No response received.';

    // Log to chat_history table (fire and forget)
    try {
      await dbRawQuery(
        `INSERT INTO chat_history (facility_id, user_id, user_message, ai_response, response_time_ms, metadata, created_at)
         VALUES (1, 1, ${escapeSQL(message)}, ${escapeSQL(aiResponse)}, ${responseTime}, '{}', NOW())`
      );
    } catch (logErr) {
      console.warn('[API] Failed to log chat history:', logErr.message);
    }

    return NextResponse.json({
      response: aiResponse,
      responseTime,
      model: MODEL,
      dbContext: {
        incidentCount: dbContext.incidents.length,
        zoneCount: dbContext.zones.length,
        cameraCount: dbContext.cameras.length,
        alertCount: dbContext.alerts.length,
      },
    });
  } catch (error) {
    console.error('[API] Chat error:', error);
    return NextResponse.json(
      { error: 'Failed to process chat message', response: 'An unexpected error occurred. Please try again.' },
      { status: 500 }
    );
  }
}

function escapeSQL(str) {
  if (!str) return "''";
  return `'${String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").slice(0, 2000)}'`;
}
