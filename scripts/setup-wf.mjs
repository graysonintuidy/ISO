const API_KEY = 'vntg_I8B07QTVVff24CXHEvE_UGg1GBIkkbWFxu-nojD3JuU';
const MCP_URL = 'https://mcp.intuidy.com/mcp';
const DB_ID = 10;
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
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-wf', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });

  // Get the workflow to see its structure
  console.log('=== Getting workflow 599 ===');
  const wf = await callTool('get_workflow', { workflowId: WF_ID });
  console.log(JSON.stringify(wf, null, 2));

  // Update it with a DB Write node for DDL
  console.log('\n=== Updating workflow with DB Write node ===');
  const updateResult = await callTool('update_workflow', {
    workflowId: WF_ID,
    is_active: true,
    nodes: [
      {
        id: 'input_1',
        type: 'input',
        position: { x: 250, y: 50 },
        data: { label: 'Input', config: {} }
      },
      {
        id: 'db_write_1',
        type: 'db_write',
        position: { x: 250, y: 250 },
        data: {
          label: 'Schema DDL',
          config: {
            credentialId: 59,
            databaseId: DB_ID,
            query: "{{input.sql}}"
          }
        }
      },
      {
        id: 'output_1',
        type: 'output',
        position: { x: 250, y: 450 },
        data: { label: 'Output', config: {} }
      }
    ],
    edges: [
      { id: 'e_input_db', source: 'input_1', target: 'db_write_1' },
      { id: 'e_db_output', source: 'db_write_1', target: 'output_1' }
    ]
  });
  console.log('Update result:', JSON.stringify(updateResult, null, 2));

  // Try execute
  console.log('\n=== Executing workflow ===');
  const execResult = await callTool('execute_workflow', { 
    workflowId: WF_ID,
    output_node_id: 'output_1'
  });
  console.log('Execute result:', JSON.stringify(execResult, null, 2));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
