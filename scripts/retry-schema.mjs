const API_KEY = 'vntg_I8B07QTVVff24CXHEvE_UGg1GBIkkbWFxu-nojD3JuU';
const MCP_URL = 'https://mcp.intuidy.com/mcp';
const DB_ID = 10;
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
  if (r?.error) return `MCP Error: ${r.error.message}`;
  return r;
}

async function main() {
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-retry', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });

  // First check what tables exist
  console.log('=== Checking existing tables ===');
  let r = await callTool('execute_managed_db_query', { databaseId: DB_ID, query: 'SHOW TABLES' });
  console.log('SHOW TABLES result:', JSON.stringify(r));

  // Try a simple create + immediate verify
  console.log('\n=== Test: CREATE then immediately SHOW ===');
  r = await callTool('execute_managed_db_query', { databaseId: DB_ID, query: "CREATE TABLE IF NOT EXISTS test_table (id INT PRIMARY KEY, name VARCHAR(100))" });
  console.log('CREATE result:', JSON.stringify(r));
  
  await new Promise(r => setTimeout(r, 2000));
  
  r = await callTool('execute_managed_db_query', { databaseId: DB_ID, query: 'SHOW TABLES' });
  console.log('SHOW TABLES after CREATE:', JSON.stringify(r));
  
  r = await callTool('execute_managed_db_query', { databaseId: DB_ID, query: "INSERT INTO test_table (id, name) VALUES (1, 'test')" });
  console.log('INSERT result:', JSON.stringify(r));

  r = await callTool('execute_managed_db_query', { databaseId: DB_ID, query: "SELECT * FROM test_table" });
  console.log('SELECT result:', JSON.stringify(r));

  // Clean up
  r = await callTool('execute_managed_db_query', { databaseId: DB_ID, query: "DROP TABLE IF EXISTS test_table" });
  console.log('DROP result:', JSON.stringify(r));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
