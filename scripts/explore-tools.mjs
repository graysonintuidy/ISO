#!/usr/bin/env node

const API_KEY = 'vntg_7aEF3glus_kuqwsdEY9ir910UhmNFbpUqaABhN7m4hA';
const MCP_URL = 'https://mcp.intuidy.com/mcp';
let sessionId = null;

async function mcpPost(payload) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${API_KEY}`,
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
  });
  
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try { data = JSON.parse(line.slice(6)); break; } catch {}
      }
    }
    if (!data) return { raw: text.slice(0, 1000) };
  }
  return data;
}

async function initialize() {
  await mcpPost({
    jsonrpc: '2.0', id: 1, method: 'initialize',
    params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-schema', version: '1.0.0' } }
  });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });
  console.log('MCP session initialized.');
}

async function callTool(name, args) {
  const res = await mcpPost({
    jsonrpc: '2.0', id: Date.now(), method: 'tools/call',
    params: { name, arguments: args }
  });
  const content = res?.result?.content?.[0]?.text;
  if (content) { try { return JSON.parse(content); } catch { return content; } }
  if (res?.error) return `Error: ${res.error.message}`;
  return res;
}

async function main() {
  await initialize();
  
  // List ALL tools to find database creation tools
  const toolsRes = await mcpPost({
    jsonrpc: '2.0', id: 2, method: 'tools/list', params: {}
  });
  
  const tools = toolsRes?.result?.tools || [];
  console.log('\n=== ALL MCP Tools ===');
  for (const tool of tools) {
    console.log(`\n📦 ${tool.name}`);
    if (tool.description) console.log(`   Description: ${tool.description}`);
    if (tool.inputSchema?.properties) {
      console.log(`   Parameters: ${Object.keys(tool.inputSchema.properties).join(', ')}`);
      // Show required params
      if (tool.inputSchema.required) {
        console.log(`   Required: ${tool.inputSchema.required.join(', ')}`);
      }
    }
  }
  
  // Try using the second API key from the other project  
  console.log('\n\n=== Trying alternative API key ===');
  const ALT_KEY = 'vntg_7kik1HIdHbL4UZSN0VScuwguSUFsZLnen85q3HaqONk';
  const altRes = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${ALT_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 1, method: 'initialize',
      params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-alt', version: '1.0.0' } }
    }),
  });
  const altText = await altRes.text();
  console.log('Alt key response:', altText.slice(0, 300));
  
  // Try listing databases with alt key
  const altSid = altRes.headers.get('mcp-session-id');
  const altDbsRes = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${ALT_KEY}`,
      ...(altSid ? { 'Mcp-Session-Id': altSid } : {}),
    },
    body: JSON.stringify({
      jsonrpc: '2.0', id: 2, method: 'tools/call',
      params: { name: 'list_managed_databases', arguments: {} }
    }),
  });
  const altDbsText = await altDbsRes.text();
  console.log('Alt key databases:', altDbsText.slice(0, 500));

  // Also try the Vantage REST API to list databases
  console.log('\n\n=== Trying REST API at vantage.intuidy.com ===');
  const restRes = await fetch('https://vantage.intuidy.com/api/v1/managed-databases', {
    headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' }
  });
  console.log('REST response status:', restRes.status);
  const restText = await restRes.text();
  console.log('REST response:', restText.slice(0, 500));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
