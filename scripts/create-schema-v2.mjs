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
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-create2', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });
  console.log('Initialized.');
}

async function sql(dbId, query, label) {
  const res = await mcpPost({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name: 'execute_managed_db_query', arguments: { databaseId: dbId, query } } });
  const c = res?.result?.content?.[0]?.text;
  let result;
  if (c) { try { result = JSON.parse(c); } catch { result = c; } }
  else if (res?.error) result = `MCP Error: ${res.error.message}`;
  else result = res;
  
  const isError = typeof result === 'string' && result.toLowerCase().includes('error');
  console.log(`${isError ? '❌' : '✅'} ${label}`);
  if (isError) console.log(`   ${result}`);
  else if (result && typeof result === 'object') console.log(`   ${JSON.stringify(result).slice(0, 150)}`);
  
  return { ok: !isError, result };
}

async function main() {
  await init();
  const DB = 3;
  
  console.log(`\nTarget: Database ID ${DB}\n`);
  
  // Test with a simple CREATE TABLE first
  console.log('=== Test: Simple CREATE TABLE ===');
  await sql(DB, "CREATE TABLE IF NOT EXISTS nb_test_123 (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100))", 'Test table');
  
  // Check if it was created
  const check = await sql(DB, "SHOW TABLES LIKE 'nb_test_123'", 'Verify test table');
  
  if (check.result?.rows?.length > 0) {
    console.log('   ✅ Test table created successfully! CREATE TABLE works.');
    // Drop it
    await sql(DB, "DROP TABLE IF EXISTS nb_test_123", 'Cleanup test table');
  } else {
    console.log('   ⚠️ Test table not created. The MCP tool may not support DDL.');
    console.log('   Trying raw SQL approach...');
    
    // Try without IF NOT EXISTS
    await sql(DB, "CREATE TABLE nb_test_456 (id INT PRIMARY KEY, name VARCHAR(100))", 'Test without IF NOT EXISTS');
    const check2 = await sql(DB, "SHOW TABLES LIKE 'nb_test_456'", 'Verify test2');
    console.log('   Result:', JSON.stringify(check2.result));
  }
  
  // Now create the actual tables
  console.log('\n=== Creating National Beef Schema ===\n');
  
  // 1. organizations (no FK)
  await sql(DB, `CREATE TABLE IF NOT EXISTS organizations (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(50) UNIQUE NOT NULL, logo_url VARCHAR(1000), branding_config JSON, status ENUM('active','inactive','trial') DEFAULT 'active', metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`, '1. organizations');
  await new Promise(r => setTimeout(r, 500));
  
  // 2. INSERT org
  await sql(DB, `INSERT INTO organizations (name, code, logo_url) VALUES ('National Beef', 'national-beef', 'https://www.nationalbeef.com/wp-content/uploads/2025/09/NB_Logo.svg')`, '2. INSERT org');
  await new Promise(r => setTimeout(r, 500));
  
  // 3. facilities (FK -> organizations)
  await sql(DB, `CREATE TABLE IF NOT EXISTS facilities (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, name VARCHAR(255) NOT NULL, code VARCHAR(10) NOT NULL, location VARCHAR(500), address VARCHAR(500), timezone VARCHAR(50) DEFAULT 'America/Chicago', floor_plan_url VARCHAR(1000), status ENUM('active','inactive','maintenance') DEFAULT 'active', metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY org_code (organization_id, code), FOREIGN KEY (organization_id) REFERENCES organizations(id))`, '3. facilities');
  await new Promise(r => setTimeout(r, 500));
  
  // 4. INSERT facility
  await sql(DB, `INSERT INTO facilities (organization_id, name, code, location, address) VALUES (1, 'Kansas City, Kansas', 'kck', 'Kansas City, KS', 'KCK Facility Address')`, '4. INSERT facility');
  await new Promise(r => setTimeout(r, 500));
  
  // 5. roles (FK -> organizations)  -- note: DB3 already has a 'roles' table, so we may need to prefix
  // Let's check if roles already exists and what it looks like
  const rolesCheck = await sql(DB, "DESCRIBE roles", 'Check existing roles table');
  
  // If roles already exists with different schema, we need to use a prefix
  const usePrefix = rolesCheck.ok;
  const prefix = usePrefix ? 'nb_' : '';
  
  if (usePrefix) {
    console.log('\n⚠️  Tables like "roles" and "users" already exist. Using "nb_" prefix for conflicting tables.\n');
  }
  
  // 5. roles
  await sql(DB, `CREATE TABLE IF NOT EXISTS ${prefix}roles (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, name VARCHAR(100) NOT NULL, description VARCHAR(500), permissions JSON, is_system BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY org_role (organization_id, name), FOREIGN KEY (organization_id) REFERENCES organizations(id))`, `5. ${prefix}roles`);
  await new Promise(r => setTimeout(r, 500));
  
  // 6. INSERT roles
  await sql(DB, `INSERT INTO ${prefix}roles (organization_id, name, description, permissions, is_system) VALUES (1, 'admin', 'Full system access', '{"all": true}', TRUE), (1, 'safety_director', 'Safety and compliance oversight', '{"dashboard": true, "cameras": true, "safety": true, "employees": true, "incidents": true, "reports": true, "audit": true}', TRUE), (1, 'floor_manager', 'Production floor management', '{"dashboard": true, "cameras": true, "production": true, "employees": true, "forklifts": true}', TRUE), (1, 'security', 'Security monitoring', '{"dashboard": true, "cameras": true, "safety": true, "incidents": true}', TRUE), (1, 'operator', 'Basic monitoring access', '{"dashboard": true, "cameras": "read"}', TRUE)`, `6. INSERT ${prefix}roles`);
  await new Promise(r => setTimeout(r, 500));
  
  // 7. users (may also conflict)
  const usersCheck = await sql(DB, "DESCRIBE users", 'Check existing users table');
  const usersPrefix = usersCheck.ok ? 'nb_' : '';
  
  await sql(DB, `CREATE TABLE IF NOT EXISTS ${usersPrefix}users (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, username VARCHAR(100) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, first_name VARCHAR(100), last_name VARCHAR(100), role_id INT, status ENUM('active','inactive','locked','pending') DEFAULT 'pending', last_login TIMESTAMP NULL, preferences JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (organization_id) REFERENCES organizations(id), FOREIGN KEY (role_id) REFERENCES ${prefix}roles(id))`, `7. ${usersPrefix}users`);
  await new Promise(r => setTimeout(r, 500));
  
  // 8. user_sessions
  await sql(DB, `CREATE TABLE IF NOT EXISTS user_sessions (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, token_hash VARCHAR(255) NOT NULL, ip_address VARCHAR(45), user_agent VARCHAR(500), expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES ${usersPrefix}users(id))`, '8. user_sessions');
  await new Promise(r => setTimeout(r, 500));
  
  // 9. cameras
  await sql(DB, `CREATE TABLE IF NOT EXISTS cameras (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, name VARCHAR(255) NOT NULL, location_description VARCHAR(500), camera_type ENUM('floor','line','entrance','hazard_zone','outdoor','other') DEFAULT 'floor', stream_url VARCHAR(1000), stream_type ENUM('rtsp','hls','vantage','other') DEFAULT 'vantage', status ENUM('pending_setup','online','offline','maintenance') DEFAULT 'pending_setup', zone_id INT, production_line_id INT, ai_enabled BOOLEAN DEFAULT TRUE, recording_enabled BOOLEAN DEFAULT FALSE, last_heartbeat TIMESTAMP NULL, config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))`, '9. cameras');
  await new Promise(r => setTimeout(r, 500));
  
  // 10. production_lines
  await sql(DB, `CREATE TABLE IF NOT EXISTS production_lines (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, name VARCHAR(255) NOT NULL, line_number VARCHAR(50), line_type ENUM('slaughter','fabrication','packaging','shipping','other') DEFAULT 'fabrication', status ENUM('running','stopped','maintenance','alert') DEFAULT 'stopped', target_throughput DECIMAL(10,2), current_speed DECIMAL(10,2), sensor_config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))`, '10. production_lines');
  await new Promise(r => setTimeout(r, 500));
  
  // 11. production_logs
  await sql(DB, `CREATE TABLE IF NOT EXISTS production_logs (id INT AUTO_INCREMENT PRIMARY KEY, production_line_id INT NOT NULL, event_type ENUM('start','stop','pause','speed_change','jam','maintenance','shift_change') NOT NULL, details JSON, throughput_count INT, recorded_by INT, recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (production_line_id) REFERENCES production_lines(id))`, '11. production_logs');
  await new Promise(r => setTimeout(r, 500));
  
  // 12. zones
  await sql(DB, `CREATE TABLE IF NOT EXISTS zones (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, name VARCHAR(255) NOT NULL, zone_type ENUM('restricted','hazardous','authorized','general') DEFAULT 'general', geometry JSON, color VARCHAR(7) DEFAULT '#FF0000', alert_on_entry BOOLEAN DEFAULT TRUE, alert_on_exit BOOLEAN DEFAULT FALSE, max_occupancy INT, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))`, '12. zones');
  await new Promise(r => setTimeout(r, 500));
  
  // 13. employees
  await sql(DB, `CREATE TABLE IF NOT EXISTS employees (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, employee_number VARCHAR(50), first_name VARCHAR(100), last_name VARCHAR(100), department VARCHAR(100), role VARCHAR(100), barcode_id VARCHAR(100), helmet_barcode VARCHAR(100), status ENUM('active','inactive','on_leave') DEFAULT 'active', ppe_certified BOOLEAN DEFAULT FALSE, forklift_certified BOOLEAN DEFAULT FALSE, certifications JSON, contact_info JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id), UNIQUE KEY fac_emp (facility_id, employee_number), UNIQUE KEY fac_barcode (facility_id, barcode_id))`, '13. employees');
  await new Promise(r => setTimeout(r, 500));
  
  // 14. iot_devices
  await sql(DB, `CREATE TABLE IF NOT EXISTS iot_devices (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, device_name VARCHAR(255), device_type ENUM('temperature','motion','proximity','gas','humidity','barcode_scanner','rfid_reader','belt_speed','weight_scale','other') DEFAULT 'other', location_description VARCHAR(500), production_line_id INT, status ENUM('online','offline','maintenance','error') DEFAULT 'online', last_value JSON, last_heartbeat TIMESTAMP NULL, alert_threshold JSON, config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))`, '14. iot_devices');
  await new Promise(r => setTimeout(r, 500));
  
  // 15. incidents
  await sql(DB, `CREATE TABLE IF NOT EXISTS incidents (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, incident_type ENUM('zone_breach','safety_violation','equipment_failure','injury','near_miss','unauthorized_access','line_stoppage','other') DEFAULT 'other', severity ENUM('low','medium','high','critical') DEFAULT 'medium', title VARCHAR(500), description TEXT, employee_id INT, zone_id INT, camera_id INT, device_id INT, production_line_id INT, status ENUM('open','investigating','resolved','closed') DEFAULT 'open', resolved_at TIMESTAMP NULL, resolved_by INT, evidence_urls JSON, notes JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))`, '15. incidents');
  await new Promise(r => setTimeout(r, 500));
  
  // 16. alerts
  await sql(DB, `CREATE TABLE IF NOT EXISTS alerts (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, alert_type ENUM('zone_breach','device_offline','safety_violation','system_error','maintenance','ai_detection','line_alert','throughput_drop') DEFAULT 'system_error', severity ENUM('info','warning','critical','emergency') DEFAULT 'warning', title VARCHAR(500), message TEXT, source_type ENUM('camera','iot_device','zone','system','workflow','production_line') DEFAULT 'system', source_id INT, acknowledged BOOLEAN DEFAULT FALSE, acknowledged_by INT, acknowledged_at TIMESTAMP NULL, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))`, '16. alerts');
  await new Promise(r => setTimeout(r, 500));
  
  // 17. forklifts
  await sql(DB, `CREATE TABLE IF NOT EXISTS forklifts (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, unit_number VARCHAR(50), model VARCHAR(255), status ENUM('active','parked','maintenance','out_of_service') DEFAULT 'parked', current_driver_id INT, last_inspection DATE, next_maintenance DATE, total_hours DECIMAL(10,2), config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id), UNIQUE KEY fac_unit (facility_id, unit_number))`, '17. forklifts');
  await new Promise(r => setTimeout(r, 500));
  
  // 18. time_entries
  await sql(DB, `CREATE TABLE IF NOT EXISTS time_entries (id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, facility_id INT NOT NULL, clock_in TIMESTAMP, clock_out TIMESTAMP NULL, zone_log JSON, break_minutes INT DEFAULT 0, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (employee_id) REFERENCES employees(id), FOREIGN KEY (facility_id) REFERENCES facilities(id))`, '18. time_entries');
  await new Promise(r => setTimeout(r, 500));
  
  // 19. chat_history
  await sql(DB, `CREATE TABLE IF NOT EXISTS chat_history (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, user_id INT, user_message TEXT NOT NULL, ai_response TEXT, query_generated VARCHAR(2000), response_time_ms INT, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))`, '19. chat_history');
  await new Promise(r => setTimeout(r, 500));
  
  // 20. audit_log
  await sql(DB, `CREATE TABLE IF NOT EXISTS audit_log (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, action_type VARCHAR(100), entity_type VARCHAR(100), entity_id INT, user_id INT, details JSON, ip_address VARCHAR(45), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))`, '20. audit_log');
  await new Promise(r => setTimeout(r, 500));
  
  // 21. ai_events
  await sql(DB, `CREATE TABLE IF NOT EXISTS ai_events (id INT AUTO_INCREMENT PRIMARY KEY, camera_id INT, facility_id INT, event_type VARCHAR(100), confidence DECIMAL(5,4), frame_url VARCHAR(1000), bounding_box JSON, metadata JSON, reviewed BOOLEAN DEFAULT FALSE, reviewed_by INT, false_positive BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))`, '21. ai_events');
  await new Promise(r => setTimeout(r, 500));
  
  // 22. branding_config
  await sql(DB, `CREATE TABLE IF NOT EXISTS branding_config (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, company_name VARCHAR(255), logo_url VARCHAR(1000), logo_dark_url VARCHAR(1000), favicon_url VARCHAR(1000), primary_color VARCHAR(7) DEFAULT '#002D72', accent_color VARCHAR(7) DEFAULT '#009DD9', dark_color VARCHAR(7) DEFAULT '#001639', body_font VARCHAR(100) DEFAULT 'Open Sans', heading_font VARCHAR(100) DEFAULT 'Nunito', custom_css TEXT, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (organization_id) REFERENCES organizations(id))`, '22. branding_config');
  await new Promise(r => setTimeout(r, 500));
  
  // 23. INSERT branding_config
  await sql(DB, `INSERT INTO branding_config (organization_id, company_name, logo_url, primary_color, accent_color, dark_color) VALUES (1, 'National Beef', 'https://www.nationalbeef.com/wp-content/uploads/2025/09/NB_Logo.svg', '#002D72', '#009DD9', '#001639')`, '23. INSERT branding_config');
  
  // Final verification
  console.log('\n=== FINAL VERIFICATION ===');
  
  const nbTables = await sql(DB, "SHOW TABLES LIKE '%'", 'All tables');
  
  // Filter for our NB tables
  const allTables = nbTables.result?.rows || [];
  const key = Object.keys(allTables[0] || {})[0];
  const nbOnly = allTables.filter(t => {
    const name = t[key];
    return ['organizations', 'facilities', 'cameras', 'production_lines', 'production_logs', 'zones', 
            'employees', 'iot_devices', 'incidents', 'alerts', 'forklifts', 'time_entries', 'chat_history',
            'audit_log', 'ai_events', 'branding_config', 'user_sessions', 'nb_roles', 'nb_users'].includes(name);
  });
  console.log(`\nNational Beef tables found: ${nbOnly.length}`);
  nbOnly.forEach(t => console.log(`  ✅ ${t[key]}`));
  
  // Verify data
  console.log('\n=== Verify Seed Data ===');
  await sql(DB, 'SELECT * FROM organizations', 'Organizations data');
  await sql(DB, 'SELECT * FROM facilities', 'Facilities data');
  await sql(DB, `SELECT id, name, description FROM ${prefix}roles`, `${prefix}Roles data`);
  await sql(DB, 'SELECT * FROM branding_config', 'Branding data');
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
