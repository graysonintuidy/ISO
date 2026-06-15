const API_KEY = 'vntg_I8B07QTVVff24CXHEvE_UGg1GBIkkbWFxu-nojD3JuU';
const MCP_URL = 'https://mcp.intuidy.com/mcp';
const DB_ID = 10;
const CRED_ID = 58;
const WF_ID = 599;
let sessionId = null;

async function mcpPost(p) {
  const h = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Authorization': `Bearer ${API_KEY}` };
  if (sessionId) h['Mcp-Session-Id'] = sessionId;
  const r = await fetch(MCP_URL, { method: 'POST', headers: h, body: JSON.stringify(p) });
  const s = r.headers.get('mcp-session-id'); if (s) sessionId = s;
  const t = await r.text();
  try { return JSON.parse(t); } catch { for (const l of t.split('\n')) { if (l.startsWith('data: ')) { try { return JSON.parse(l.slice(6)); } catch {} } } return { raw: t.slice(0,2000) }; }
}

async function callTool(name, args) {
  const r = await mcpPost({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } });
  const c = r?.result?.content?.[0]?.text;
  if (c) { try { return JSON.parse(c); } catch { return c; } }
  if (r?.error) return { error: r.error };
  return r;
}

async function main() {
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-ddl3', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });

  // Build proper workflow: input -> db_write -> output
  console.log('=== Building proper workflow with input + db + output ===\n');
  
  const ddl = "CREATE TABLE IF NOT EXISTS organizations (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(50) UNIQUE NOT NULL)";
  
  const upd = await callTool('update_workflow', {
    workflowId: WF_ID,
    is_active: true,
    nodes: [
      { node_type: 'input', node_role: 'getter', label: 'Input', config: {} },
      { node_type: 'managed_db_query', node_role: 'setter', label: 'Create Table', config: { managedDatabaseId: DB_ID, query: ddl } },
      { node_type: 'output', node_role: 'terminator', label: 'Output', config: {} }
    ],
    edges: [
      { source_node_index: 0, target_node_index: 1 },
      { source_node_index: 1, target_node_index: 2 }
    ]
  });
  console.log('Update result:', typeof upd === 'string' ? upd : JSON.stringify(upd, null, 2));

  // Now get the workflow to see node IDs
  const wf = await callTool('get_workflow', { workflowId: WF_ID });
  console.log('\nWorkflow after update:');
  console.log(JSON.stringify(wf, null, 2));

  // Try to execute
  console.log('\n=== Executing ===');
  // output_node_id should be a number (node index or id)
  const outputNodeId = wf?.workflow_nodes?.[2]?.id || 2;
  const exec = await callTool('execute_workflow', { workflowId: WF_ID, output_node_id: outputNodeId });
  console.log('Execute result:', typeof exec === 'string' ? exec : JSON.stringify(exec, null, 2));

  // Verify
  console.log('\n=== Verify ===');
  const tables = await callTool('execute_managed_db_query', { databaseId: DB_ID, query: 'SHOW TABLES' });
  console.log('Tables:', JSON.stringify(tables));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
