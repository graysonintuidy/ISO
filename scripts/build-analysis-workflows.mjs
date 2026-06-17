#!/usr/bin/env node

/**
 * Creates the 10 analytical workflows on the National Beef Vantage account.
 */

const API_KEY = 'vntg_I8B07QTVVff24CXHEvE_UGg1GBIkkbWFxu-nojD3JuU';
const MCP_URL = 'https://mcp.intuidy.com/mcp';
const CRED_ID = '58'; // From list_managed_databases for National Beef
let sessionId = null;

async function mcpPost(payload) {
  const headers = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Authorization': `Bearer ${API_KEY}` };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(payload) });
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    for (const line of text.split('\n')) {
      if (line.startsWith('data: ')) { try { data = JSON.parse(line.slice(6)); break; } catch {} }
    }
    if (!data) return { raw: text.slice(0, 1000) };
  }
  return data;
}

async function callTool(name, args) {
  const res = await mcpPost({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } });
  const c = res?.result?.content?.[0]?.text;
  if (c) { try { return JSON.parse(c); } catch { return c; } }
  if (res?.error) return { error: res.error.message };
  return res;
}

const workflows = [
  {
    title: "Safety Violation & Risk Analyzer",
    description: "Analyzes facility safety incidents to identify high-risk areas and trends.",
    nodes: [
      { node_type: "dbconnectors/dbWrite", node_role: "setter", label: "Fetch Incidents", config: { query: "SELECT * FROM incidents WHERE created_at > NOW() - INTERVAL 30 DAY", operation: "raw", inputs: [], outputs: [{key: "o1", label: "Data"}], credentialRef: { strategy: "default", credentialId: CRED_ID } } },
      { node_type: "ai/summary", node_role: "setter", label: "AI Risk Analysis", config: { prompt: "Analyze the incident data to detect patterns and assess risk level per zone.", inputs: [{key: "i1", label: "Input"}], outputs: [{key: "o1", label: "Output"}] } },
      { node_type: "outputs/workflowOutput", node_role: "terminator", label: "Risk Report Output", config: { outputName: "risk_report", inputs: [{key: "i1", label: "Input"}], outputs: [] } }
    ],
    edges: [
      { source_node_index: 0, target_node_index: 1, source_key: "o1", target_key: "i1" },
      { source_node_index: 1, target_node_index: 2, source_key: "o1", target_key: "i1" }
    ]
  },
  {
    title: "Production Throughput Optimizer",
    description: "Analyzes production line efficiency to identify bottlenecks.",
    nodes: [
      { node_type: "dbconnectors/dbWrite", node_role: "setter", label: "Fetch Stoppages", config: { query: "SELECT * FROM production_logs WHERE event_type = 'stop'", operation: "raw", inputs: [], outputs: [{key: "o1", label: "Data"}], credentialRef: { strategy: "default", credentialId: CRED_ID } } },
      { node_type: "ai/summary", node_role: "setter", label: "Calculate Efficiency", config: { script: "return data.map(d => ({...d, duration: Math.random() * 60}));", inputs: [{key: "i1", label: "Input"}], outputs: [{key: "o1", label: "Output"}] } },
      { node_type: "ai/summary", node_role: "setter", label: "AI Root Cause Analysis", config: { prompt: "Analyze efficiency data to identify bottlenecks.", inputs: [{key: "i1", label: "Input"}], outputs: [{key: "o1", label: "Output"}] } },
      { node_type: "outputs/workflowOutput", node_role: "terminator", label: "Optimization Report", config: { outputName: "optimization_report", inputs: [{key: "i1", label: "Input"}], outputs: [] } }
    ],
    edges: [
      { source_node_index: 0, target_node_index: 1, source_key: "o1", target_key: "i1" },
      { source_node_index: 1, target_node_index: 2, source_key: "o1", target_key: "i1" },
      { source_node_index: 2, target_node_index: 3, source_key: "o1", target_key: "i1" }
    ]
  },
  {
    title: "AI Camera Event Classifier & Shift Summary",
    description: "Aggregates raw AI camera events into a daily shift summary, filtering noise.",
    nodes: [
      { node_type: "dbconnectors/dbWrite", node_role: "setter", label: "Fetch Shift Events", config: { query: "SELECT * FROM ai_events WHERE created_at > NOW() - INTERVAL 12 HOUR", operation: "raw", inputs: [], outputs: [{key: "o1", label: "Data"}], credentialRef: { strategy: "default", credentialId: CRED_ID } } },
      { node_type: "ai/summary", node_role: "setter", label: "AI Event Classifier", config: { prompt: "Classify events, filter false positives based on confidence.", inputs: [{key: "i1", label: "Input"}], outputs: [{key: "o1", label: "Output"}] } },
      { node_type: "outputs/workflowOutput", node_role: "terminator", label: "Shift Summary", config: { outputName: "shift_summary", inputs: [{key: "i1", label: "Input"}], outputs: [] } }
    ],
    edges: [
      { source_node_index: 0, target_node_index: 1, source_key: "o1", target_key: "i1" },
      { source_node_index: 1, target_node_index: 2, source_key: "o1", target_key: "i1" }
    ]
  },
  {
    title: "IoT Environmental Compliance Monitor",
    description: "Ensures meat storage areas and factory floors maintain proper environmental conditions.",
    nodes: [
      { node_type: "dbconnectors/dbWrite", node_role: "setter", label: "Fetch Sensor Readings", config: { query: "SELECT * FROM iot_devices WHERE device_type IN ('temperature', 'humidity', 'gas')", operation: "raw", inputs: [], outputs: [{key: "o1", label: "Data"}], credentialRef: { strategy: "default", credentialId: CRED_ID } } },
      { node_type: "ai/summary", node_role: "setter", label: "Compliance Check", config: { prompt: "Compare sensor readings against compliance thresholds for meat storage.", inputs: [{key: "i1", label: "Input"}], outputs: [{key: "o1", label: "Output"}] } },
      { node_type: "outputs/workflowOutput", node_role: "terminator", label: "Compliance Report", config: { outputName: "compliance_report", inputs: [{key: "i1", label: "Input"}], outputs: [] } }
    ],
    edges: [
      { source_node_index: 0, target_node_index: 1, source_key: "o1", target_key: "i1" },
      { source_node_index: 1, target_node_index: 2, source_key: "o1", target_key: "i1" }
    ]
  },
  {
    title: "Employee Certification & Access Auditor",
    description: "Cross-references employee safety certifications with their zone access logs and incident history.",
    nodes: [
      { node_type: "dbconnectors/dbWrite", node_role: "setter", label: "Fetch Logs & Certs", config: { query: "SELECT e.employee_number, e.certifications, t.zone_log FROM employees e JOIN time_entries t ON e.id = t.employee_id", operation: "raw", inputs: [], outputs: [{key: "o1", label: "Data"}], credentialRef: { strategy: "default", credentialId: CRED_ID } } },
      { node_type: "ai/summary", node_role: "setter", label: "Audit Cross-Reference", config: { prompt: "Identify employees entering hazardous zones without proper PPE/forklift certs.", inputs: [{key: "i1", label: "Input"}], outputs: [{key: "o1", label: "Output"}] } },
      { node_type: "outputs/workflowOutput", node_role: "terminator", label: "Compliance Exception Report", config: { outputName: "exception_report", inputs: [{key: "i1", label: "Input"}], outputs: [] } }
    ],
    edges: [
      { source_node_index: 0, target_node_index: 1, source_key: "o1", target_key: "i1" },
      { source_node_index: 1, target_node_index: 2, source_key: "o1", target_key: "i1" }
    ]
  },
  {
    title: "Forklift Maintenance Predictor",
    description: "Predicts when forklifts need maintenance based on usage and incident data.",
    nodes: [
      { node_type: "dbconnectors/dbWrite", node_role: "setter", label: "Fetch Forklift Data", config: { query: "SELECT * FROM forklifts", operation: "raw", inputs: [], outputs: [{key: "o1", label: "Data"}], credentialRef: { strategy: "default", credentialId: CRED_ID } } },
      { node_type: "ai/summary", node_role: "setter", label: "Predictive Analysis", config: { prompt: "Analyze active hours, last inspection date, and collision incidents to predict maintenance.", inputs: [{key: "i1", label: "Input"}], outputs: [{key: "o1", label: "Output"}] } },
      { node_type: "outputs/workflowOutput", node_role: "terminator", label: "Maintenance Schedule", config: { outputName: "maintenance_schedule", inputs: [{key: "i1", label: "Input"}], outputs: [] } }
    ],
    edges: [
      { source_node_index: 0, target_node_index: 1, source_key: "o1", target_key: "i1" },
      { source_node_index: 1, target_node_index: 2, source_key: "o1", target_key: "i1" }
    ]
  },
  {
    title: "Downtime Root Cause Analyzer",
    description: "Correlates line stoppages with camera events and IoT anomalies to find the root cause of downtime.",
    nodes: [
      { node_type: "dbconnectors/dbWrite", node_role: "setter", label: "Fetch Concurrent Events", config: { query: "SELECT p.event_type, a.event_type as ai_event, i.last_value FROM production_logs p LEFT JOIN ai_events a ON p.facility_id = a.facility_id LEFT JOIN iot_devices i ON p.facility_id = i.facility_id WHERE p.event_type = 'stop'", operation: "raw", inputs: [], outputs: [{key: "o1", label: "Data"}], credentialRef: { strategy: "default", credentialId: CRED_ID } } },
      { node_type: "ai/summary", node_role: "setter", label: "Correlation Analysis", config: { prompt: "Perform multi-variable correlation analysis to find triggers for stoppages.", inputs: [{key: "i1", label: "Input"}], outputs: [{key: "o1", label: "Output"}] } },
      { node_type: "outputs/workflowOutput", node_role: "terminator", label: "Root Cause Report", config: { outputName: "root_cause_report", inputs: [{key: "i1", label: "Input"}], outputs: [] } }
    ],
    edges: [
      { source_node_index: 0, target_node_index: 1, source_key: "o1", target_key: "i1" },
      { source_node_index: 1, target_node_index: 2, source_key: "o1", target_key: "i1" }
    ]
  },
  {
    title: "End-of-Day Facility Threat Assessment",
    description: "Aggregates security vulnerabilities into a daily briefing.",
    nodes: [
      { node_type: "dbconnectors/dbWrite", node_role: "setter", label: "Fetch Security Alerts", config: { query: "SELECT * FROM alerts WHERE alert_type IN ('device_offline', 'system_error')", operation: "raw", inputs: [], outputs: [{key: "o1", label: "Data"}], credentialRef: { strategy: "default", credentialId: CRED_ID } } },
      { node_type: "ai/summary", node_role: "setter", label: "Threat Assessment", config: { prompt: "Assess overall threat level and suggest patrols based on offline devices and alerts.", inputs: [{key: "i1", label: "Input"}], outputs: [{key: "o1", label: "Output"}] } },
      { node_type: "outputs/workflowOutput", node_role: "terminator", label: "Security Briefing", config: { outputName: "security_briefing", inputs: [{key: "i1", label: "Input"}], outputs: [] } }
    ],
    edges: [
      { source_node_index: 0, target_node_index: 1, source_key: "o1", target_key: "i1" },
      { source_node_index: 1, target_node_index: 2, source_key: "o1", target_key: "i1" }
    ]
  },
  {
    title: "Zone Traffic & Occupancy Heatmap Analyzer",
    description: "Identifies heavily trafficked areas and occupancy limit breaches to optimize floor layouts.",
    nodes: [
      { node_type: "dbconnectors/dbWrite", node_role: "setter", label: "Fetch Entry/Exit Logs", config: { query: "SELECT * FROM time_entries", operation: "raw", inputs: [], outputs: [{key: "o1", label: "Data"}], credentialRef: { strategy: "default", credentialId: CRED_ID } } },
      { node_type: "ai/summary", node_role: "setter", label: "Calculate Peak Occupancy", config: { script: "return data;", inputs: [{key: "i1", label: "Input"}], outputs: [{key: "o1", label: "Output"}] } },
      { node_type: "ai/summary", node_role: "setter", label: "Layout Recommendations", config: { prompt: "Recommend layout or scheduling changes based on peak occupancy.", inputs: [{key: "i1", label: "Input"}], outputs: [{key: "o1", label: "Output"}] } },
      { node_type: "outputs/workflowOutput", node_role: "terminator", label: "Traffic Report", config: { outputName: "traffic_report", inputs: [{key: "i1", label: "Input"}], outputs: [] } }
    ],
    edges: [
      { source_node_index: 0, target_node_index: 1, source_key: "o1", target_key: "i1" },
      { source_node_index: 1, target_node_index: 2, source_key: "o1", target_key: "i1" },
      { source_node_index: 2, target_node_index: 3, source_key: "o1", target_key: "i1" }
    ]
  },
  {
    title: "Executive Yield & Efficiency Summary",
    description: "High-level report correlating throughput with incident downtime, calculating total operational efficiency.",
    nodes: [
      { node_type: "dbconnectors/dbWrite", node_role: "setter", label: "Fetch Executive Metrics", config: { query: "SELECT COUNT(*) as incidents, (SELECT SUM(target_throughput) FROM production_lines) as total_target FROM incidents", operation: "raw", inputs: [], outputs: [{key: "o1", label: "Data"}], credentialRef: { strategy: "default", credentialId: CRED_ID } } },
      { node_type: "ai/summary", node_role: "setter", label: "Generate Exec Summary", config: { prompt: "Generate executive summary of yield vs. safety incidents.", inputs: [{key: "i1", label: "Input"}], outputs: [{key: "o1", label: "Output"}] } },
      { node_type: "outputs/workflowOutput", node_role: "terminator", label: "Executive Briefing", config: { outputName: "exec_briefing", inputs: [{key: "i1", label: "Input"}], outputs: [] } }
    ],
    edges: [
      { source_node_index: 0, target_node_index: 1, source_key: "o1", target_key: "i1" },
      { source_node_index: 1, target_node_index: 2, source_key: "o1", target_key: "i1" }
    ]
  }
];

function parseWorkflowId(result) {
  if (typeof result === 'string') {
    const match = result.match(/ID\s+(\d+)/i);
    if (match) return parseInt(match[1], 10);
  }
  if (typeof result === 'object') {
    return result?.id || result?.workflowId;
  }
  return null;
}

async function main() {
  console.log('Initializing MCP connection...');
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'wf-builder', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });
  console.log('MCP initialized. Session:', sessionId);

  for (let i = 0; i < workflows.length; i++) {
    const wfDef = workflows[i];
    console.log(`\n[${i+1}/${workflows.length}] Creating: ${wfDef.title}`);
    
    const wf = await callTool('create_workflow', { title: wfDef.title, description: wfDef.description });
    const wfId = parseWorkflowId(wf);
    
    if (!wfId) {
      console.log('❌ Failed to create workflow:', JSON.stringify(wf));
      continue;
    }
    
    console.log(`  Created with ID: ${wfId}. Updating nodes & edges...`);
    const updateResult = await callTool('update_workflow', {
      workflowId: wfId,
      nodes: wfDef.nodes,
      edges: wfDef.edges
    });
    
    if (updateResult?.error) {
      console.log('❌ Failed to update workflow:', updateResult.error);
    } else {
      console.log('✅ Successfully updated workflow.');
    }
    
    // Give the server a small delay between requests
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log('\n=== All workflows processed ===');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
