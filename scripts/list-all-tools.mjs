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
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'list-tools', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });
  const res = await mcpPost({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const tools = res?.result?.tools || [];
  console.log(`Found ${tools.length} tools:\n`);
  // Show all tools with full schema for DDL-related ones
  for (const t of tools) {
    const isSchema = t.name.toLowerCase().includes('schema') || t.name.toLowerCase().includes('creat') || t.name.toLowerCase().includes('table') || t.name.toLowerCase().includes('database') || t.name.toLowerCase().includes('managed');
    if (isSchema) {
      console.log(`📦 ${t.name}`);
      console.log(`   ${t.description}`);
      console.log(`   Schema: ${JSON.stringify(t.inputSchema, null, 2)}\n`);
    } else {
      console.log(`  ${t.name} — ${t.description}`);
    }
  }
  
  // Try create_managed_db_user to get direct MySQL access
  console.log('\n=== Trying create_managed_db_user for direct access ===');
  const user = await callTool('create_managed_db_user', { databaseId: 10 });
  console.log('Result:', JSON.stringify(user, null, 2));
}
main().catch(e => console.error(e));
