#!/usr/bin/env node

const API_KEY = 'vntg_7aEF3glus_kuqwsdEY9ir910UhmNFbpUqaABhN7m4hA';
const MCP_URL = 'https://mcp.intuidy.com/mcp';
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

async function init() {
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-fix', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });
  console.log('MCP initialized.');
}

async function callTool(name, args) {
  const res = await mcpPost({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } });
  const c = res?.result?.content?.[0]?.text;
  if (c) { try { return JSON.parse(c); } catch { return c; } }
  if (res?.error) return { error: res.error.message };
  return res;
}

function parseWorkflowId(result) {
  if (typeof result === 'string') { const m = result.match(/(\d+)/); if (m) return parseInt(m[1]); }
  if (typeof result === 'object') return result?.id || result?.workflowId;
  return null;
}

async function executeDDL(sqlStatement, label) {
  process.stdout.write(`  ${label}... `);
  try {
    const wf = await callTool('create_workflow', { title: `Fix-${Date.now()}` });
    const wfId = parseWorkflowId(wf);
    if (!wfId) { console.log('❌ No workflow ID'); return false; }
    
    await callTool('update_workflow', {
      workflowId: wfId,
      nodes: [
        { node_type: 'dbconnectors/dbWrite', node_role: 'setter', label: 'DDL', config: { query: sqlStatement, operation: 'raw', inputs: [{ key: 'i1', label: 'I' }], outputs: [{ key: 'o1', label: 'O' }], credentialRef: { strategy: 'default', credentialId: '47' } } },
        { node_type: 'outputs/workflowOutput', node_role: 'terminator', label: 'R', config: { inputs: [{ key: 'i1', label: 'I' }], outputs: [{ key: 'o1', label: 'O' }], outputName: 'result' } }
      ],
      edges: [{ source_node_index: 0, target_node_index: 1, source_key: 'o1', target_key: 'i1' }]
    });
    
    const execResult = await callTool('execute_workflow', { workflowId: wfId });
    await callTool('delete_workflow', { workflowId: wfId });
    
    const execStr = typeof execResult === 'string' ? execResult : JSON.stringify(execResult);
    if (execStr.toLowerCase().includes('error') && !execStr.toLowerCase().includes('already exists')) {
      console.log(`❌ ${execStr.slice(0, 200)}`);
      return false;
    }
    console.log('✅');
    return true;
  } catch (e) { console.log(`❌ ${e.message}`); return false; }
}

async function main() {
  await init();
  
  // Fix iot_devices - backtick `last_value` since it's a MySQL reserved word
  console.log('=== Fixing iot_devices table (backtick reserved word `last_value`) ===');
  const ok = await executeDDL(
    "CREATE TABLE IF NOT EXISTS iot_devices (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, device_name VARCHAR(255), device_type ENUM('temperature','motion','proximity','gas','humidity','barcode_scanner','rfid_reader','belt_speed','weight_scale','other') DEFAULT 'other', location_description VARCHAR(500), production_line_id INT, status ENUM('online','offline','maintenance','error') DEFAULT 'online', `last_value` JSON, last_heartbeat TIMESTAMP NULL, alert_threshold JSON, config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))",
    '14. CREATE iot_devices (fixed)'
  );
  
  // Verify
  console.log('\n=== Verification ===');
  const verify = await callTool('execute_managed_db_query', { databaseId: 3, query: "DESCRIBE iot_devices" });
  console.log('iot_devices schema:', JSON.stringify(verify, null, 2));
  
  // Final table count
  const tables = await callTool('execute_managed_db_query', { databaseId: 3, query: "SHOW TABLES" });
  const key = Object.keys(tables?.rows?.[0] || {})[0];
  const nbTableNames = ['organizations','facilities','cameras','production_lines','production_logs','zones',
    'employees','iot_devices','incidents','alerts','forklifts','time_entries','chat_history',
    'audit_log','ai_events','branding_config','user_sessions','nb_roles','nb_users'];
  const nbTables = (tables?.rows || []).filter(r => nbTableNames.includes(r[key]));
  console.log(`\n✅ National Beef tables: ${nbTables.length}/19`);
  nbTables.forEach(t => console.log(`  ✅ ${t[key]}`));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
