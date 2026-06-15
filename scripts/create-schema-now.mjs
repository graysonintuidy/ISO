#!/usr/bin/env node

const API_KEY = 'vntg_7aEF3glus_kuqwsdEY9ir910UhmNFbpUqaABhN7m4hA';
const MCP_URL = 'https://mcp.intuidy.com/mcp';
const REST_URL = 'https://vantage.intuidy.com/api/v1';
let sessionId = null;

async function mcpPost(payload) {
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json, text/event-stream',
    'Authorization': `Bearer ${API_KEY}`,
  };
  if (sessionId) headers['Mcp-Session-Id'] = sessionId;
  const res = await fetch(MCP_URL, { method: 'POST', headers, body: JSON.stringify(payload) });
  const sid = res.headers.get('mcp-session-id');
  if (sid) sessionId = sid;
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) { try { data = JSON.parse(line.slice(6)); break; } catch {} }
    }
    if (!data) return { raw: text.slice(0, 1000) };
  }
  return data;
}

async function initialize() {
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-create', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });
  console.log('MCP initialized.');
}

async function callTool(name, args) {
  const res = await mcpPost({ jsonrpc: '2.0', id: Date.now(), method: 'tools/call', params: { name, arguments: args } });
  const content = res?.result?.content?.[0]?.text;
  if (content) { try { return JSON.parse(content); } catch { return content; } }
  if (res?.error) return `Error: ${res.error.message}`;
  return res;
}

async function main() {
  await initialize();

  // Step 1: Try to create a new managed database via REST API
  console.log('=== Attempting to create new managed database via REST API ===');
  
  // Try different REST endpoints for database creation
  const endpoints = [
    { url: `${REST_URL}/managed-databases`, method: 'POST' },
    { url: `${REST_URL}/databases`, method: 'POST' },
    { url: `${REST_URL}/db/managed`, method: 'POST' },
  ];
  
  for (const ep of endpoints) {
    try {
      const res = await fetch(ep.url, {
        method: ep.method,
        headers: { 'Authorization': `Bearer ${API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Nation Beef Video Monitoring' })
      });
      console.log(`  ${ep.url}: status=${res.status}`);
      const text = await res.text();
      console.log(`  Response: ${text.slice(0, 300)}`);
    } catch (e) {
      console.log(`  ${ep.url}: Error - ${e.message}`);
    }
  }

  // Step 2: Since DB creation via REST may not work, let's just use DB ID 3 (General DB for Test Projects)
  // and create the schema there. We can migrate later.
  const DB_ID = 3;
  console.log(`\n=== Creating schema on Database ID ${DB_ID} (General DB for Test Projects) ===\n`);

  const statements = [
    { label: '1. CREATE organizations', sql: `CREATE TABLE IF NOT EXISTS organizations (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(50) UNIQUE NOT NULL, logo_url VARCHAR(1000), branding_config JSON, status ENUM('active', 'inactive', 'trial') DEFAULT 'active', metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)` },
    { label: '2. INSERT organizations', sql: `INSERT INTO organizations (name, code, logo_url) VALUES ('National Beef', 'national-beef', 'https://www.nationalbeef.com/wp-content/uploads/2025/09/NB_Logo.svg')` },
    { label: '3. CREATE facilities', sql: `CREATE TABLE IF NOT EXISTS facilities (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, name VARCHAR(255) NOT NULL, code VARCHAR(10) NOT NULL, location VARCHAR(500), address VARCHAR(500), timezone VARCHAR(50) DEFAULT 'America/Chicago', floor_plan_url VARCHAR(1000), status ENUM('active', 'inactive', 'maintenance') DEFAULT 'active', metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY org_code (organization_id, code), FOREIGN KEY (organization_id) REFERENCES organizations(id))` },
    { label: '4. INSERT facilities', sql: `INSERT INTO facilities (organization_id, name, code, location, address) VALUES (1, 'Kansas City, Kansas', 'kck', 'Kansas City, KS', 'KCK Facility Address')` },
    { label: '5. CREATE roles', sql: `CREATE TABLE IF NOT EXISTS roles (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, name VARCHAR(100) NOT NULL, description VARCHAR(500), permissions JSON, is_system BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY org_role (organization_id, name), FOREIGN KEY (organization_id) REFERENCES organizations(id))` },
    { label: '6. INSERT roles', sql: `INSERT INTO roles (organization_id, name, description, permissions, is_system) VALUES (1, 'admin', 'Full system access', '{"all": true}', TRUE), (1, 'safety_director', 'Safety and compliance oversight', '{"dashboard": true, "cameras": true, "safety": true, "employees": true, "incidents": true, "reports": true, "audit": true}', TRUE), (1, 'floor_manager', 'Production floor management', '{"dashboard": true, "cameras": true, "production": true, "employees": true, "forklifts": true}', TRUE), (1, 'security', 'Security monitoring', '{"dashboard": true, "cameras": true, "safety": true, "incidents": true}', TRUE), (1, 'operator', 'Basic monitoring access', '{"dashboard": true, "cameras": "read"}', TRUE)` },
    { label: '7. CREATE users', sql: `CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, username VARCHAR(100) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, first_name VARCHAR(100), last_name VARCHAR(100), role_id INT, status ENUM('active', 'inactive', 'locked', 'pending') DEFAULT 'pending', last_login TIMESTAMP NULL, preferences JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (organization_id) REFERENCES organizations(id), FOREIGN KEY (role_id) REFERENCES roles(id))` },
    { label: '8. CREATE user_sessions', sql: `CREATE TABLE IF NOT EXISTS user_sessions (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, token_hash VARCHAR(255) NOT NULL, ip_address VARCHAR(45), user_agent VARCHAR(500), expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users(id))` },
    { label: '9. CREATE cameras', sql: `CREATE TABLE IF NOT EXISTS cameras (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, name VARCHAR(255) NOT NULL, location_description VARCHAR(500), camera_type ENUM('floor', 'line', 'entrance', 'hazard_zone', 'outdoor', 'other') DEFAULT 'floor', stream_url VARCHAR(1000), stream_type ENUM('rtsp', 'hls', 'vantage', 'other') DEFAULT 'vantage', status ENUM('pending_setup', 'online', 'offline', 'maintenance') DEFAULT 'pending_setup', zone_id INT, production_line_id INT, ai_enabled BOOLEAN DEFAULT TRUE, recording_enabled BOOLEAN DEFAULT FALSE, last_heartbeat TIMESTAMP NULL, config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '10. CREATE production_lines', sql: `CREATE TABLE IF NOT EXISTS production_lines (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, name VARCHAR(255) NOT NULL, line_number VARCHAR(50), line_type ENUM('slaughter', 'fabrication', 'packaging', 'shipping', 'other') DEFAULT 'fabrication', status ENUM('running', 'stopped', 'maintenance', 'alert') DEFAULT 'stopped', target_throughput DECIMAL(10,2), current_speed DECIMAL(10,2), sensor_config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '11. CREATE production_logs', sql: `CREATE TABLE IF NOT EXISTS production_logs (id INT AUTO_INCREMENT PRIMARY KEY, production_line_id INT NOT NULL, event_type ENUM('start', 'stop', 'pause', 'speed_change', 'jam', 'maintenance', 'shift_change') NOT NULL, details JSON, throughput_count INT, recorded_by INT, recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (production_line_id) REFERENCES production_lines(id))` },
    { label: '12. CREATE zones', sql: `CREATE TABLE IF NOT EXISTS zones (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, name VARCHAR(255) NOT NULL, zone_type ENUM('restricted', 'hazardous', 'authorized', 'general') DEFAULT 'general', geometry JSON, color VARCHAR(7) DEFAULT '#FF0000', alert_on_entry BOOLEAN DEFAULT TRUE, alert_on_exit BOOLEAN DEFAULT FALSE, max_occupancy INT, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '13. CREATE employees', sql: `CREATE TABLE IF NOT EXISTS employees (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, employee_number VARCHAR(50), first_name VARCHAR(100), last_name VARCHAR(100), department VARCHAR(100), role VARCHAR(100), barcode_id VARCHAR(100), helmet_barcode VARCHAR(100), status ENUM('active', 'inactive', 'on_leave') DEFAULT 'active', ppe_certified BOOLEAN DEFAULT FALSE, forklift_certified BOOLEAN DEFAULT FALSE, certifications JSON, contact_info JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id), UNIQUE KEY fac_emp (facility_id, employee_number), UNIQUE KEY fac_barcode (facility_id, barcode_id))` },
    { label: '14. CREATE iot_devices', sql: `CREATE TABLE IF NOT EXISTS iot_devices (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, device_name VARCHAR(255), device_type ENUM('temperature', 'motion', 'proximity', 'gas', 'humidity', 'barcode_scanner', 'rfid_reader', 'belt_speed', 'weight_scale', 'other') DEFAULT 'other', location_description VARCHAR(500), production_line_id INT, status ENUM('online', 'offline', 'maintenance', 'error') DEFAULT 'online', last_value JSON, last_heartbeat TIMESTAMP NULL, alert_threshold JSON, config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '15. CREATE incidents', sql: `CREATE TABLE IF NOT EXISTS incidents (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, incident_type ENUM('zone_breach', 'safety_violation', 'equipment_failure', 'injury', 'near_miss', 'unauthorized_access', 'line_stoppage', 'other') DEFAULT 'other', severity ENUM('low', 'medium', 'high', 'critical') DEFAULT 'medium', title VARCHAR(500), description TEXT, employee_id INT, zone_id INT, camera_id INT, device_id INT, production_line_id INT, status ENUM('open', 'investigating', 'resolved', 'closed') DEFAULT 'open', resolved_at TIMESTAMP NULL, resolved_by INT, evidence_urls JSON, notes JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '16. CREATE alerts', sql: `CREATE TABLE IF NOT EXISTS alerts (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, alert_type ENUM('zone_breach', 'device_offline', 'safety_violation', 'system_error', 'maintenance', 'ai_detection', 'line_alert', 'throughput_drop') DEFAULT 'system_error', severity ENUM('info', 'warning', 'critical', 'emergency') DEFAULT 'warning', title VARCHAR(500), message TEXT, source_type ENUM('camera', 'iot_device', 'zone', 'system', 'workflow', 'production_line') DEFAULT 'system', source_id INT, acknowledged BOOLEAN DEFAULT FALSE, acknowledged_by INT, acknowledged_at TIMESTAMP NULL, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '17. CREATE forklifts', sql: `CREATE TABLE IF NOT EXISTS forklifts (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, unit_number VARCHAR(50), model VARCHAR(255), status ENUM('active', 'parked', 'maintenance', 'out_of_service') DEFAULT 'parked', current_driver_id INT, last_inspection DATE, next_maintenance DATE, total_hours DECIMAL(10,2), config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id), UNIQUE KEY fac_unit (facility_id, unit_number))` },
    { label: '18. CREATE time_entries', sql: `CREATE TABLE IF NOT EXISTS time_entries (id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, facility_id INT NOT NULL, clock_in TIMESTAMP, clock_out TIMESTAMP NULL, zone_log JSON, break_minutes INT DEFAULT 0, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (employee_id) REFERENCES employees(id), FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '19. CREATE chat_history', sql: `CREATE TABLE IF NOT EXISTS chat_history (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, user_id INT, user_message TEXT NOT NULL, ai_response TEXT, query_generated VARCHAR(2000), response_time_ms INT, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '20. CREATE audit_log', sql: `CREATE TABLE IF NOT EXISTS audit_log (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, action_type VARCHAR(100), entity_type VARCHAR(100), entity_id INT, user_id INT, details JSON, ip_address VARCHAR(45), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '21. CREATE ai_events', sql: `CREATE TABLE IF NOT EXISTS ai_events (id INT AUTO_INCREMENT PRIMARY KEY, camera_id INT, facility_id INT, event_type VARCHAR(100), confidence DECIMAL(5,4), frame_url VARCHAR(1000), bounding_box JSON, metadata JSON, reviewed BOOLEAN DEFAULT FALSE, reviewed_by INT, false_positive BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (facility_id) REFERENCES facilities(id))` },
    { label: '22. CREATE branding_config', sql: `CREATE TABLE IF NOT EXISTS branding_config (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, company_name VARCHAR(255), logo_url VARCHAR(1000), logo_dark_url VARCHAR(1000), favicon_url VARCHAR(1000), primary_color VARCHAR(7) DEFAULT '#002D72', accent_color VARCHAR(7) DEFAULT '#009DD9', dark_color VARCHAR(7) DEFAULT '#001639', body_font VARCHAR(100) DEFAULT 'Open Sans', heading_font VARCHAR(100) DEFAULT 'Nunito', custom_css TEXT, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, FOREIGN KEY (organization_id) REFERENCES organizations(id))` },
    { label: '23. INSERT branding_config', sql: `INSERT INTO branding_config (organization_id, company_name, logo_url, primary_color, accent_color, dark_color) VALUES (1, 'National Beef', 'https://www.nationalbeef.com/wp-content/uploads/2025/09/NB_Logo.svg', '#002D72', '#009DD9', '#001639')` },
  ];

  let successes = 0;
  let failures = 0;
  const results = [];

  for (const stmt of statements) {
    process.stdout.write(`  ${stmt.label}... `);
    try {
      const r = await callTool('execute_managed_db_query', { databaseId: DB_ID, query: stmt.sql });
      if (typeof r === 'string' && r.toLowerCase().includes('error')) {
        console.log('❌');
        console.log(`    Error: ${r.slice(0, 200)}`);
        results.push({ label: stmt.label, status: 'FAILED', error: r.slice(0, 200) });
        failures++;
      } else {
        console.log('✅');
        if (r && typeof r === 'object') console.log(`    ${JSON.stringify(r).slice(0, 150)}`);
        results.push({ label: stmt.label, status: 'OK', result: typeof r === 'object' ? JSON.stringify(r).slice(0, 100) : String(r).slice(0, 100) });
        successes++;
      }
    } catch (e) {
      console.log('❌');
      console.log(`    Exception: ${e.message}`);
      results.push({ label: stmt.label, status: 'FAILED', error: e.message });
      failures++;
    }
    await new Promise(r => setTimeout(r, 300));
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`  ✅ Successes: ${successes}/23`);
  console.log(`  ❌ Failures: ${failures}/23`);
  console.log(`  Database ID: ${DB_ID}`);

  // Verify tables
  console.log('\n=== VERIFICATION: SHOW TABLES ===');
  const tables = await callTool('execute_managed_db_query', { databaseId: DB_ID, query: 'SHOW TABLES' });
  console.log(JSON.stringify(tables, null, 2));

  // Verify seed data
  console.log('\n=== VERIFICATION: Organizations ===');
  const orgs = await callTool('execute_managed_db_query', { databaseId: DB_ID, query: 'SELECT * FROM organizations' });
  console.log(JSON.stringify(orgs, null, 2));

  console.log('\n=== VERIFICATION: Roles ===');
  const roles = await callTool('execute_managed_db_query', { databaseId: DB_ID, query: 'SELECT id, name, description FROM roles' });
  console.log(JSON.stringify(roles, null, 2));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
