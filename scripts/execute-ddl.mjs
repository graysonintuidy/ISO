const API_KEY = 'vntg_I8B07QTVVff24CXHEvE_UGg1GBIkkbWFxu-nojD3JuU';
const MCP_URL = 'https://mcp.intuidy.com/mcp';
const DB_ID = 10;
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

const TABLES = [
  ["organizations", "CREATE TABLE IF NOT EXISTS organizations (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(50) UNIQUE NOT NULL, logo_url VARCHAR(1000), branding_config JSON, status ENUM('active','inactive','trial') DEFAULT 'active', metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"],
  ["facilities", "CREATE TABLE IF NOT EXISTS facilities (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, name VARCHAR(255) NOT NULL, code VARCHAR(10) NOT NULL, location VARCHAR(500), address VARCHAR(500), timezone VARCHAR(50) DEFAULT 'America/Chicago', floor_plan_url VARCHAR(1000), status ENUM('active','inactive','maintenance') DEFAULT 'active', metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, UNIQUE KEY org_code (organization_id, code))"],
  ["roles", "CREATE TABLE IF NOT EXISTS roles (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, name VARCHAR(100) NOT NULL, description VARCHAR(500), permissions JSON, is_system BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, UNIQUE KEY org_role (organization_id, name))"],
  ["users", "CREATE TABLE IF NOT EXISTS users (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, username VARCHAR(100) UNIQUE NOT NULL, email VARCHAR(255) UNIQUE NOT NULL, password_hash VARCHAR(255) NOT NULL, first_name VARCHAR(100), last_name VARCHAR(100), role_id INT, status ENUM('active','inactive','locked','pending') DEFAULT 'pending', last_login TIMESTAMP NULL, preferences JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"],
  ["user_sessions", "CREATE TABLE IF NOT EXISTS user_sessions (id INT AUTO_INCREMENT PRIMARY KEY, user_id INT NOT NULL, token_hash VARCHAR(255) NOT NULL, ip_address VARCHAR(45), user_agent VARCHAR(500), expires_at TIMESTAMP NOT NULL, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"],
  ["cameras", "CREATE TABLE IF NOT EXISTS cameras (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, name VARCHAR(255) NOT NULL, location_description VARCHAR(500), camera_type ENUM('floor','line','entrance','hazard_zone','outdoor','other') DEFAULT 'floor', stream_url VARCHAR(1000), stream_type ENUM('rtsp','hls','vantage','other') DEFAULT 'vantage', status ENUM('pending_setup','online','offline','maintenance') DEFAULT 'pending_setup', zone_id INT, production_line_id INT, ai_enabled BOOLEAN DEFAULT TRUE, recording_enabled BOOLEAN DEFAULT FALSE, last_heartbeat TIMESTAMP NULL, config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"],
  ["production_lines", "CREATE TABLE IF NOT EXISTS production_lines (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, name VARCHAR(255) NOT NULL, line_number VARCHAR(50), line_type ENUM('slaughter','fabrication','packaging','shipping','other') DEFAULT 'fabrication', status ENUM('running','stopped','maintenance','alert') DEFAULT 'stopped', target_throughput DECIMAL(10,2), current_speed DECIMAL(10,2), sensor_config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"],
  ["production_logs", "CREATE TABLE IF NOT EXISTS production_logs (id INT AUTO_INCREMENT PRIMARY KEY, production_line_id INT NOT NULL, event_type ENUM('start','stop','pause','speed_change','jam','maintenance','shift_change') NOT NULL, details JSON, throughput_count INT, recorded_by INT, recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"],
  ["zones", "CREATE TABLE IF NOT EXISTS zones (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, name VARCHAR(255) NOT NULL, zone_type ENUM('restricted','hazardous','authorized','general') DEFAULT 'general', geometry JSON, color VARCHAR(7) DEFAULT '#FF0000', alert_on_entry BOOLEAN DEFAULT TRUE, alert_on_exit BOOLEAN DEFAULT FALSE, max_occupancy INT, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"],
  ["employees", "CREATE TABLE IF NOT EXISTS employees (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, employee_number VARCHAR(50), first_name VARCHAR(100), last_name VARCHAR(100), department VARCHAR(100), role VARCHAR(100), barcode_id VARCHAR(100), helmet_barcode VARCHAR(100), status ENUM('active','inactive','on_leave') DEFAULT 'active', ppe_certified BOOLEAN DEFAULT FALSE, forklift_certified BOOLEAN DEFAULT FALSE, certifications JSON, contact_info JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"],
  ["iot_devices", "CREATE TABLE IF NOT EXISTS iot_devices (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, device_name VARCHAR(255), device_type ENUM('temperature','motion','proximity','gas','humidity','barcode_scanner','rfid_reader','belt_speed','weight_scale','other') DEFAULT 'other', location_description VARCHAR(500), production_line_id INT, status ENUM('online','offline','maintenance','error') DEFAULT 'online', last_value JSON, last_heartbeat TIMESTAMP NULL, alert_threshold JSON, config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"],
  ["incidents", "CREATE TABLE IF NOT EXISTS incidents (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, incident_type ENUM('zone_breach','safety_violation','equipment_failure','injury','near_miss','unauthorized_access','line_stoppage','other') DEFAULT 'other', severity ENUM('low','medium','high','critical') DEFAULT 'medium', title VARCHAR(500), description TEXT, employee_id INT, zone_id INT, camera_id INT, device_id INT, production_line_id INT, status ENUM('open','investigating','resolved','closed') DEFAULT 'open', resolved_at TIMESTAMP NULL, resolved_by INT, evidence_urls JSON, notes JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"],
  ["alerts", "CREATE TABLE IF NOT EXISTS alerts (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, alert_type ENUM('zone_breach','device_offline','safety_violation','system_error','maintenance','ai_detection','line_alert','throughput_drop') DEFAULT 'system_error', severity ENUM('info','warning','critical','emergency') DEFAULT 'warning', title VARCHAR(500), message TEXT, source_type ENUM('camera','iot_device','zone','system','workflow','production_line') DEFAULT 'system', source_id INT, acknowledged BOOLEAN DEFAULT FALSE, acknowledged_by INT, acknowledged_at TIMESTAMP NULL, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"],
  ["forklifts", "CREATE TABLE IF NOT EXISTS forklifts (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, unit_number VARCHAR(50), model VARCHAR(255), status ENUM('active','parked','maintenance','out_of_service') DEFAULT 'parked', current_driver_id INT, last_inspection DATE, next_maintenance DATE, total_hours DECIMAL(10,2), config JSON, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"],
  ["time_entries", "CREATE TABLE IF NOT EXISTS time_entries (id INT AUTO_INCREMENT PRIMARY KEY, employee_id INT NOT NULL, facility_id INT NOT NULL, clock_in TIMESTAMP, clock_out TIMESTAMP NULL, zone_log JSON, break_minutes INT DEFAULT 0, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"],
  ["chat_history", "CREATE TABLE IF NOT EXISTS chat_history (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, user_id INT, user_message TEXT NOT NULL, ai_response TEXT, query_generated VARCHAR(2000), response_time_ms INT, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"],
  ["audit_log", "CREATE TABLE IF NOT EXISTS audit_log (id INT AUTO_INCREMENT PRIMARY KEY, facility_id INT NOT NULL, action_type VARCHAR(100), entity_type VARCHAR(100), entity_id INT, user_id INT, details JSON, ip_address VARCHAR(45), created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"],
  ["ai_events", "CREATE TABLE IF NOT EXISTS ai_events (id INT AUTO_INCREMENT PRIMARY KEY, camera_id INT, facility_id INT, event_type VARCHAR(100), confidence DECIMAL(5,4), frame_url VARCHAR(1000), bounding_box JSON, metadata JSON, reviewed BOOLEAN DEFAULT FALSE, reviewed_by INT, false_positive BOOLEAN DEFAULT FALSE, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)"],
  ["branding_config", "CREATE TABLE IF NOT EXISTS branding_config (id INT AUTO_INCREMENT PRIMARY KEY, organization_id INT NOT NULL, company_name VARCHAR(255), logo_url VARCHAR(1000), logo_dark_url VARCHAR(1000), favicon_url VARCHAR(1000), primary_color VARCHAR(7) DEFAULT '#002D72', accent_color VARCHAR(7) DEFAULT '#009DD9', dark_color VARCHAR(7) DEFAULT '#001639', body_font VARCHAR(100) DEFAULT 'Open Sans', heading_font VARCHAR(100) DEFAULT 'Nunito', custom_css TEXT, metadata JSON, created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)"],
];

async function main() {
  await mcpPost({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'nb-ddl', version: '1.0.0' } } });
  await mcpPost({ jsonrpc: '2.0', method: 'notifications/initialized' });

  // For each table: update workflow with DDL, execute it
  let ok = 0, fail = 0;
  for (const [name, ddl] of TABLES) {
    process.stdout.write(`  CREATE ${name}... `);
    
    // Update workflow with this specific DDL
    const upd = await callTool('update_workflow', {
      workflowId: WF_ID,
      nodes: [
        { node_type: 'managed_db_query', node_role: 'getter', label: `Create ${name}`, config: { databaseId: DB_ID, query: ddl } }
      ],
      edges: []
    });
    
    if (typeof upd === 'string' && upd.includes('error')) {
      console.log('❌ Update failed: ' + upd.slice(0, 200));
      fail++;
      continue;
    }

    // Execute
    const exec = await callTool('execute_workflow', { workflowId: WF_ID, output_node_id: 0 });
    if (typeof exec === 'string' && exec.toLowerCase().includes('error')) {
      console.log('❌ ' + exec.slice(0, 200));
      fail++;
    } else {
      console.log('✅');
      ok++;
    }
    await new Promise(r => setTimeout(r, 500));
  }

  console.log(`\n=== Summary: ${ok} ✅ / ${fail} ❌ ===`);
  
  // Verify
  const tables = await callTool('execute_managed_db_query', { databaseId: DB_ID, query: 'SHOW TABLES' });
  console.log('\nTables:', JSON.stringify(tables));
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
