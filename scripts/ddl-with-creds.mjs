const API_KEY = 'vntg_I8B07QTVVff24CXHEvE_UGg1GBIkkbWFxu-nojD3JuU';
const MCP_URL = 'https://mcp.intuidy.com/mcp';
const DB_ID = 10;
const CRED_ID = 58;
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

async function executeOneDDL(label, ddl) {
  process.stdout.write(`  ${label}... `);
  
  // Update workflow with db_write node using credential
  const upd = await callTool('update_workflow', {
    workflowId: WF_ID,
    nodes: [
      { 
        node_type: 'db_write', 
        node_role: 'setter', 
        label: label, 
        config: { 
          credentialId: CRED_ID,
          managedDatabaseId: DB_ID,
          query: ddl 
        } 
      }
    ],
    edges: []
  });

  if (typeof upd === 'string' && (upd.includes('rror') || upd.includes('invalid'))) {
    console.log('❌ update: ' + upd.slice(0, 200));
    return false;
  }

  // Execute workflow
  const exec = await callTool('execute_workflow', { workflowId: WF_ID, output_node_id: 0 });
  const execStr = typeof exec === 'string' ? exec : JSON.stringify(exec);
  
  if (execStr.toLowerCase().includes('error')) {
    console.log('❌ exec: ' + execStr.slice(0, 200));
    return false;
  }
  
  console.log('✅');
  return true;
}

async function main() {
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-ddl2', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });

  console.log(`=== DDL via workflow ${WF_ID}, DB ${DB_ID}, Credential ${CRED_ID} ===\n`);

  // First just test one table
  const testResult = await executeOneDDL('TEST organizations', "CREATE TABLE IF NOT EXISTS organizations (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(50) UNIQUE NOT NULL, logo_url VARCHAR(1000), branding_config JSON, status ENUM('active','inactive','trial') DEFAULT 'active', metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)");

  // Check if it actually created
  console.log('\n=== Verifying ===');
  const tables = await callTool('execute_managed_db_query', { databaseId: DB_ID, query: 'SHOW TABLES' });
  console.log('SHOW TABLES:', JSON.stringify(tables));

  // If it worked, try inserting
  if (tables?.rows?.length > 0) {
    console.log('\n✅ DDL working! Proceeding with remaining tables...');
  } else {
    console.log('\n⚠️ Tables still empty. Trying different node_type variations...');
    
    // Try different node types
    for (const nodeType of ['db_query', 'database_write', 'database_query', 'managed_db_write', 'sql_query', 'raw_sql']) {
      console.log(`\n--- Trying node_type: "${nodeType}" ---`);
      const upd = await callTool('update_workflow', {
        workflowId: WF_ID,
        nodes: [{ node_type: nodeType, node_role: 'setter', label: 'Test', config: { credentialId: CRED_ID, managedDatabaseId: DB_ID, query: "CREATE TABLE IF NOT EXISTS test_tbl (id INT PRIMARY KEY)" } }],
        edges: []
      });
      console.log('  Update:', typeof upd === 'string' ? upd.slice(0, 150) : JSON.stringify(upd).slice(0, 150));
      
      if (typeof upd === 'string' && !upd.includes('rror')) {
        const exec = await callTool('execute_workflow', { workflowId: WF_ID, output_node_id: 0 });
        console.log('  Execute:', typeof exec === 'string' ? exec.slice(0, 150) : JSON.stringify(exec).slice(0, 150));
        
        const chk = await callTool('execute_managed_db_query', { databaseId: DB_ID, query: 'SHOW TABLES' });
        console.log('  Tables:', JSON.stringify(chk));
        if (chk?.rows?.length > 0) { console.log('  ✅ FOUND WORKING NODE TYPE!'); break; }
      }
    }
  }
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
