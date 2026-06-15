const MCP_URL = 'https://mcp.intuidy.com/mcp';
const API_KEY = 'vntg_I8B07QTVVff24CXHEvE_UGg1GBIkkbWFxu-nojD3JuU';

function parseSSE(text) {
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      try { return JSON.parse(line.slice(6)); } catch {}
    }
  }
  try { return JSON.parse(text); } catch {}
  return null;
}

async function main() {
  // Step 1: Initialize
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'test', version: '1.0.0' } },
    }),
  });

  console.log('Status:', res.status);
  console.log('Headers:');
  for (const [k, v] of res.headers.entries()) console.log(`  ${k}: ${v}`);
  const body1 = await res.text();
  const sid = res.headers.get('mcp-session-id');
  console.log('Session ID from header:', sid);
  console.log('Body parsed:', JSON.stringify(parseSSE(body1)).slice(0, 200));

  // Step 2: Direct query (no session, no init notification)
  console.log('\n=== Direct query attempt ===');
  const headers2 = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${API_KEY}`,
  };
  if (sid) headers2['Mcp-Session-Id'] = sid;

  const res2 = await fetch(MCP_URL, {
    method: 'POST',
    headers: headers2,
    body: JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'execute_managed_db_query', arguments: { databaseId: 10, query: 'SELECT COUNT(*) as cnt FROM cameras' } },
    }),
  });
  console.log('Status:', res2.status);
  const body2 = await res2.text();
  console.log('Raw:', body2.slice(0, 600));
  const parsed = parseSSE(body2);
  if (parsed) {
    console.log('Parsed:', JSON.stringify(parsed, null, 2).slice(0, 500));
    if (parsed.result?.content?.[0]?.text) {
      console.log('Content text:', parsed.result.content[0].text);
    }
  }
}

main().catch(console.error);
