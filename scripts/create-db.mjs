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
  try { return JSON.parse(text); } catch {
    const lines = text.split('\n');
    for (const line of lines) { if (line.startsWith('data: ')) { try { return JSON.parse(line.slice(6)); } catch {} } }
    return { raw: text.slice(0, 2000) };
  }
}

async function callTool(name, args) {
  const res = await mcpPost({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } });
  const content = res?.result?.content?.[0]?.text;
  if (content) { try { return JSON.parse(content); } catch { return content; } }
  if (res?.error) return `Error: ${res.error.message}`;
  return res;
}

async function main() {
  // Initialize
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-db-create', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });
  console.log('Session initialized. ID:', sessionId);

  // List all tools to find "create" tools
  const res = await mcpPost({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} });
  const tools = res?.result?.tools || [];
  const createTools = tools.filter(t => t.name.toLowerCase().includes('creat') || t.name.toLowerCase().includes('managed'));
  console.log('\n=== Create/Managed DB Tools ===');
  for (const t of createTools) {
    console.log(`\n📦 ${t.name}`);
    console.log(`   ${t.description}`);
    console.log(`   Schema: ${JSON.stringify(t.inputSchema?.properties || {}, null, 2)}`);
  }

  // Use General DB for Test Projects (ID 3) as a fallback - it's active and has space
  console.log('\n\n=== Trying to use "General DB for Test Projects" (ID 3) ===');
  const tables = await callTool('execute_managed_db_query', { databaseId: 3, query: 'SHOW TABLES' });
  console.log('Existing tables:', JSON.stringify(tables));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
