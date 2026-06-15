#!/usr/bin/env node

/**
 * Uses the workflow-based approach to execute DDL:
 * 1. Create a temporary workflow with a dbWrite node (operation: raw)
 * 2. Execute the workflow
 * 3. Repeat for each statement
 * 
 * This is the same pattern used in run-my-ddl.mjs from a previous project.
 */

const API_KEY = 'vntg_7aEF3glus_kuqwsdEY9ir910UhmNFbpUqaABhN7m4hA';
const MCP_URL = 'https://mcp.intuidy.com/mcp';
const REST_URL = 'https://vantage.intuidy.com/api/v1';
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
  const r = await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-ddl-wf', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });
  console.log('MCP initialized. Session:', sessionId);
}

async function callTool(name, args) {
  const res = await mcpPost({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } });
  const c = res?.result?.content?.[0]?.text;
  if (c) { try { return JSON.parse(c); } catch { return c; } }
  if (res?.error) return { error: res.error.message };
  return res;
}

// Credential ID for the database - we need to find/use the right one
// DB ID 3 has credential_id: 47 based on list_managed_databases output
const CRED_ID = '47';

async function executeDDLviaWorkflow(sqlStatement, label) {
  process.stdout.write(`  ${label}... `);
  
  try {
    // Step 1: Create a temporary workflow
    const wf = await callTool('create_workflow', { title: `DDL: ${label} ${Date.now()}` });
    const wfId = wf?.id || wf?.workflowId;
    
    if (!wfId) {
      console.log('❌ Failed to create workflow');
      console.log('   ', JSON.stringify(wf).slice(0, 200));
      return false;
    }
    
    // Step 2: Update workflow with dbWrite node
    const updateResult = await callTool('update_workflow', {
      workflowId: wfId,
      nodes: [
        {
          node_type: 'dbconnectors/dbWrite',
          node_role: 'setter',
          label: label,
          config: {
            query: sqlStatement,
            operation: 'raw',
            inputs: [{ key: 'i1', label: 'Input' }],
            outputs: [{ key: 'o1', label: 'Output' }],
            credentialRef: {
              strategy: 'default',
              credentialId: CRED_ID
            }
          }
        },
        {
          node_type: 'outputs/workflowOutput',
          node_role: 'terminator',
          label: 'Result',
          config: {
            inputs: [{ key: 'i1', label: 'Input' }],
            outputs: [{ key: 'o1', label: 'Output' }],
            outputName: 'result'
          }
        }
      ],
      edges: [
        {
          source_node_index: 0,
          target_node_index: 1,
          source_key: 'o1',
          target_key: 'i1'
        }
      ]
    });
    
    if (updateResult?.error) {
      console.log('❌ Failed to update workflow');
      console.log('   ', updateResult.error);
      await callTool('delete_workflow', { workflowId: wfId });
      return false;
    }
    
    // Step 3: Execute the workflow
    const execResult = await callTool('execute_workflow', { workflowId: wfId });
    
    // Step 4: Clean up - delete temp workflow
    await callTool('delete_workflow', { workflowId: wfId });
    
    const resultStr = JSON.stringify(execResult).slice(0, 200);
    if (typeof execResult === 'string' && execResult.toLowerCase().includes('error')) {
      console.log('❌');
      console.log(`   ${execResult.slice(0, 200)}`);
      return false;
    } else if (execResult?.error) {
      console.log('❌');
      console.log(`   ${execResult.error}`);
      return false;
    } else {
      console.log('✅');
      console.log(`   ${resultStr}`);
      return true;
    }
  } catch (e) {
    console.log('❌ Exception:', e.message);
    return false;
  }
}

async function main() {
  await init();
  
  // First, let's verify we have the right credential by listing databases
  console.log('=== Checking Database ===');
  const dbStatus = await callTool('get_database_status', { databaseId: 3 });
  console.log(`DB 3: "${dbStatus.name}" (credential_id: ${dbStatus.credential_id})`);
  console.log(`DB name: ${dbStatus.db_name}`);
  console.log(`Status: ${dbStatus.status}\n`);
  
  // Test with a simple DDL first
  console.log('=== Test: Creating test table via workflow ===');
  const testOk = await executeDDLviaWorkflow(
    "CREATE TABLE IF NOT EXISTS nb_test_workflow (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100))",
    'Test Table'
  );
  
  if (!testOk) {
    console.log('\n⚠️  Workflow approach also failed. Let me try with credentialId "2" (which worked for the previous project)...\n');
    // The previous project used credentialId '2' successfully
    // Let me try that as a fallback
  }
  
  // Verify test table
  console.log('\n=== Verify test table ===');
  const verify = await callTool('execute_managed_db_query', { databaseId: 3, query: "SHOW TABLES LIKE 'nb_test%'" });
  console.log('Result:', JSON.stringify(verify));
  
  // Now create all the actual tables
  console.log('\n=== Creating National Beef Schema via Workflows ===\n');
  
  const statements = [
    { label: '1. organizations', sql: `CREATE TABLE IF NOT EXISTS organizations (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(50) UNIQUE NOT NULL, logo_url VARCHAR(1000), branding_config JSON, status ENUM('active','inactive','trial') DEFAULT 'active', metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)` },
    { label: '2. INSERT org', sql: `INSERT INTO organizations (name, code, logo_url) VALUES ('National Beef', 'national-beef', 'https://www.nationalbeef.com/wp-content/uploads/2025/09/NB_Logo.svg')` },
    { label: '3. facilities', sql: `CREATE TABLE IF NOT EXISTS facilities (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, name VARCHAR(255) NOT NULL, code VARCHAR(10) NOT NULL, location VARCHAR(500), address VARCHAR(500), timezone VARCHAR(50) DEFAULT 'America/Chicago', floor_plan_url VARCHAR(1000), status ENUM('active','inactive','maintenance') DEFAULT 'active', metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY org_code (organization_id, code), FOREIGN KEY (organization_id) REFERENCES organizations(id))` },
    { label: '4. INSERT facility', sql: `INSERT INTO facilities (organization_id, name, code, location, address) VALUES (1, 'Kansas City, Kansas', 'kck', 'Kansas City, KS', 'KCK Facility Address')` },
    { label: '5. roles', sql: `CREATE TABLE IF NOT EXISTS nb_roles (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, name VARCHAR(100) NOT NULL, description VARCHAR(500), permissions JSON, is_system BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY org_role (organization_id, name), FOREIGN KEY (organization_id) REFERENCES organizations(id))` },
    { label: '6. INSERT roles', sql: `INSERT INTO nb_roles (organization_id, name, description, permissions, is_system) VALUES (1, 'admin', 'Full system access', '{"all": true}', TRUE), (1, 'safety_director', 'Safety and compliance oversight', '{"dashboard": true, "cameras": true, "safety": true, "employees": true, "incidents": true, "reports": true, "audit": true}', TRUE), (1, 'floor_manager', 'Production floor management', '{"dashboard": true, "cameras": true, "production": true, "employees": true, "forklifts": true}', TRUE), (1, 'security', 'Security monitoring', '{"dashboard": true, "cameras": true, "safety": true, "incidents": true}', TRUE), (1, 'operator', 'Basic monitoring access', '{"dashboard": true, "cameras": "read"}', TRUE)` },
    { label: '7. nb_users', sql: `CREATE TABLE IF NOT EXISTS nb_users (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, username VARCHAR(100) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, first_name VARCHAR(100), last_name VARCHAR(100), role_id INT, status ENUM('active','inactive','locked','pending') DEFAULT 'pending', last_login TIMESTAMP NULL, preferences JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (organization_id) REFERENCES organizations(id), FOREIGN KEY (role_id) REFERENCES nb_roles(id))` },
    { label: '8. user_sessions', sql: `CREATE TABLE IF NOT EXISTS user_sessions (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, token_hash VARCHAR(255) NOT NULL, ip_address VARCHAR(45), user_agent VARCHAR(500), expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES nb_users(id))` },
    { label: '9. cameras', sql: `CREATE TABLE IF NOT EXISTS cameras (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, name VARCHAR(255) NOT NULL, location_description VARCHAR(500), camera_type ENUM('floor','line','entrance','hazard_zone','outdoor','other') DEFAULT 'floor', stream_url VARCHAR(1000), stream_type ENUM('rtsp','hls','vantage','other') DEFAULT 'vantage', status ENUM('pending_setup','online','offline','maintenance') DEFAULT 'pending_setup', zone_id INT, production_line_id INT, ai_enabled BOOLEAN DEFAULT TRUE, recording_enabled BOOLEAN DEFAULT FALSE, last_heartbeat TIMESTAMP NULL, config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '10. production_lines', sql: `CREATE TABLE IF NOT EXISTS production_lines (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, name VARCHAR(255) NOT NULL, line_number VARCHAR(50), line_type ENUM('slaughter','fabrication','packaging','shipping','other') DEFAULT 'fabrication', status ENUM('running','stopped','maintenance','alert') DEFAULT 'stopped', target_throughput DECIMAL(10,2), current_speed DECIMAL(10,2), sensor_config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '11. production_logs', sql: `CREATE TABLE IF NOT EXISTS production_logs (id INT AUTO_INCREMENT PRIMARY KEY, production_line_id INT NOT NULL, event_type ENUM('start','stop','pause','speed_change','jam','maintenance','shift_change') NOT NULL, details JSON, throughput_count INT, recorded_by INT, recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (production_line_id) REFERENCES production_lines(id))` },
    { label: '12. zones', sql: `CREATE TABLE IF NOT EXISTS zones (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, name VARCHAR(255) NOT NULL, zone_type ENUM('restricted','hazardous','authorized','general') DEFAULT 'general', geometry JSON, color VARCHAR(7) DEFAULT '#FF0000', alert_on_entry BOOLEAN DEFAULT TRUE, alert_on_exit BOOLEAN DEFAULT FALSE, max_occupancy INT, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '13. employees', sql: `CREATE TABLE IF NOT EXISTS employees (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, employee_number VARCHAR(50), first_name VARCHAR(100), last_name VARCHAR(100), department VARCHAR(100), role VARCHAR(100), barcode_id VARCHAR(100), helmet_barcode VARCHAR(100), status ENUM('active','inactive','on_leave') DEFAULT 'active', ppe_certified BOOLEAN DEFAULT FALSE, forklift_certified BOOLEAN DEFAULT FALSE, certifications JSON, contact_info JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id), UNIQUE KEY fac_emp (facility_id, employee_number), UNIQUE KEY fac_barcode (facility_id, barcode_id))` },
    { label: '14. iot_devices', sql: `CREATE TABLE IF NOT EXISTS iot_devices (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, device_name VARCHAR(255), device_type ENUM('temperature','motion','proximity','gas','humidity','barcode_scanner','rfid_reader','belt_speed','weight_scale','other') DEFAULT 'other', location_description VARCHAR(500), production_line_id INT, status ENUM('online','offline','maintenance','error') DEFAULT 'online', last_value JSON, last_heartbeat TIMESTAMP NULL, alert_threshold JSON, config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '15. incidents', sql: `CREATE TABLE IF NOT EXISTS incidents (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, incident_type ENUM('zone_breach','safety_violation','equipment_failure','injury','near_miss','unauthorized_access','line_stoppage','other') DEFAULT 'other', severity ENUM('low','medium','high','critical') DEFAULT 'medium', title VARCHAR(500), description TEXT, employee_id INT, zone_id INT, camera_id INT, device_id INT, production_line_id INT, status ENUM('open','investigating','resolved','closed') DEFAULT 'open', resolved_at TIMESTAMP NULL, resolved_by INT, evidence_urls JSON, notes JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '16. alerts', sql: `CREATE TABLE IF NOT EXISTS alerts (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, alert_type ENUM('zone_breach','device_offline','safety_violation','system_error','maintenance','ai_detection','line_alert','throughput_drop') DEFAULT 'system_error', severity ENUM('info','warning','critical','emergency') DEFAULT 'warning', title VARCHAR(500), message TEXT, source_type ENUM('camera','iot_device','zone','system','workflow','production_line') DEFAULT 'system', source_id INT, acknowledged BOOLEAN DEFAULT FALSE, acknowledged_by INT, acknowledged_at TIMESTAMP NULL, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '17. forklifts', sql: `CREATE TABLE IF NOT EXISTS forklifts (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, unit_number VARCHAR(50), model VARCHAR(255), status ENUM('active','parked','maintenance','out_of_service') DEFAULT 'parked', current_driver_id INT, last_inspection DATE, next_maintenance DATE, total_hours DECIMAL(10,2), config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id), UNIQUE KEY fac_unit (facility_id, unit_number))` },
    { label: '18. time_entries', sql: `CREATE TABLE IF NOT EXISTS time_entries (id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, facility_id INT NOT NULL, clock_in TIMESTAMP, clock_out TIMESTAMP NULL, zone_log JSON, break_minutes INT DEFAULT 0, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (employee_id) REFERENCES employees(id), FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '19. chat_history', sql: `CREATE TABLE IF NOT EXISTS chat_history (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, user_id INT, user_message TEXT NOT NULL, ai_response TEXT, query_generated VARCHAR(2000), response_time_ms INT, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '20. audit_log', sql: `CREATE TABLE IF NOT EXISTS audit_log (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, action_type VARCHAR(100), entity_type VARCHAR(100), entity_id INT, user_id INT, details JSON, ip_address VARCHAR(45), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '21. ai_events', sql: `CREATE TABLE IF NOT EXISTS ai_events (id INT AUTO_INCREMENT PRIMARY KEY, camera_id INT, facility_id INT, event_type VARCHAR(100), confidence DECIMAL(5,4), frame_url VARCHAR(1000), bounding_box JSON, metadata JSON, reviewed BOOLEAN DEFAULT FALSE, reviewed_by INT, false_positive BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '22. branding_config', sql: `CREATE TABLE IF NOT EXISTS branding_config (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, company_name VARCHAR(255), logo_url VARCHAR(1000), logo_dark_url VARCHAR(1000), favicon_url VARCHAR(1000), primary_color VARCHAR(7) DEFAULT '#002D72', accent_color VARCHAR(7) DEFAULT '#009DD9', dark_color VARCHAR(7) DEFAULT '#001639', body_font VARCHAR(100) DEFAULT 'Open Sans', heading_font VARCHAR(100) DEFAULT 'Nunito', custom_css TEXT, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (organization_id) REFERENCES organizations(id))` },
    { label: '23. INSERT branding', sql: `INSERT INTO branding_config (organization_id, company_name, logo_url, primary_color, accent_color, dark_color) VALUES (1, 'National Beef', 'https://www.nationalbeef.com/wp-content/uploads/2025/09/NB_Logo.svg', '#002D72', '#009DD9', '#001639')` },
  ];
  
  let successes = 0;
  let failures = 0;
  
  for (const stmt of statements) {
    const ok = await executeDDLviaWorkflow(stmt.sql, stmt.label);
    if (ok) successes++; else failures++;
    await new Promise(r => setTimeout(r, 1000));
  }
  
  console.log(`\n=== SUMMARY ===`);
  console.log(`✅ Successes: ${successes}/23`);
  console.log(`❌ Failures: ${failures}/23`);
  
  // Verify
  console.log('\n=== VERIFICATION ===');
  const orgs = await callTool('execute_managed_db_query', { databaseId: 3, query: 'SELECT * FROM organizations' });
  console.log('Organizations:', JSON.stringify(orgs).slice(0, 300));
  
  const facs = await callTool('execute_managed_db_query', { databaseId: 3, query: 'SELECT * FROM facilities' });
  console.log('Facilities:', JSON.stringify(facs).slice(0, 300));
  
  const roles = await callTool('execute_managed_db_query', { databaseId: 3, query: 'SELECT id, name FROM nb_roles' });
  console.log('Roles:', JSON.stringify(roles).slice(0, 300));
  
  const tables = await callTool('execute_managed_db_query', { databaseId: 3, query: "SHOW TABLES LIKE 'organizations'" });
  console.log('Check organizations table:', JSON.stringify(tables));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
