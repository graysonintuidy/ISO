#!/usr/bin/env node

/**
 * seed-mock-data.mjs
 * Populates the National Beef Video Monitor MySQL database with realistic mock data.
 * Uses the same MCP protocol pattern as setup-schema.mjs.
 *
 * All seeded records include metadata = '{"seed": true}' (where the table has a metadata column)
 * so they can be identified and deleted later.
 *
 * Usage:  node scripts/seed-mock-data.mjs
 */

// ─── MCP Connection ──────────────────────────────────────────────────────────

const API_KEY = 'vntg_I8B07QTVVff24CXHEvE_UGg1GBIkkbWFxu-nojD3JuU';
const MCP_URL = 'https://mcp.intuidy.com/mcp';
const DB_ID = 10;

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
  try {
    data = JSON.parse(text);
  } catch {
    const lines = text.split('\n');
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try {
          data = JSON.parse(line.slice(6));
          break;
        } catch {}
      }
    }
    if (!data) return { raw: text.slice(0, 1000) };
  }
  return data;
}

async function initialize() {
  console.log('=== Initializing MCP session ===');
  const initRes = await mcpPost({
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'national-beef-seed', version: '1.0.0' },
    },
  });
  console.log('Session ID:', sessionId);
  console.log('Server info:', JSON.stringify(initRes?.result?.serverInfo || 'no info', null, 2));

  await mcpPost({
    jsonrpc: '2.0',
    method: 'notifications/initialized',
  });
  console.log('Session initialized!\n');
}

async function callTool(name, args) {
  const res = await mcpPost({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: { name, arguments: args },
  });

  const content = res?.result?.content?.[0]?.text;
  if (content) {
    try { return JSON.parse(content); } catch { return content; }
  }
  if (res?.error) return `Error: ${res.error.message}`;
  return res;
}

// ─── SQL Helper ──────────────────────────────────────────────────────────────

const DELAY_MS = 200;
let totalSuccess = 0;
let totalFail = 0;

async function sql(query, label) {
  process.stdout.write(`  ${label}... `);
  try {
    const r = await callTool('execute_managed_db_query', { databaseId: DB_ID, query });
    if (typeof r === 'string' && r.toLowerCase().includes('error')) {
      console.log('❌');
      console.log(`    Error: ${r.slice(0, 300)}`);
      totalFail++;
      return false;
    }
    console.log('✅');
    totalSuccess++;
    return true;
  } catch (e) {
    console.log('❌');
    console.log(`    Exception: ${e.message}`);
    totalFail++;
    return false;
  }
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms || DELAY_MS));
}

/** Escape a string for use inside a SQL single-quoted literal */
function esc(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

/** Serialize an object to a SQL-safe JSON string literal */
function jsonStr(obj) {
  if (obj === null || obj === undefined) return 'NULL';
  return esc(JSON.stringify(obj));
}

/** Merge seed:true into a metadata object */
function seedMeta(extra) {
  return jsonStr({ seed: true, ...(extra || {}) });
}

// ─── Relative timestamps (past 7 days) ──────────────────────────────────────

function daysAgo(d, h = 0, m = 0) {
  const dt = new Date();
  dt.setDate(dt.getDate() - d);
  dt.setHours(h, m, 0, 0);
  return dt.toISOString().slice(0, 19).replace('T', ' ');
}

function hoursAgo(h) {
  const dt = new Date(Date.now() - h * 3600000);
  return dt.toISOString().slice(0, 19).replace('T', ' ');
}

function minutesAgo(m) {
  const dt = new Date(Date.now() - m * 60000);
  return dt.toISOString().slice(0, 19).replace('T', ' ');
}

function now() {
  return new Date().toISOString().slice(0, 19).replace('T', ' ');
}

// ─────────────────────────────────────────────────────────────────────────────
// DATA DEFINITIONS
// ─────────────────────────────────────────────────────────────────────────────

// ── 1. Cameras ───────────────────────────────────────────────────────────────

function getCameraInserts() {
  const stmts = [];

  // 16 cameras from demoCameraFeeds.js
  const feeds = [
    { id: 'demo-1',  name: 'Warehouse Floor A',      loc: 'Main Warehouse — Aisle 3-4',            zone: 'Floor',       image: '/camera-feeds/cam-01.png' },
    { id: 'demo-2',  name: 'Hallway B Corridor',      loc: 'Processing Wing — Corridor B',           zone: 'Floor',       image: '/camera-feeds/cam-02.png' },
    { id: 'demo-3',  name: 'Production Line 1',       loc: 'Main Floor — Line 1',                    zone: 'Line',        image: '/camera-feeds/cam-03.png' },
    { id: 'demo-4',  name: 'Loading Dock East',       loc: 'East Dock — Bays 1-3',                   zone: 'Entrance',    image: '/camera-feeds/cam-04.png' },
    { id: 'demo-5',  name: 'Cold Storage Room',       loc: 'Cold Storage — Section A',                zone: 'Hazard Zone', image: '/camera-feeds/cam-05.png' },
    { id: 'demo-6',  name: 'Main Entrance Gate',      loc: 'Facility Entrance — Gate 1',              zone: 'Entrance',    image: '/camera-feeds/cam-06.png' },
    { id: 'demo-7',  name: 'Packaging Area',          loc: 'Packaging Wing — Stations 1-8',           zone: 'Line',        image: '/camera-feeds/cam-07.png' },
    { id: 'demo-8',  name: 'Conveyor Output',         loc: 'Automation Bay — Output Belt',             zone: 'Line',        image: '/camera-feeds/cam-08.png' },
    { id: 'demo-9',  name: 'Parking Lot',             loc: 'Exterior — Employee Parking',              zone: 'Entrance',    image: '/camera-feeds/cam-09.png' },
    { id: 'demo-10', name: 'Hazard Zone North',       loc: 'Heavy Machinery — Zone N',                zone: 'Hazard Zone', image: '/camera-feeds/cam-10.png' },
    { id: 'demo-11', name: 'Factory Floor Overview',  loc: 'Main Floor — Ceiling Mount',              zone: 'Floor',       image: '/camera-feeds/cam-11.png' },
    { id: 'demo-12', name: 'Maintenance Bay',         loc: 'Maintenance — Workshop',                  zone: 'Floor',       image: '/camera-feeds/cam-12.png' },
    { id: 'demo-13', name: 'Receiving Dock West',     loc: 'West Dock — Receiving',                   zone: 'Entrance',    image: '/camera-feeds/cam-13.png' },
    { id: 'demo-14', name: 'Quality Control Lab',     loc: 'QC Lab — Room 104',                       zone: 'Floor',       image: '/camera-feeds/cam-14.png' },
    { id: 'demo-15', name: 'Break Room',              loc: 'Employee Break Room — B Wing',             zone: 'Floor',       image: '/camera-feeds/cam-15.png' },
    { id: 'demo-16', name: 'Exterior Building',       loc: 'Facility Exterior — Gate Cam',             zone: 'Entrance',    image: '/camera-feeds/cam-16.png' },
  ];

  const zoneMap = { Floor: 'floor', Line: 'line', Entrance: 'entrance', 'Hazard Zone': 'hazard_zone' };

  for (let i = 0; i < feeds.length; i++) {
    const f = feeds[i];
    const camType = zoneMap[f.zone] || 'floor';
    const config = { image: f.image };
    stmts.push({
      label: `Camera ${i + 1}/25 — ${f.name}`,
      sql: `INSERT INTO cameras (facility_id, name, location_description, camera_type, status, ai_enabled, recording_enabled, config, metadata)
VALUES (1, ${esc(f.name)}, ${esc(f.loc)}, '${camType}', 'online', FALSE, FALSE, ${jsonStr(config)}, ${seedMeta()})`,
    });
  }

  // 9 cameras from demoProductionCameras.js
  const prodCams = [
    { name: 'Line 1 — Intake Belt',      loc: 'Ground Beef Processing — Intake Section',  aiStatus: 'alert',    aiConf: 97.2, det: 2, image: '/camera-feeds/cam-03.png', line: 'Line 1', lineNumber: 1, events: [{id:'evt-1a',timestamp:'2026-06-15T17:28:14Z',type:'foreign_object',severity:'critical',object:'Metal Fragment',confidence:97.2,action:'Line paused — awaiting inspection',resolved:false},{id:'evt-1b',timestamp:'2026-06-15T17:25:03Z',type:'foreign_object',severity:'warning',object:'Plastic Shard',confidence:89.1,action:'Flagged for review',resolved:false},{id:'evt-1c',timestamp:'2026-06-15T16:45:22Z',type:'foreign_object',severity:'warning',object:'Rubber Piece',confidence:82.3,action:'Removed by operator',resolved:true}] },
    { name: 'Line 1 — Grinder Output',   loc: 'Ground Beef Processing — Grinder Station', aiStatus: 'clear',    aiConf: 99.8, det: 0, image: '/camera-feeds/cam-07.png', line: 'Line 1', lineNumber: 1, events: [] },
    { name: 'Line 2 — Trim Sort',        loc: 'Trim Processing — Sorting Conveyor',       aiStatus: 'clear',    aiConf: 99.4, det: 0, image: '/camera-feeds/cam-08.png', line: 'Line 2', lineNumber: 2, events: [{id:'evt-3a',timestamp:'2026-06-15T14:12:08Z',type:'foreign_object',severity:'info',object:'Cardboard Fragment',confidence:76.5,action:'Auto-cleared — below threshold',resolved:true}] },
    { name: 'Line 2 — Packaging Feed',   loc: 'Trim Processing — Pre-Package Belt',       aiStatus: 'warning',  aiConf: 91.3, det: 1, image: '/camera-feeds/cam-01.png', line: 'Line 2', lineNumber: 2, events: [{id:'evt-4a',timestamp:'2026-06-15T17:15:42Z',type:'foreign_object',severity:'warning',object:'Bone Fragment',confidence:91.3,action:'Operator notified',resolved:false},{id:'evt-4b',timestamp:'2026-06-15T15:30:11Z',type:'foreign_object',severity:'info',object:'Fat Clump (false positive)',confidence:62.1,action:'Auto-dismissed',resolved:true}] },
    { name: 'Line 3 — Chuck Conveyor',   loc: 'Chuck Processing — Main Belt',             aiStatus: 'clear',    aiConf: 99.9, det: 0, image: '/camera-feeds/cam-05.png', line: 'Line 3', lineNumber: 3, events: [] },
    { name: 'Line 3 — Vacuum Pack',      loc: 'Chuck Processing — Vacuum Seal Station',   aiStatus: 'offline',  aiConf: 0,    det: 0, image: null,                       line: 'Line 3', lineNumber: 3, events: [] },
    { name: 'Line 4 — Rib Eye Sort',     loc: 'Rib Eye Processing — Sorting Area',        aiStatus: 'clear',    aiConf: 98.7, det: 0, image: '/camera-feeds/cam-11.png', line: 'Line 4', lineNumber: 4, events: [{id:'evt-7a',timestamp:'2026-06-15T11:05:33Z',type:'foreign_object',severity:'warning',object:'Glove Fragment',confidence:88.4,action:'Removed by operator',resolved:true}] },
    { name: 'Line 4 — Final Inspection', loc: 'Rib Eye Processing — QC Belt',             aiStatus: 'critical', aiConf: 98.9, det: 3, image: '/camera-feeds/cam-12.png', line: 'Line 4', lineNumber: 4, events: [{id:'evt-8a',timestamp:'2026-06-15T17:31:02Z',type:'foreign_object',severity:'critical',object:'Wire Fragment',confidence:98.9,action:'LINE STOPPED — Emergency halt',resolved:false},{id:'evt-8b',timestamp:'2026-06-15T17:30:45Z',type:'foreign_object',severity:'critical',object:'Metal Shaving',confidence:96.1,action:'LINE STOPPED — Emergency halt',resolved:false},{id:'evt-8c',timestamp:'2026-06-15T17:29:58Z',type:'foreign_object',severity:'warning',object:'Unknown Debris',confidence:84.7,action:'Flagged for review',resolved:false}] },
    { name: 'Line 5 — Patty Former',     loc: 'Patty Line — Former Output',               aiStatus: 'clear',    aiConf: 99.6, det: 0, image: '/camera-feeds/cam-14.png', line: 'Line 5', lineNumber: 5, events: [] },
  ];

  for (let i = 0; i < prodCams.length; i++) {
    const c = prodCams[i];
    const status = c.aiStatus === 'offline' ? 'offline' : 'online';
    const config = {
      image: c.image,
      aiStatus: c.aiStatus,
      aiConfidence: c.aiConf,
      detections: c.det,
      cameraType: 'AI Vision — Top-Down',
      line: c.line,
      lineNumber: c.lineNumber,
    };
    const meta = { seed: true, events: c.events };
    stmts.push({
      label: `Camera ${16 + i + 1}/25 — ${c.name}`,
      sql: `INSERT INTO cameras (facility_id, name, location_description, camera_type, status, ai_enabled, recording_enabled, config, metadata)
VALUES (1, ${esc(c.name)}, ${esc(c.loc)}, 'line', '${status}', TRUE, FALSE, ${jsonStr(config)}, ${jsonStr(meta)})`,
    });
  }

  return stmts;
}

// ── 2. Production Lines ──────────────────────────────────────────────────────

function getProductionLineInserts() {
  const lines = [
    { name: 'Production Line 1', num: '1', type: 'slaughter',    status: 'running',     target: 240, speed: 232 },
    { name: 'Production Line 2', num: '2', type: 'fabrication',  status: 'running',     target: 180, speed: 175 },
    { name: 'Production Line 3', num: '3', type: 'packaging',    status: 'running',     target: 320, speed: 298 },
    { name: 'Production Line 4', num: '4', type: 'fabrication',  status: 'maintenance', target: 200, speed: 0   },
    { name: 'Production Line 5', num: '5', type: 'shipping',     status: 'running',     target: 150, speed: 142 },
  ];
  return lines.map((l, i) => ({
    label: `Production Line ${i + 1}/5 — ${l.name}`,
    sql: `INSERT INTO production_lines (facility_id, name, line_number, line_type, status, target_throughput, current_speed, metadata)
VALUES (1, ${esc(l.name)}, ${esc(l.num)}, '${l.type}', '${l.status}', ${l.target}, ${l.speed}, ${seedMeta()})`,
  }));
}

// ── 3. Zones ─────────────────────────────────────────────────────────────────

function getZoneInserts() {
  const typeMap = { restricted: 'restricted', caution: 'hazardous', emergency: 'authorized' };
  const zones = [
    { name: 'Restricted Zone A — Grinder Area',    type: 'restricted', color: '#DC2626', camera: 'SZ-CAM-01', image: '/safety-zones/sz-cam-01.png', location: 'Processing Hall — Section A',   desc: 'No unauthorized personnel. Active machinery hazard.',               breachCount: 3,  todayBreaches: 1, lastBreach: '2024-06-15T14:23:07Z', severity: 'critical', status: 'breach' },
    { name: 'Conveyor Belt Zone — Loading Dock',    type: 'caution',    color: '#F59E0B', camera: 'SZ-CAM-02', image: '/safety-zones/sz-cam-02.png', location: 'Loading Dock — Bay 3',          desc: 'Active conveyor area. Authorized technicians only.',                 breachCount: 7,  todayBreaches: 2, lastBreach: '2024-06-15T14:25:31Z', severity: 'warning',  status: 'breach' },
    { name: 'Forklift Operating Area',              type: 'restricted', color: '#F97316', camera: 'SZ-CAM-03', image: '/safety-zones/sz-cam-03.png', location: 'Warehouse — Aisle 4',            desc: 'Forklift-only zone. Pedestrians must use marked walkways.',           breachCount: 12, todayBreaches: 3, lastBreach: '2024-06-15T09:15:42Z', severity: 'warning',  status: 'breach' },
    { name: 'High Voltage — Electrical Panel',      type: 'restricted', color: '#DC2626', camera: 'SZ-CAM-04', image: '/safety-zones/sz-cam-04.png', location: 'Cold Storage — Utility Corridor', desc: 'High voltage area. Certified electricians only.',                    breachCount: 1,  todayBreaches: 1, lastBreach: '2024-06-15T11:08:55Z', severity: 'critical', status: 'breach' },
    { name: 'Emergency Exit Path — Packaging',      type: 'emergency',  color: '#10B981', camera: 'SZ-CAM-05', image: '/safety-zones/sz-cam-05.png', location: 'Packaging Hall — Exit B',         desc: 'Emergency evacuation route. Must remain unobstructed.',              breachCount: 0,  todayBreaches: 0, lastBreach: null,                   severity: 'clear',    status: 'clear' },
    { name: 'Robotic Arm Area — Automation',        type: 'restricted', color: '#DC2626', camera: 'SZ-CAM-06', image: '/safety-zones/sz-cam-06.png', location: 'Processing Hall — Section C',    desc: 'Automated machinery zone. Lockout/tagout required for entry.',        breachCount: 2,  todayBreaches: 1, lastBreach: '2024-06-15T15:02:33Z', severity: 'critical', status: 'breach' },
    { name: 'Wet Floor / Cleaning Zone',            type: 'caution',    color: '#F59E0B', camera: 'SZ-CAM-07', image: '/safety-zones/sz-cam-07.png', location: 'Processing Hall — Section B',    desc: 'Active cleaning area. Slip hazard — non-slip footwear required.',     breachCount: 5,  todayBreaches: 1, lastBreach: '2024-06-15T16:30:12Z', severity: 'warning',  status: 'breach' },
    { name: 'Truck Reversing Zone — Dock 6',        type: 'restricted', color: '#F97316', camera: 'SZ-CAM-08', image: '/safety-zones/sz-cam-08.png', location: 'Loading Dock — Bay 6',           desc: 'Active truck reversing area. No pedestrians during operations.',       breachCount: 4,  todayBreaches: 1, lastBreach: '2024-06-15T08:45:28Z', severity: 'critical', status: 'breach' },
    { name: 'Grinder Machinery Zone',               type: 'restricted', color: '#DC2626', camera: 'SZ-CAM-09', image: '/safety-zones/sz-cam-09.png', location: 'Grinding Room — Main Floor',     desc: 'Industrial grinder exclusion zone. Active monitoring.',               breachCount: 0,  todayBreaches: 0, lastBreach: null,                   severity: 'clear',    status: 'clear' },
    { name: 'Pedestrian Crossing — Intersection',   type: 'caution',    color: '#F59E0B', camera: 'SZ-CAM-10', image: '/safety-zones/sz-cam-10.png', location: 'Main Corridor — Junction C',     desc: 'Pedestrian-only crossing zone. No vehicle traffic.',                  breachCount: 8,  todayBreaches: 2, lastBreach: '2024-06-15T12:55:08Z', severity: 'warning',  status: 'breach' },
  ];

  return zones.map((z, i) => ({
    label: `Zone ${i + 1}/10 — ${z.name}`,
    sql: `INSERT INTO zones (facility_id, name, zone_type, color, alert_on_entry, metadata)
VALUES (1, ${esc(z.name)}, '${typeMap[z.type]}', '${z.color}', TRUE, ${seedMeta({
      camera: z.camera,
      image: z.image,
      location: z.location,
      description: z.desc,
      breachCount: z.breachCount,
      todayBreaches: z.todayBreaches,
      lastBreach: z.lastBreach,
      severity: z.severity,
      status: z.status,
    })})`,
  }));
}

// ── 4. Employees ─────────────────────────────────────────────────────────────

function getEmployeeInserts() {
  const employees = [
    { num: 'EMP-1001', fn: 'Carlos',   ln: 'Martinez',   dept: 'Production',       role: 'Line Worker',       st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1002', fn: 'Maria',    ln: 'Rodriguez',  dept: 'Production',       role: 'Line Worker',       st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1003', fn: 'James',    ln: 'Thompson',   dept: 'Production',       role: 'Supervisor',        st: 'active',   ppe: true,  fork: true  },
    { num: 'EMP-1004', fn: 'David',    ln: 'Williams',   dept: 'Maintenance',      role: 'Technician',        st: 'active',   ppe: true,  fork: true  },
    { num: 'EMP-1005', fn: 'Kevin',    ln: 'Nguyen',     dept: 'Production',       role: 'Line Worker',       st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1006', fn: 'Robert',   ln: 'Patel',      dept: 'Shipping',         role: 'Forklift Operator', st: 'active',   ppe: true,  fork: true  },
    { num: 'EMP-1007', fn: 'Sarah',    ln: 'Johnson',    dept: 'Safety',           role: 'Inspector',         st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1008', fn: 'Michael',  ln: 'Chen',       dept: 'Quality Control',  role: 'Inspector',         st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1009', fn: 'Jessica',  ln: 'Garcia',     dept: 'Production',       role: 'Line Worker',       st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1010', fn: 'Thomas',   ln: 'Garcia',     dept: 'Shipping',         role: 'Forklift Operator', st: 'active',   ppe: true,  fork: true  },
    { num: 'EMP-1011', fn: 'Daniel',   ln: 'Brown',      dept: 'Maintenance',      role: 'Technician',        st: 'active',   ppe: true,  fork: true  },
    { num: 'EMP-1012', fn: 'Amanda',   ln: 'Wilson',     dept: 'Administration',   role: 'Manager',           st: 'active',   ppe: false, fork: false },
    { num: 'EMP-1013', fn: 'Brian',    ln: 'Davis',      dept: 'Production',       role: 'Line Worker',       st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1014', fn: 'Lisa',     ln: 'Anderson',   dept: 'Quality Control',  role: 'Supervisor',        st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1015', fn: 'Steven',   ln: 'Taylor',     dept: 'Production',       role: 'Line Worker',       st: 'on_leave', ppe: true,  fork: false },
    { num: 'EMP-1016', fn: 'Jennifer', ln: 'Moore',      dept: 'Safety',           role: 'Manager',           st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1017', fn: 'Jose',     ln: 'Hernandez',  dept: 'Production',       role: 'Line Worker',       st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1018', fn: 'Mark',     ln: 'Jackson',    dept: 'Shipping',         role: 'Forklift Operator', st: 'active',   ppe: true,  fork: true  },
    { num: 'EMP-1019', fn: 'Emily',    ln: 'White',      dept: 'Quality Control',  role: 'Inspector',         st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1020', fn: 'Richard',  ln: 'Harris',     dept: 'Maintenance',      role: 'Supervisor',        st: 'active',   ppe: true,  fork: true  },
    { num: 'EMP-1021', fn: 'Laura',    ln: 'Martin',     dept: 'Production',       role: 'Line Worker',       st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1022', fn: 'Jason',    ln: 'Clark',      dept: 'Shipping',         role: 'Line Worker',       st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1023', fn: 'Angela',   ln: 'Lewis',      dept: 'Production',       role: 'Line Worker',       st: 'on_leave', ppe: true,  fork: false },
    { num: 'EMP-1024', fn: 'Ryan',     ln: 'Robinson',   dept: 'Maintenance',      role: 'Technician',        st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1025', fn: 'Michelle', ln: 'Walker',     dept: 'Administration',   role: 'Manager',           st: 'active',   ppe: false, fork: false },
    { num: 'EMP-1026', fn: 'Paul',     ln: 'Young',      dept: 'Production',       role: 'Line Worker',       st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1027', fn: 'Stephanie',ln: 'Allen',      dept: 'Safety',           role: 'Inspector',         st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1028', fn: 'George',   ln: 'King',       dept: 'Production',       role: 'Supervisor',        st: 'active',   ppe: true,  fork: true  },
    { num: 'EMP-1029', fn: 'Heather',  ln: 'Wright',     dept: 'Quality Control',  role: 'Inspector',         st: 'active',   ppe: true,  fork: false },
    { num: 'EMP-1030', fn: 'Chris',    ln: 'Lopez',      dept: 'Shipping',         role: 'Forklift Operator', st: 'active',   ppe: true,  fork: true  },
  ];

  return employees.map((e, i) => ({
    label: `Employee ${i + 1}/30 — ${e.fn} ${e.ln}`,
    sql: `INSERT INTO employees (facility_id, employee_number, first_name, last_name, department, role, status, ppe_certified, forklift_certified, metadata)
VALUES (1, ${esc(e.num)}, ${esc(e.fn)}, ${esc(e.ln)}, ${esc(e.dept)}, ${esc(e.role)}, '${e.st}', ${e.ppe}, ${e.fork}, ${seedMeta()})`,
  }));
}

// ── 5. IoT Devices ───────────────────────────────────────────────────────────

function getIoTDeviceInserts() {
  const statusMap = { running: 'online', fault: 'error', warning: 'online', idle: 'offline', maintenance: 'maintenance' };

  const machines = [
    { name: 'Grinder A-1',         machType: 'Industrial Grinder', line: 'Line 1', lineNum: 1, status: 'running',     outputRate: 482,  targetOutput: 500,  unit: 'lbs/hr',      uptime: 98.4, sensors: { temperature:{value:38,unit:'°F'}, vibration:{value:2.4,unit:'mm/s'}, powerDraw:{value:18.2,unit:'kW'}, motorRPM:{value:1740,unit:'RPM'} },             alerts: [],                          lastMaint: '2026-06-10T08:00:00Z', nextMaint: '2026-06-20T08:00:00Z' },
    { name: 'Grinder A-2',         machType: 'Industrial Grinder', line: 'Line 1', lineNum: 1, status: 'fault',       outputRate: 0,    targetOutput: 500,  unit: 'lbs/hr',      uptime: 72.1, sensors: { temperature:{value:58,unit:'°F'}, vibration:{value:9.8,unit:'mm/s'}, powerDraw:{value:24.1,unit:'kW'}, motorRPM:{value:0,unit:'RPM'} },               alerts: [{severity:'critical',type:'motor_fault',message:'Motor bearing failure detected'}], lastMaint: '2026-06-08T08:00:00Z', nextMaint: '2026-06-18T08:00:00Z' },
    { name: 'Conveyor Belt C-1',   machType: 'Belt Conveyor',      line: 'Line 1', lineNum: 1, status: 'running',     outputRate: 1200, targetOutput: 1250, unit: 'lbs/hr',      uptime: 99.2, sensors: { temperature:{value:34,unit:'°F'}, vibration:{value:1.2,unit:'mm/s'}, powerDraw:{value:5.4,unit:'kW'}, beltSpeed:{value:3.2,unit:'ft/s'} },            alerts: [],                          lastMaint: '2026-06-12T08:00:00Z', nextMaint: '2026-06-26T08:00:00Z' },
    { name: 'Trim Saw TS-1',       machType: 'Band Saw',           line: 'Line 2', lineNum: 2, status: 'running',     outputRate: 340,  targetOutput: 400,  unit: 'cuts/hr',     uptime: 94.6, sensors: { temperature:{value:36,unit:'°F'}, vibration:{value:3.8,unit:'mm/s'}, powerDraw:{value:12.7,unit:'kW'}, bladeRPM:{value:2850,unit:'RPM'} },            alerts: [{severity:'info',type:'output_deviation',message:'Output rate 15% below target'}], lastMaint: '2026-06-11T08:00:00Z', nextMaint: '2026-06-21T08:00:00Z' },
    { name: 'Vacuum Sealer VS-1',  machType: 'Vacuum Packer',      line: 'Line 2', lineNum: 2, status: 'running',     outputRate: 280,  targetOutput: 300,  unit: 'pkg/hr',      uptime: 97.8, sensors: { temperature:{value:32,unit:'°F'}, vibration:{value:0.8,unit:'mm/s'}, powerDraw:{value:8.1,unit:'kW'}, vacuumPressure:{value:-28.5,unit:'inHg'} },    alerts: [],                          lastMaint: '2026-06-09T08:00:00Z', nextMaint: '2026-06-23T08:00:00Z' },
    { name: 'Conveyor Belt C-3',   machType: 'Belt Conveyor',      line: 'Line 3', lineNum: 3, status: 'warning',     outputRate: 950,  targetOutput: 1250, unit: 'lbs/hr',      uptime: 88.3, sensors: { temperature:{value:41,unit:'°F'}, vibration:{value:6.2,unit:'mm/s'}, powerDraw:{value:7.8,unit:'kW'}, beltSpeed:{value:2.1,unit:'ft/s'} },            alerts: [{severity:'warning',type:'abnormal_vibration',message:'Vibration trending high'}], lastMaint: '2026-06-05T08:00:00Z', nextMaint: '2026-06-19T08:00:00Z' },
    { name: 'Patty Former PF-1',   machType: 'Patty Machine',      line: 'Line 5', lineNum: 5, status: 'running',     outputRate: 4800, targetOutput: 5000, unit: 'patties/hr',  uptime: 96.9, sensors: { temperature:{value:33,unit:'°F'}, vibration:{value:2.1,unit:'mm/s'}, powerDraw:{value:14.5,unit:'kW'}, formingPressure:{value:45,unit:'PSI'} },        alerts: [],                          lastMaint: '2026-06-13T08:00:00Z', nextMaint: '2026-06-27T08:00:00Z' },
    { name: 'Metal Detector MD-2', machType: 'Inline Detector',    line: 'Line 2', lineNum: 2, status: 'running',     outputRate: 1200, targetOutput: 1200, unit: 'scans/hr',    uptime: 99.9, sensors: { temperature:{value:35,unit:'°F'}, vibration:{value:0.3,unit:'mm/s'}, powerDraw:{value:2.1,unit:'kW'}, sensitivity:{value:99.2,unit:'%'} },             alerts: [],                          lastMaint: '2026-06-14T08:00:00Z', nextMaint: '2026-06-28T08:00:00Z' },
    { name: 'Chiller Unit CH-1',   machType: 'Refrigeration',      line: 'Line 1', lineNum: 1, status: 'running',     outputRate: 100,  targetOutput: 100,  unit: '%',           uptime: 99.5, sensors: { temperature:{value:30,unit:'°F'}, vibration:{value:1.5,unit:'mm/s'}, powerDraw:{value:22.0,unit:'kW'}, refrigerantPressure:{value:185,unit:'PSI'} },   alerts: [],                          lastMaint: '2026-06-07T08:00:00Z', nextMaint: '2026-06-21T08:00:00Z' },
    { name: 'Box Labeler BL-1',    machType: 'Labeling Machine',   line: 'Line 4', lineNum: 4, status: 'idle',        outputRate: 0,    targetOutput: 600,  unit: 'labels/hr',   uptime: 91.2, sensors: { temperature:{value:35,unit:'°F'}, vibration:{value:0.1,unit:'mm/s'}, powerDraw:{value:0.5,unit:'kW'}, labelStock:{value:42,unit:'%'} },                alerts: [{severity:'info',type:'scheduled_idle',message:'Machine idle — Line 4 scheduled downtime'}], lastMaint: '2026-06-06T08:00:00Z', nextMaint: '2026-06-20T08:00:00Z' },
    { name: 'Deboning Robot DR-1', machType: 'Robotic Arm',        line: 'Line 3', lineNum: 3, status: 'maintenance', outputRate: 0,    targetOutput: 200,  unit: 'pieces/hr',   uptime: 85.0, sensors: { temperature:{value:35,unit:'°F'}, vibration:{value:0.0,unit:'mm/s'}, powerDraw:{value:0.2,unit:'kW'}, jointStress:{value:0,unit:'N·m'} },              alerts: [{severity:'info',type:'maintenance',message:'Scheduled maintenance — joint calibration in progress'}], lastMaint: '2026-06-15T14:00:00Z', nextMaint: '2026-06-29T08:00:00Z' },
    { name: 'Weigh Scale WS-3',   machType: 'Inline Scale',       line: 'Line 3', lineNum: 3, status: 'running',     outputRate: 1180, targetOutput: 1200, unit: 'weigh/hr',    uptime: 99.7, sensors: { temperature:{value:34,unit:'°F'}, vibration:{value:0.5,unit:'mm/s'}, powerDraw:{value:1.2,unit:'kW'}, accuracy:{value:99.8,unit:'%'} },                alerts: [],                          lastMaint: '2026-06-13T08:00:00Z', nextMaint: '2026-06-27T08:00:00Z' },
  ];

  return machines.map((m, i) => {
    const dbStatus = statusMap[m.status] || 'online';
    // production_line_id — lines are inserted in order 1–5, so lineNum maps directly
    const plId = m.lineNum;
    const firstSensorKey = Object.keys(m.sensors)[0];
    const lastValue = { [firstSensorKey]: m.sensors[firstSensorKey] };
    const config = {
      machineType: m.machType,
      outputRate: m.outputRate,
      targetOutput: m.targetOutput,
      unit: m.unit,
      uptime: m.uptime,
      line: m.line,
      lineNumber: m.lineNum,
      sensors: m.sensors,
      alerts: m.alerts,
      lastMaintenance: m.lastMaint,
      nextMaintenance: m.nextMaint,
      originalStatus: m.status,
    };
    return {
      label: `IoT Device ${i + 1}/12 — ${m.name}`,
      sql: `INSERT INTO iot_devices (facility_id, device_name, device_type, location_description, production_line_id, status, \`last_value\`, config, metadata)
VALUES (1, ${esc(m.name)}, 'other', ${esc(m.line)}, ${plId}, '${dbStatus}', ${jsonStr(lastValue)}, ${jsonStr(config)}, ${seedMeta()})`,
    };
  });
}

// ── 6. Incidents ─────────────────────────────────────────────────────────────

function getIncidentInserts() {
  const incTypeMap = {
    unauthorized_entry: 'unauthorized_access',
    boundary_breach: 'zone_breach',
    pedestrian_in_vehicle_zone: 'safety_violation',
    vehicle_in_pedestrian_zone: 'safety_violation',
    slip_hazard_entry: 'safety_violation',
  };
  const statusMap = { unresolved: 'open', acknowledged: 'investigating', resolved: 'resolved' };

  const violations = [
    { sev: 'critical', type: 'unauthorized_entry',        desc: 'Worker entered restricted grinder zone without lockout clearance',           person: 'Unidentified — Badge not scanned',  dur: '47 sec',        st: 'unresolved',   img: '/safety-zones/sz-cam-01.png', zone: 'Restricted Zone A — Grinder Area',  cam: 'SZ-CAM-01', ts: hoursAgo(2) },
    { sev: 'warning',  type: 'boundary_breach',           desc: 'Personnel crossed conveyor safety boundary during operation',                person: 'Badge #1042 — M. Rodriguez',        dur: '12 sec',        st: 'acknowledged', img: '/safety-zones/sz-cam-02.png', zone: 'Conveyor Belt Zone — Loading Dock', cam: 'SZ-CAM-02', ts: hoursAgo(2) },
    { sev: 'warning',  type: 'pedestrian_in_vehicle_zone',desc: 'Pedestrian entered active forklift operating zone',                          person: 'Badge #2087 — J. Thompson',         dur: '23 sec',        st: 'resolved',     img: '/safety-zones/sz-cam-03.png', zone: 'Forklift Operating Area',           cam: 'SZ-CAM-03', ts: hoursAgo(7) },
    { sev: 'critical', type: 'unauthorized_entry',        desc: 'Maintenance worker accessed high voltage panel without clearance',            person: 'Badge #3021 — D. Williams',         dur: '2 min 14 sec',  st: 'unresolved',   img: '/safety-zones/sz-cam-04.png', zone: 'High Voltage — Electrical Panel',   cam: 'SZ-CAM-04', ts: hoursAgo(5) },
    { sev: 'critical', type: 'unauthorized_entry',        desc: 'Worker entered robotic arm zone without PPE or lockout procedure',            person: 'Unidentified — No badge detected',  dur: '1 min 38 sec',  st: 'unresolved',   img: '/safety-zones/sz-cam-06.png', zone: 'Robotic Arm Area — Automation',     cam: 'SZ-CAM-06', ts: hoursAgo(1) },
    { sev: 'warning',  type: 'slip_hazard_entry',         desc: 'Worker entered wet cleaning zone without non-slip footwear',                  person: 'Badge #1588 — K. Nguyen',           dur: '8 sec',         st: 'resolved',     img: '/safety-zones/sz-cam-07.png', zone: 'Wet Floor / Cleaning Zone',         cam: 'SZ-CAM-07', ts: minutesAgo(30) },
    { sev: 'critical', type: 'pedestrian_in_vehicle_zone',desc: 'Worker walked behind reversing truck in dock zone',                           person: 'Badge #4102 — R. Patel',            dur: '15 sec',        st: 'acknowledged', img: '/safety-zones/sz-cam-08.png', zone: 'Truck Reversing Zone — Dock 6',     cam: 'SZ-CAM-08', ts: hoursAgo(8) },
    { sev: 'warning',  type: 'vehicle_in_pedestrian_zone',desc: 'Forklift entered pedestrian-only crossing zone',                              person: 'Forklift Operator — Badge #2044',   dur: '31 sec',        st: 'unresolved',   img: '/safety-zones/sz-cam-10.png', zone: 'Pedestrian Crossing — Intersection',cam: 'SZ-CAM-10', ts: hoursAgo(4) },
    { sev: 'warning',  type: 'pedestrian_in_vehicle_zone',desc: 'Morning shift worker cut through forklift zone as shortcut',                  person: 'Badge #1923 — S. Martinez',         dur: '19 sec',        st: 'resolved',     img: '/safety-zones/sz-cam-03.png', zone: 'Forklift Operating Area',           cam: 'SZ-CAM-03', ts: hoursAgo(9) },
    { sev: 'warning',  type: 'boundary_breach',           desc: 'Worker reached across conveyor safety boundary to retrieve item',             person: 'Badge #1042 — M. Rodriguez',        dur: '6 sec',         st: 'resolved',     img: '/safety-zones/sz-cam-02.png', zone: 'Conveyor Belt Zone — Loading Dock', cam: 'SZ-CAM-02', ts: hoursAgo(5) },
    { sev: 'warning',  type: 'vehicle_in_pedestrian_zone',desc: 'Pallet jack driven through pedestrian crossing during shift change',          person: 'Badge #3088 — T. Garcia',           dur: '44 sec',        st: 'acknowledged', img: '/safety-zones/sz-cam-10.png', zone: 'Pedestrian Crossing — Intersection',cam: 'SZ-CAM-10', ts: hoursAgo(6) },
    { sev: 'critical', type: 'unauthorized_entry',        desc: 'Two workers entered grinder zone during active operation',                    person: 'Multiple — Badge #2011, #2045',     dur: '1 min 02 sec',  st: 'resolved',     img: '/safety-zones/sz-cam-01.png', zone: 'Restricted Zone A — Grinder Area',  cam: 'SZ-CAM-01', ts: daysAgo(1,16,5) },
  ];

  const stmts = violations.map((v, i) => ({
    label: `Incident ${i + 1}/15 — ${v.desc.slice(0, 50)}...`,
    sql: `INSERT INTO incidents (facility_id, incident_type, severity, title, description, status, metadata, created_at)
VALUES (1, '${incTypeMap[v.type]}', '${v.sev === 'critical' ? 'critical' : v.sev === 'warning' ? 'medium' : 'low'}', ${esc(v.desc)}, ${esc(v.desc)}, '${statusMap[v.st]}', ${seedMeta({ person: v.person, duration: v.dur, image: v.img, zoneName: v.zone, camera: v.cam })}, '${v.ts}')`,
  }));

  // 3 additional incidents
  stmts.push({
    label: 'Incident 13/15 — Equipment failure',
    sql: `INSERT INTO incidents (facility_id, incident_type, severity, title, description, status, metadata, created_at)
VALUES (1, 'equipment_failure', 'high', 'Grinder A-2 motor bearing failure', 'Grinder A-2 experienced a critical motor bearing failure resulting in complete shutdown. Temperature exceeded safe threshold at 58°F. Immediate maintenance dispatched.', 'investigating', ${seedMeta({ machineId: 'mch-2', line: 'Line 1' })}, '${hoursAgo(1)}')`,
  });
  stmts.push({
    label: 'Incident 14/15 — Near miss',
    sql: `INSERT INTO incidents (facility_id, incident_type, severity, title, description, status, metadata, created_at)
VALUES (1, 'near_miss', 'high', 'Forklift near-miss at Loading Dock Bay 3', 'Forklift FL-03 narrowly avoided collision with pedestrian worker near Loading Dock Bay 3. Speed was within limits but visibility was obstructed by stacked pallets.', 'resolved', ${seedMeta({ forkliftUnit: 'FL-03', location: 'Loading Dock Bay 3' })}, '${daysAgo(2, 10, 30)}')`,
  });
  stmts.push({
    label: 'Incident 15/15 — Line stoppage',
    sql: `INSERT INTO incidents (facility_id, incident_type, severity, title, description, status, metadata, created_at)
VALUES (1, 'line_stoppage', 'critical', 'Emergency stop — Line 4 wire fragment detected', 'Production Line 4 emergency stopped after AI detection system identified wire fragment on QC belt with 98.9% confidence. Multiple contaminants detected in rapid succession.', 'open', ${seedMeta({ line: 'Line 4', aiConfidence: 98.9 })}, '${minutesAgo(15)}')`,
  });

  return stmts;
}

// ── 7. Alerts ────────────────────────────────────────────────────────────────

function getAlertInserts() {
  const alerts = [
    // 5 zone_breach
    { type: 'zone_breach',      sev: 'critical', title: 'Zone Breach — Grinder Area',                   msg: 'Unauthorized entry detected in Restricted Zone A. Worker entered without lockout clearance.', src: 'zone', srcId: 1, ack: false, ts: hoursAgo(2) },
    { type: 'zone_breach',      sev: 'warning',  title: 'Zone Breach — Conveyor Belt Area',             msg: 'Personnel crossed safety boundary near conveyor belt during active operation.',                src: 'zone', srcId: 2, ack: true,  ts: hoursAgo(3) },
    { type: 'zone_breach',      sev: 'critical', title: 'Zone Breach — High Voltage Panel',             msg: 'Uncertified worker detected near high voltage electrical panel area.',                         src: 'zone', srcId: 4, ack: false, ts: hoursAgo(5) },
    { type: 'zone_breach',      sev: 'warning',  title: 'Zone Breach — Forklift Area',                  msg: 'Pedestrian detected in active forklift operating zone. Safety barrier bypassed.',              src: 'zone', srcId: 3, ack: true,  ts: hoursAgo(7) },
    { type: 'zone_breach',      sev: 'critical', title: 'Zone Breach — Robotic Arm Area',               msg: 'Worker entered robotic arm zone without PPE or lockout/tagout procedure.',                     src: 'zone', srcId: 6, ack: false, ts: hoursAgo(1) },
    // 5 device_offline
    { type: 'device_offline',   sev: 'warning',  title: 'Device Offline — Grinder A-2',                 msg: 'Grinder A-2 has gone offline due to motor bearing failure. Output dropped to 0.',              src: 'iot_device', srcId: 2, ack: false, ts: hoursAgo(1) },
    { type: 'device_offline',   sev: 'warning',  title: 'Device Offline — Box Labeler BL-1',            msg: 'Box Labeler BL-1 is idle. Line 4 scheduled downtime in effect.',                               src: 'iot_device', srcId: 10, ack: true, ts: hoursAgo(3) },
    { type: 'device_offline',   sev: 'warning',  title: 'Device Offline — Deboning Robot DR-1',         msg: 'Deboning Robot DR-1 undergoing scheduled maintenance. Joint calibration in progress.',         src: 'iot_device', srcId: 11, ack: true, ts: hoursAgo(2) },
    { type: 'device_offline',   sev: 'warning',  title: 'Device Alert — Conveyor Belt C-3',             msg: 'Conveyor Belt C-3 reporting abnormal vibration levels approaching threshold.',                  src: 'iot_device', srcId: 6,  ack: false, ts: minutesAgo(45) },
    { type: 'device_offline',   sev: 'warning',  title: 'Camera Offline — Line 3 Vacuum Pack',          msg: 'Production camera plc-6 (Line 3 Vacuum Pack) has gone offline.',                               src: 'camera', srcId: 22, ack: false, ts: hoursAgo(4) },
    // 5 safety_violation
    { type: 'safety_violation', sev: 'critical', title: 'Safety Violation — No PPE in Hazard Zone',     msg: 'Worker detected without required PPE in hazard zone. Hard hat and safety glasses missing.',     src: 'camera', srcId: 5,  ack: false, ts: minutesAgo(20) },
    { type: 'safety_violation', sev: 'critical', title: 'Safety Violation — Pedestrian Behind Truck',   msg: 'Worker walked behind reversing truck at Dock 6. High risk of collision.',                       src: 'zone', srcId: 8,  ack: true,  ts: hoursAgo(8) },
    { type: 'safety_violation', sev: 'critical', title: 'Safety Violation — Forklift in Ped Zone',      msg: 'Forklift entered pedestrian-only crossing during shift change.',                                src: 'zone', srcId: 10, ack: false, ts: hoursAgo(4) },
    { type: 'safety_violation', sev: 'critical', title: 'Safety Violation — Wet Floor Entry',           msg: 'Worker entered active cleaning zone without non-slip footwear.',                                src: 'zone', srcId: 7,  ack: true,  ts: minutesAgo(30) },
    { type: 'safety_violation', sev: 'critical', title: 'Safety Violation — Lockout Not Followed',      msg: 'Maintenance worker bypassed lockout/tagout procedure on high voltage panel.',                   src: 'zone', srcId: 4,  ack: false, ts: hoursAgo(5) },
    // 5 ai_detection
    { type: 'ai_detection',     sev: 'warning',  title: 'AI Detection — Metal Fragment on Line 1',      msg: 'Foreign object detected on Line 1 Intake Belt with 97.2% confidence. Line paused.',            src: 'camera', srcId: 17, ack: false, ts: minutesAgo(10) },
    { type: 'ai_detection',     sev: 'info',     title: 'AI Detection — Cardboard on Line 2',           msg: 'Possible cardboard fragment detected on Line 2 Trim Sort. Auto-cleared — below threshold.',    src: 'camera', srcId: 19, ack: true,  ts: hoursAgo(3) },
    { type: 'ai_detection',     sev: 'warning',  title: 'AI Detection — Bone Fragment on Line 2',       msg: 'Bone fragment detected on Line 2 Packaging Feed. Operator notified. Confidence 91.3%.',        src: 'camera', srcId: 20, ack: false, ts: minutesAgo(40) },
    { type: 'ai_detection',     sev: 'info',     title: 'AI Detection — Glove on Line 4',               msg: 'Glove fragment detected and removed by operator on Line 4 Rib Eye Sort.',                      src: 'camera', srcId: 23, ack: true,  ts: hoursAgo(6) },
    { type: 'ai_detection',     sev: 'warning',  title: 'AI Detection — Wire Fragment on Line 4',       msg: 'CRITICAL: Wire fragment on Line 4 QC Belt — 98.9% confidence. Emergency halt triggered.',      src: 'camera', srcId: 24, ack: false, ts: minutesAgo(5) },
    // 5 throughput_drop
    { type: 'throughput_drop',  sev: 'warning',  title: 'Throughput Drop — Line 1',                     msg: 'Line 1 throughput dropped to 232 units/hr (target 240). 3.3% below target.',                   src: 'production_line', srcId: 1, ack: true,  ts: hoursAgo(1) },
    { type: 'throughput_drop',  sev: 'warning',  title: 'Throughput Drop — Line 3',                     msg: 'Line 3 throughput dropped to 298 units/hr (target 320). 6.9% below target.',                   src: 'production_line', srcId: 3, ack: false, ts: minutesAgo(25) },
    { type: 'throughput_drop',  sev: 'warning',  title: 'Throughput Drop — Trim Saw TS-1',              msg: 'Trim Saw TS-1 output at 340 cuts/hr vs 400 target. Possible material variation.',              src: 'iot_device', srcId: 4,  ack: true,  ts: hoursAgo(2) },
    { type: 'throughput_drop',  sev: 'warning',  title: 'Throughput Drop — Conveyor C-3',               msg: 'Conveyor Belt C-3 running at 76% capacity. Belt speed reduced to 2.1 ft/s.',                   src: 'iot_device', srcId: 6,  ack: false, ts: minutesAgo(50) },
    { type: 'throughput_drop',  sev: 'warning',  title: 'Throughput Drop — Line 5',                     msg: 'Line 5 throughput at 142 units/hr (target 150). 5.3% below target.',                           src: 'production_line', srcId: 5, ack: true,  ts: hoursAgo(3) },
  ];

  return alerts.map((a, i) => ({
    label: `Alert ${i + 1}/25 — ${a.title}`,
    sql: `INSERT INTO alerts (facility_id, alert_type, severity, title, message, source_type, source_id, acknowledged, metadata, created_at)
VALUES (1, '${a.type}', '${a.sev}', ${esc(a.title)}, ${esc(a.msg)}, '${a.src}', ${a.srcId}, ${a.ack}, ${seedMeta()}, '${a.ts}')`,
  }));
}

// ── 8. Forklifts ─────────────────────────────────────────────────────────────

function getForkliftInserts() {
  // Employee IDs for forklift-certified: EMP-1006 (id=6), EMP-1010 (id=10), EMP-1018 (id=18)
  const forklifts = [
    { unit: 'FL-01', model: 'Toyota 8FBE18',       status: 'active',         driver: 6,    lastInsp: '2026-06-10', nextMaint: '2026-06-24', hours: 2450.5 },
    { unit: 'FL-02', model: 'Hyster H50FT',        status: 'active',         driver: 10,   lastInsp: '2026-06-12', nextMaint: '2026-06-26', hours: 1830.2 },
    { unit: 'FL-03', model: 'Crown FC5200',        status: 'active',         driver: 18,   lastInsp: '2026-06-08', nextMaint: '2026-06-22', hours: 3100.8 },
    { unit: 'FL-04', model: 'Yale GLC050VX',       status: 'parked',         driver: null,  lastInsp: '2026-06-14', nextMaint: '2026-06-28', hours: 980.0  },
    { unit: 'FL-05', model: 'Caterpillar GP25N',   status: 'maintenance',    driver: null,  lastInsp: '2026-06-05', nextMaint: '2026-06-19', hours: 4200.3 },
    { unit: 'FL-06', model: 'Komatsu FG25T-16',    status: 'out_of_service', driver: null,  lastInsp: '2026-05-20', nextMaint: '2026-06-03', hours: 5500.1 },
  ];

  return forklifts.map((f, i) => ({
    label: `Forklift ${i + 1}/6 — ${f.unit}`,
    sql: `INSERT INTO forklifts (facility_id, unit_number, model, status, current_driver_id, last_inspection, next_maintenance, total_hours, metadata)
VALUES (1, ${esc(f.unit)}, ${esc(f.model)}, '${f.status}', ${f.driver || 'NULL'}, '${f.lastInsp}', '${f.nextMaint}', ${f.hours}, ${seedMeta()})`,
  }));
}

// ── 9. Users ─────────────────────────────────────────────────────────────────

function getUserInserts() {
  const fakeHash = '$2a$10$placeholderHashValueForSeedDataXYZ1234567890ab';
  const users = [
    { uname: 'admin',         email: 'admin@nationalbeef.com',         fn: 'System',  ln: 'Admin',   roleId: 1 },
    { uname: 'sarah.johnson', email: 'sarah.johnson@nationalbeef.com', fn: 'Sarah',   ln: 'Johnson', roleId: 2 },
    { uname: 'mike.chen',     email: 'mike.chen@nationalbeef.com',     fn: 'Mike',    ln: 'Chen',    roleId: 3 },
    { uname: 'james.wilson',  email: 'james.wilson@nationalbeef.com',  fn: 'James',   ln: 'Wilson',  roleId: 4 },
    { uname: 'emily.davis',   email: 'emily.davis@nationalbeef.com',   fn: 'Emily',   ln: 'Davis',   roleId: 5 },
  ];

  return users.map((u, i) => ({
    label: `User ${i + 1}/5 — ${u.uname}`,
    sql: `INSERT INTO users (organization_id, username, email, password_hash, first_name, last_name, role_id, status, preferences)
VALUES (1, ${esc(u.uname)}, ${esc(u.email)}, ${esc(fakeHash)}, ${esc(u.fn)}, ${esc(u.ln)}, ${u.roleId}, 'active', ${jsonStr({ theme: 'dark', notifications: true, seed: true })})`,
  }));
}

// ── 10. AI Events ────────────────────────────────────────────────────────────

function getAIEventInserts() {
  const events = [
    { camId: 17, type: 'foreign_object',     conf: 0.9720, reviewed: false, fp: false, ts: minutesAgo(10) },
    { camId: 17, type: 'foreign_object',     conf: 0.8910, reviewed: false, fp: false, ts: minutesAgo(13) },
    { camId: 17, type: 'foreign_object',     conf: 0.8230, reviewed: true,  fp: false, ts: hoursAgo(1) },
    { camId: 19, type: 'foreign_object',     conf: 0.7650, reviewed: true,  fp: true,  ts: hoursAgo(3) },
    { camId: 20, type: 'foreign_object',     conf: 0.9130, reviewed: false, fp: false, ts: minutesAgo(40) },
    { camId: 20, type: 'foreign_object',     conf: 0.6210, reviewed: true,  fp: true,  ts: hoursAgo(2) },
    { camId: 23, type: 'foreign_object',     conf: 0.8840, reviewed: true,  fp: false, ts: hoursAgo(6) },
    { camId: 24, type: 'foreign_object',     conf: 0.9890, reviewed: false, fp: false, ts: minutesAgo(5) },
    { camId: 24, type: 'foreign_object',     conf: 0.9610, reviewed: false, fp: false, ts: minutesAgo(6) },
    { camId: 24, type: 'foreign_object',     conf: 0.8470, reviewed: false, fp: false, ts: minutesAgo(7) },
    { camId: 5,  type: 'ppe_violation',      conf: 0.9340, reviewed: false, fp: false, ts: minutesAgo(20) },
    { camId: 10, type: 'ppe_violation',      conf: 0.8750, reviewed: true,  fp: false, ts: hoursAgo(4) },
    { camId: 1,  type: 'zone_breach',        conf: 0.9510, reviewed: false, fp: false, ts: hoursAgo(2) },
    { camId: 4,  type: 'zone_breach',        conf: 0.9280, reviewed: true,  fp: false, ts: hoursAgo(5) },
    { camId: 11, type: 'motion_detected',    conf: 0.7800, reviewed: true,  fp: true,  ts: hoursAgo(8) },
    { camId: 9,  type: 'motion_detected',    conf: 0.8120, reviewed: false, fp: false, ts: hoursAgo(6) },
    { camId: 3,  type: 'forklift_proximity', conf: 0.9150, reviewed: true,  fp: false, ts: hoursAgo(7) },
    { camId: 7,  type: 'forklift_proximity', conf: 0.8680, reviewed: false, fp: false, ts: hoursAgo(9) },
    { camId: 14, type: 'ppe_violation',      conf: 0.7950, reviewed: true,  fp: true,  ts: daysAgo(1,14,0) },
    { camId: 16, type: 'motion_detected',    conf: 0.8430, reviewed: true,  fp: false, ts: daysAgo(1,22,0) },
  ];

  return events.map((e, i) => ({
    label: `AI Event ${i + 1}/20 — ${e.type}`,
    sql: `INSERT INTO ai_events (camera_id, facility_id, event_type, confidence, reviewed, false_positive, metadata, created_at)
VALUES (${e.camId}, 1, ${esc(e.type)}, ${e.conf}, ${e.reviewed}, ${e.fp}, ${seedMeta()}, '${e.ts}')`,
  }));
}

// ── 11. Time Entries ─────────────────────────────────────────────────────────

function getTimeEntryInserts() {
  const entries = [];
  // Generate entries for employees 1–15 over the past 2 days
  for (let day = 0; day < 2; day++) {
    for (let empId = 1; empId <= 15; empId++) {
      const clockIn = daysAgo(day, 6, 0);
      const clockOut = day === 0 ? null : daysAgo(day, 14, 30); // today's shift still open for some
      const breakMin = day === 0 ? 0 : 30;
      entries.push({
        label: `Time Entry — Emp ${empId}, day-${day}`,
        sql: `INSERT INTO time_entries (employee_id, facility_id, clock_in, clock_out, break_minutes, metadata)
VALUES (${empId}, 1, '${clockIn}', ${clockOut ? `'${clockOut}'` : 'NULL'}, ${breakMin}, ${seedMeta()})`,
      });
    }
  }
  return entries;
}

// ── 12. Audit Log ────────────────────────────────────────────────────────────

function getAuditLogInserts() {
  const logs = [
    { action: 'user_login',       entity: 'user',    entityId: 1, userId: 1, details: { username: 'admin', ip: '192.168.1.100' },                           ts: minutesAgo(5) },
    { action: 'user_login',       entity: 'user',    entityId: 2, userId: 2, details: { username: 'sarah.johnson', ip: '192.168.1.105' },                   ts: hoursAgo(1) },
    { action: 'user_login',       entity: 'user',    entityId: 3, userId: 3, details: { username: 'mike.chen', ip: '192.168.1.110' },                       ts: hoursAgo(2) },
    { action: 'camera_config',    entity: 'camera',  entityId: 17, userId: 1, details: { change: 'Enabled AI detection on Line 1 Intake Belt' },            ts: daysAgo(1, 9, 0) },
    { action: 'camera_config',    entity: 'camera',  entityId: 24, userId: 1, details: { change: 'Updated confidence threshold to 80% on Line 4 QC Belt' },ts: daysAgo(2, 11, 0) },
    { action: 'incident_resolve', entity: 'incident', entityId: 3, userId: 2, details: { resolution: 'Verbal warning issued to employee. Safety briefing scheduled.' }, ts: hoursAgo(6) },
    { action: 'incident_resolve', entity: 'incident', entityId: 6, userId: 2, details: { resolution: 'PPE compliance reminder sent. Employee acknowledged.' },          ts: minutesAgo(25) },
    { action: 'zone_update',      entity: 'zone',    entityId: 3, userId: 1, details: { change: 'Increased max occupancy from 3 to 5 for Forklift Operating Area' },  ts: daysAgo(3, 14, 0) },
    { action: 'zone_update',      entity: 'zone',    entityId: 1, userId: 1, details: { change: 'Added new geofence boundary for Grinder Area restricted zone' },     ts: daysAgo(5, 10, 0) },
    { action: 'device_config',    entity: 'iot_device', entityId: 2, userId: 3, details: { change: 'Reset motor fault flag on Grinder A-2' },                          ts: hoursAgo(1) },
    { action: 'employee_update',  entity: 'employee',   entityId: 15, userId: 1, details: { change: 'Status changed to on_leave for Steven Taylor' },                  ts: daysAgo(2, 8, 0) },
    { action: 'forklift_update',  entity: 'forklift',   entityId: 5, userId: 3, details: { change: 'Forklift FL-05 placed into maintenance status' },                  ts: daysAgo(1, 7, 0) },
    { action: 'alert_ack',        entity: 'alert',       entityId: 2, userId: 2, details: { note: 'Acknowledged conveyor belt zone breach. Worker briefed.' },          ts: hoursAgo(3) },
    { action: 'system_backup',    entity: 'system',      entityId: null, userId: 1, details: { type: 'automated', status: 'success', duration_sec: 42 },               ts: daysAgo(1, 2, 0) },
    { action: 'report_generated', entity: 'system',      entityId: null, userId: 2, details: { report: 'Weekly Safety Summary', format: 'PDF', period: 'June 9-15' },  ts: hoursAgo(4) },
  ];

  return logs.map((l, i) => ({
    label: `Audit Log ${i + 1}/15 — ${l.action}`,
    sql: `INSERT INTO audit_log (facility_id, action_type, entity_type, entity_id, user_id, details, ip_address, created_at)
VALUES (1, ${esc(l.action)}, ${esc(l.entity)}, ${l.entityId || 'NULL'}, ${l.userId}, ${jsonStr(l.details)}, '192.168.1.${100 + (l.userId || 0)}', '${l.ts}')`,
  }));
}

// ── 13. Production Logs ──────────────────────────────────────────────────────

function getProductionLogInserts() {
  const logs = [
    // Line 1 events
    { plId: 1, type: 'start',        details: { shift: 'A', operator: 'Carlos Martinez' },                             throughput: null, recordedBy: 3,  ts: daysAgo(0, 6, 0) },
    { plId: 1, type: 'speed_change', details: { from: 240, to: 232, reason: 'Material quality adjustment' },           throughput: 232,  recordedBy: 3,  ts: hoursAgo(3) },
    { plId: 1, type: 'jam',          details: { location: 'Intake belt', duration_min: 4, resolved: true },             throughput: 0,    recordedBy: 1,  ts: hoursAgo(5) },
    { plId: 1, type: 'shift_change', details: { from: 'A', to: 'B', handoff: 'normal' },                               throughput: 235,  recordedBy: 3,  ts: daysAgo(0, 14, 0) },
    // Line 2 events
    { plId: 2, type: 'start',        details: { shift: 'A', operator: 'Jose Hernandez' },                              throughput: null, recordedBy: 3,  ts: daysAgo(0, 6, 0) },
    { plId: 2, type: 'speed_change', details: { from: 180, to: 175, reason: 'Trim saw blade dulling' },                throughput: 175,  recordedBy: 3,  ts: hoursAgo(4) },
    { plId: 2, type: 'stop',         details: { reason: 'Scheduled break', duration_min: 30 },                          throughput: 0,    recordedBy: 3,  ts: daysAgo(0, 12, 0) },
    { plId: 2, type: 'start',        details: { reason: 'Resuming after break' },                                       throughput: 178,  recordedBy: 3,  ts: daysAgo(0, 12, 30) },
    // Line 3 events
    { plId: 3, type: 'start',        details: { shift: 'A', operator: 'Paul Young' },                                  throughput: null, recordedBy: 14, ts: daysAgo(0, 6, 0) },
    { plId: 3, type: 'speed_change', details: { from: 320, to: 298, reason: 'Conveyor belt vibration warning' },       throughput: 298,  recordedBy: 14, ts: hoursAgo(2) },
    { plId: 3, type: 'maintenance',  details: { equipment: 'Deboning Robot DR-1', type: 'scheduled', duration_hr: 2 },  throughput: 280,  recordedBy: 4,  ts: hoursAgo(3) },
    // Line 4 events
    { plId: 4, type: 'stop',         details: { reason: 'Scheduled maintenance — labeler calibration' },                throughput: 0,    recordedBy: 4,  ts: daysAgo(0, 6, 0) },
    { plId: 4, type: 'maintenance',  details: { equipment: 'Box Labeler BL-1', type: 'scheduled', duration_hr: 8 },     throughput: 0,    recordedBy: 4,  ts: daysAgo(0, 6, 0) },
    { plId: 4, type: 'stop',         details: { reason: 'Emergency halt — wire fragment detected by AI' },              throughput: 0,    recordedBy: null,ts: minutesAgo(15) },
    // Line 5 events
    { plId: 5, type: 'start',        details: { shift: 'A', operator: 'George King' },                                 throughput: null, recordedBy: 28, ts: daysAgo(0, 6, 0) },
    { plId: 5, type: 'speed_change', details: { from: 150, to: 142, reason: 'Patty former pressure adjustment' },      throughput: 142,  recordedBy: 28, ts: hoursAgo(4) },
    { plId: 5, type: 'shift_change', details: { from: 'A', to: 'B', handoff: 'normal' },                               throughput: 145,  recordedBy: 28, ts: daysAgo(0, 14, 0) },
    // Yesterday events
    { plId: 1, type: 'start',        details: { shift: 'A', operator: 'Carlos Martinez' },                             throughput: null, recordedBy: 3,  ts: daysAgo(1, 6, 0) },
    { plId: 1, type: 'stop',         details: { reason: 'End of shift' },                                               throughput: 238,  recordedBy: 3,  ts: daysAgo(1, 14, 30) },
    { plId: 2, type: 'start',        details: { shift: 'A', operator: 'Jose Hernandez' },                              throughput: null, recordedBy: 3,  ts: daysAgo(1, 6, 0) },
  ];

  return logs.map((l, i) => ({
    label: `Production Log ${i + 1}/20 — Line ${l.plId} ${l.type}`,
    sql: `INSERT INTO production_logs (production_line_id, event_type, details, throughput_count, recorded_by, recorded_at)
VALUES (${l.plId}, '${l.type}', ${jsonStr(l.details)}, ${l.throughput ?? 'NULL'}, ${l.recordedBy ?? 'NULL'}, '${l.ts}')`,
  }));
}

// ── 14. Chat History ─────────────────────────────────────────────────────────

function getChatHistoryInserts() {
  const chats = [
    {
      userId: 1,
      msg: "How many cameras are online right now?",
      resp: "There are currently 24 cameras online out of 25 total. One camera (Line 3) is offline.",
      query: "SELECT COUNT(*) as total, SUM(status='online') as online FROM cameras WHERE facility_id=1",
      time: 245,
      ts: minutesAgo(15),
    },
    {
      userId: 2,
      msg: "Show me today's safety incidents",
      resp: "There are 8 incidents reported today: 4 unauthorized access, 2 safety violations, 1 zone breach, and 1 equipment failure.",
      query: "SELECT * FROM incidents WHERE facility_id=1 AND DATE(created_at)=CURDATE() ORDER BY created_at DESC",
      time: 312,
      ts: hoursAgo(1),
    },
    {
      userId: 3,
      msg: "What is the current throughput for Line 1?",
      resp: "Production Line 1 is currently running at 232 units/hr against a target of 240 units/hr (96.7% efficiency).",
      query: "SELECT name, current_speed, target_throughput FROM production_lines WHERE id=1",
      time: 189,
      ts: hoursAgo(2),
    },
    {
      userId: 1,
      msg: "Which machines have active alerts?",
      resp: "Three machines have active alerts: Grinder A-2 (critical), Conveyor Belt C-3 (warning), and Box Labeler BL-1 (idle).",
      query: "SELECT d.device_name, d.status FROM iot_devices d WHERE d.facility_id=1 AND d.status IN ('error','maintenance')",
      time: 278,
      ts: hoursAgo(3),
    },
    {
      userId: 2,
      msg: "How many zone breaches occurred this week?",
      resp: "This week there have been 12 zone breach incidents across 6 different safety zones.",
      query: "SELECT COUNT(*) as total FROM incidents WHERE facility_id=1 AND incident_type='zone_breach' AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)",
      time: 201,
      ts: hoursAgo(4),
    },
  ];

  return chats.map((c, i) => ({
    label: `Chat ${i + 1}/5`,
    sql: `INSERT INTO chat_history (facility_id, user_id, user_message, ai_response, query_generated, response_time_ms, metadata, created_at)
VALUES (1, ${c.userId}, ${esc(c.msg)}, ${esc(c.resp)}, ${esc(c.query)}, ${c.time}, ${seedMeta()}, '${c.ts}')`,
  }));
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  National Beef Video Monitor — Database Seed Script      ║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');

  await initialize();

  // Ordered table sections — respects foreign key dependencies
  const sections = [
    { name: 'Users',            fn: getUserInserts },
    { name: 'Production Lines', fn: getProductionLineInserts },
    { name: 'Zones',            fn: getZoneInserts },
    { name: 'Employees',        fn: getEmployeeInserts },
    { name: 'Cameras',          fn: getCameraInserts },
    { name: 'IoT Devices',      fn: getIoTDeviceInserts },
    { name: 'Forklifts',        fn: getForkliftInserts },
    { name: 'Incidents',        fn: getIncidentInserts },
    { name: 'Alerts',           fn: getAlertInserts },
    { name: 'AI Events',        fn: getAIEventInserts },
    { name: 'Time Entries',     fn: getTimeEntryInserts },
    { name: 'Production Logs',  fn: getProductionLogInserts },
    { name: 'Audit Log',        fn: getAuditLogInserts },
    { name: 'Chat History',     fn: getChatHistoryInserts },
  ];

  const sectionResults = [];

  for (const section of sections) {
    console.log(`\n━━━ Seeding: ${section.name} ━━━`);
    const stmts = section.fn();
    let sectionSuccess = 0;
    let sectionFail = 0;

    for (const stmt of stmts) {
      const ok = await sql(stmt.sql, stmt.label);
      if (ok) sectionSuccess++;
      else sectionFail++;
      await delay();
    }

    sectionResults.push({ name: section.name, total: stmts.length, ok: sectionSuccess, fail: sectionFail });
    console.log(`  → ${section.name}: ${sectionSuccess}/${stmts.length} succeeded`);
  }

  // ── Summary ──
  console.log('\n╔═══════════════════════════════════════════════════════════╗');
  console.log('║                    SEED SUMMARY                          ║');
  console.log('╠═══════════════════════════════════════════════════════════╣');
  for (const r of sectionResults) {
    const status = r.fail === 0 ? '✅' : '⚠️';
    console.log(`║  ${status} ${r.name.padEnd(20)} ${String(r.ok).padStart(3)}/${String(r.total).padStart(3)} succeeded${r.fail > 0 ? ` (${r.fail} failed)` : ''}`.padEnd(60) + '║');
  }
  console.log('╠═══════════════════════════════════════════════════════════╣');
  console.log(`║  Total: ${totalSuccess} succeeded, ${totalFail} failed`.padEnd(60) + '║');
  console.log('╚═══════════════════════════════════════════════════════════╝\n');
}

main().catch((e) => {
  console.error('Fatal:', e);
  process.exit(1);
});
