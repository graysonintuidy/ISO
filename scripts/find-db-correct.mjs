const API_KEY = 'vntg_I8B07QTVVff24CXHEvE_UGg1GBIkkbWFxu-nojD3JuU';
const MCP_URL = 'https://mcp.intuidy.com/mcp';
let sessionId = null;
async function mcpPost(p) {
  const h = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Authorization': `Bearer ${API_KEY}` };
  if (sessionId) h['Mcp-Session-Id'] = sessionId;
  const r = await fetch(MCP_URL, { method: 'POST', headers: h, body: JSON.stringify(p) });
  const s = r.headers.get('mcp-session-id'); if (s) sessionId = s;
  const t = await r.text();
  try { return JSON.parse(t); } catch { for (const l of t.split('\n')) { if (l.startsWith('data: ')) { try { return JSON.parse(l.slice(6)); } catch {} } } return { raw: t.slice(0,500) }; }
}
async function callTool(name, args) {
  const r = await mcpPost({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } });
  const c = r?.result?.content?.[0]?.text;
  if (c) { try { return JSON.parse(c); } catch { return c; } }
  return r;
}
async function main() {
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-find', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });
  console.log('Session:', sessionId);
  
  const dbs = await callTool('list_managed_databases', {});
  const list = Array.isArray(dbs) ? dbs : dbs?.databases || [];
  console.log(`\nFound ${list.length} databases:\n`);
  for (const db of list) {
    console.log(`  ID: ${db.id} | Name: "${db.name}" | Status: ${db.status} | DB: ${db.db_name}`);
  }
}
main().catch(e => console.error(e));
