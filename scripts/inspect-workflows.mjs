const API_KEY = 'vntg_7aEF3glus_kuqwsdEY9ir910UhmNFbpUqaABhN7m4hA';
const MCP_URL = 'https://mcp.intuidy.com/mcp';
let sessionId = null;

async function mcpPost(p) {
  const h = { 'Content-Type': 'application/json', 'Accept': 'application/json, text/event-stream', 'Authorization': `Bearer ${API_KEY}` };
  if (sessionId) h['Mcp-Session-Id'] = sessionId;
  const r = await fetch(MCP_URL, { method: 'POST', headers: h, body: JSON.stringify(p) });
  const s = r.headers.get('mcp-session-id'); if (s) sessionId = s;
  const t = await r.text();
  try { return JSON.parse(t); } catch { return { raw: t.slice(0,2000) }; }
}

async function callTool(name, args) {
  const r = await mcpPost({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } });
  const c = r?.result?.content?.[0]?.text;
  if (c) { try { return JSON.parse(c); } catch { return c; } }
  return r;
}

async function main() {
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'inspect', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });

  const wfs = await callTool('list_workflows', { limit: 10 });
  console.log(JSON.stringify(wfs, null, 2));
  if (Array.isArray(wfs)) {
    for (const w of wfs) {
      if (true) {
        console.log(`\n=== Workflow ${w.id} (${w.title}) Nodes ===`);
        for (const n of w.workflow_nodes) {
            console.log(`- ${n.node_type} (Role: ${n.node_role}, Label: ${n.label})`);
        }
      }
    }
  }
}

main().catch(console.error);
