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
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-ddl', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });

  // First, list workflows to find one with db nodes to learn the structure
  console.log('=== Listing workflows ===');
  const wfs = await callTool('list_workflows', { limit: 50 });
  if (Array.isArray(wfs)) {
    for (const w of wfs.slice(0, 15)) {
      console.log(`  ID: ${w.id} | "${w.title}" | nodes: ${w.workflow_nodes?.length || '?'}`);
    }
  } else {
    console.log(JSON.stringify(wfs)?.slice(0, 1000));
  }

  // Get the update_workflow tool schema 
  console.log('\n=== Getting update_workflow tool schema ===');
  const res = await mcpPost({ jsonrpc: '2.0', id: 99, method: 'tools/list', params: {} });
  const tools = res?.result?.tools || [];
  const updateTool = tools.find(t => t.name === 'update_workflow');
  if (updateTool) {
    console.log(JSON.stringify(updateTool.inputSchema, null, 2));
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
