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
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-verify', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });
}

async function sql(dbId, query) {
  const res = await mcpPost({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: 'execute_managed_db_query', arguments: { databaseId: dbId, query } } });
  const c = res?.result?.content?.[0]?.text;
  if (c) { try { return JSON.parse(c); } catch { return c; } }
  if (res?.error) return `Error: ${res.error.message}`;
  return res;
}

async function main() {
  await init();
  const DB = 3;
  
  // Check if our National Beef tables exist
  console.log('=== Checking for National Beef tables on DB 3 ===');
  const nbTables = await sql(DB, "SHOW TABLES LIKE 'organizations'");
  console.log('organizations table:', JSON.stringify(nbTables));
  
  const nbTables2 = await sql(DB, "SHOW TABLES LIKE 'facilities'");
  console.log('facilities table:', JSON.stringify(nbTables2));
  
  const nbTables3 = await sql(DB, "SHOW TABLES LIKE 'cameras'");
  console.log('cameras table:', JSON.stringify(nbTables3));
  
  const nbTables4 = await sql(DB, "SHOW TABLES LIKE 'ai_events'");
  console.log('ai_events table:', JSON.stringify(nbTables4));
  
  const nbTables5 = await sql(DB, "SHOW TABLES LIKE 'branding_config'");
  console.log('branding_config table:', JSON.stringify(nbTables5));

  // Check if the tables were actually created
  console.log('\n=== Trying to query organizations ===');
  const orgs = await sql(DB, 'SELECT * FROM organizations LIMIT 5');
  console.log('organizations:', JSON.stringify(orgs));
  
  console.log('\n=== Trying to query facilities ===');
  const facs = await sql(DB, 'SELECT * FROM facilities LIMIT 5');
  console.log('facilities:', JSON.stringify(facs));
  
  console.log('\n=== Trying to query cameras ===');
  const cams = await sql(DB, 'SELECT * FROM cameras LIMIT 5');
  console.log('cameras:', JSON.stringify(cams));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
