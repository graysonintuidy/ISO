#!/usr/bin/env node

/**
 * setup-auth.mjs
 * Creates authentication tables and seeds default roles, permissions, and admin user.
 *
 * Tables created/modified:
 *   - roles
 *   - permissions
 *   - role_permissions
 *   - user_sessions
 *   - audit_log (modified to support auth events)
 *   - users (add auth columns)
 *
 * Seeds:
 *   - 4 roles: admin, manager, operator, viewer
 *   - 16 permissions
 *   - Role-permission mappings
 *   - Admin user: admin@nationalbeef.com / Nationalbeef1
 *
 * Usage: node scripts/setup-auth.mjs
 */

import bcrypt from 'bcryptjs';

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
      clientInfo: { name: 'nb-auth-setup', version: '1.0.0' },
    },
  });
  console.log('Session ID:', sessionId);

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
    return r;
  } catch (e) {
    console.log('❌');
    console.log(`    Exception: ${e.message}`);
    totalFail++;
    return false;
  }
}

function delay(ms = 200) {
  return new Promise((r) => setTimeout(r, ms));
}

function esc(str) {
  if (str === null || str === undefined) return 'NULL';
  return "'" + String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'") + "'";
}

// ─── Table Definitions ───────────────────────────────────────────────────────

async function createTables() {
  console.log('\n=== Creating Auth Tables ===\n');

  // 1. Roles table
  await sql(`
    CREATE TABLE IF NOT EXISTS roles (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(50) NOT NULL UNIQUE,
      display_name VARCHAR(100) NOT NULL,
      description TEXT,
      is_system TINYINT(1) DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `, 'Create roles table');
  await delay();

  // 2. Permissions table
  await sql(`
    CREATE TABLE IF NOT EXISTS permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      \`key\` VARCHAR(100) NOT NULL UNIQUE,
      display_name VARCHAR(150) NOT NULL,
      description TEXT,
      category VARCHAR(50),
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, 'Create permissions table');
  await delay();

  // 3. Role-permissions mapping
  await sql(`
    CREATE TABLE IF NOT EXISTS role_permissions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      role_id INT NOT NULL,
      permission_id INT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_role_perm (role_id, permission_id)
    )
  `, 'Create role_permissions table');
  await delay();

  // 4. User sessions table
  await sql(`
    CREATE TABLE IF NOT EXISTS user_sessions (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NOT NULL,
      token_hash VARCHAR(128) NOT NULL,
      ip_address VARCHAR(45),
      user_agent VARCHAR(500),
      login_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      logout_at DATETIME,
      expires_at DATETIME,
      is_active TINYINT(1) DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `, 'Create user_sessions table');
  await delay();

  // 5. Add auth columns to users table (if missing)
  const addCols = [
    ['password_hash', 'VARCHAR(255)'],
    ['first_name', 'VARCHAR(100)'],
    ['last_name', 'VARCHAR(100)'],
    ['avatar_url', 'VARCHAR(500)'],
    ['role_id', 'INT'],
  ];

  for (const [col, type] of addCols) {
    await sql(
      `ALTER TABLE users ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`,
      `Add users.${col}`
    );
    await delay();
  }

  // 6. Ensure audit_log has the right columns
  const auditCols = [
    ['user_id', 'INT'],
    ['action', 'VARCHAR(100)'],
    ['details', 'TEXT'],
    ['ip_address', 'VARCHAR(45)'],
  ];

  for (const [col, type] of auditCols) {
    await sql(
      `ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS \`${col}\` ${type}`,
      `Add audit_log.${col}`
    );
    await delay();
  }
}

// ─── Seed Roles ──────────────────────────────────────────────────────────────

const ROLES = [
  { name: 'admin', display_name: 'Administrator', description: 'Full system access — can manage all settings, users, and data' },
  { name: 'manager', display_name: 'Manager', description: 'Can view all data, manage incidents, and view users' },
  { name: 'operator', display_name: 'Operator', description: 'Can view cameras, production lines, and safety zones' },
  { name: 'viewer', display_name: 'Viewer', description: 'Read-only access to dashboard and cameras' },
];

async function seedRoles() {
  console.log('\n=== Seeding Roles ===\n');

  for (const role of ROLES) {
    await sql(
      `INSERT INTO roles (name, display_name, description, is_system) ` +
      `VALUES (${esc(role.name)}, ${esc(role.display_name)}, ${esc(role.description)}, 1) ` +
      `ON DUPLICATE KEY UPDATE display_name = ${esc(role.display_name)}, description = ${esc(role.description)}`,
      `Seed role: ${role.name}`
    );
    await delay();
  }
}

// ─── Seed Permissions ────────────────────────────────────────────────────────

const PERMISSIONS = [
  { key: 'dashboard.view', display_name: 'View Dashboard', category: 'Dashboard' },
  { key: 'cameras.view', display_name: 'View Cameras', category: 'Cameras' },
  { key: 'cameras.manage', display_name: 'Manage Cameras', category: 'Cameras' },
  { key: 'incidents.view', display_name: 'View Incidents', category: 'Incidents' },
  { key: 'incidents.manage', display_name: 'Manage Incidents', category: 'Incidents' },
  { key: 'safety.view', display_name: 'View Safety Zones', category: 'Safety' },
  { key: 'safety.manage', display_name: 'Manage Safety Zones', category: 'Safety' },
  { key: 'production.view', display_name: 'View Production Lines', category: 'Production' },
  { key: 'production.manage', display_name: 'Manage Production Lines', category: 'Production' },
  { key: 'users.view', display_name: 'View Users', category: 'Admin' },
  { key: 'users.manage', display_name: 'Manage Users', category: 'Admin' },
  { key: 'settings.view', display_name: 'View Settings', category: 'Admin' },
  { key: 'settings.manage', display_name: 'Manage Settings', category: 'Admin' },
  { key: 'audit.view', display_name: 'View Audit Log', category: 'Admin' },
  { key: 'ai.use', display_name: 'Use AI Assistant', category: 'AI' },
  { key: 'reports.view', display_name: 'View Reports', category: 'Reports' },
];

async function seedPermissions() {
  console.log('\n=== Seeding Permissions ===\n');

  for (const perm of PERMISSIONS) {
    await sql(
      `INSERT INTO permissions (\`key\`, display_name, description, category) ` +
      `VALUES (${esc(perm.key)}, ${esc(perm.display_name)}, ${esc(perm.description || '')}, ${esc(perm.category)}) ` +
      `ON DUPLICATE KEY UPDATE display_name = ${esc(perm.display_name)}, category = ${esc(perm.category)}`,
      `Seed permission: ${perm.key}`
    );
    await delay();
  }
}

// ─── Seed Role-Permission Mappings ──────────────────────────────────────────

const ROLE_PERMISSIONS = {
  admin: PERMISSIONS.map((p) => p.key), // All permissions
  manager: [
    'dashboard.view', 'cameras.view', 'incidents.view', 'incidents.manage',
    'safety.view', 'production.view', 'users.view', 'audit.view',
    'ai.use', 'reports.view',
  ],
  operator: [
    'dashboard.view', 'cameras.view', 'incidents.view',
    'safety.view', 'production.view', 'ai.use',
  ],
  viewer: [
    'dashboard.view', 'cameras.view', 'reports.view',
  ],
};

async function seedRolePermissions() {
  console.log('\n=== Seeding Role-Permission Mappings ===\n');

  for (const [roleName, permKeys] of Object.entries(ROLE_PERMISSIONS)) {
    for (const permKey of permKeys) {
      await sql(
        `INSERT INTO role_permissions (role_id, permission_id) ` +
        `SELECT r.id, p.id FROM roles r, permissions p ` +
        `WHERE r.name = ${esc(roleName)} AND p.\`key\` = ${esc(permKey)} ` +
        `ON DUPLICATE KEY UPDATE role_id = role_id`,
        `Map ${roleName} → ${permKey}`
      );
      await delay(100);
    }
  }
}

// ─── Seed Admin User ─────────────────────────────────────────────────────────

async function seedAdminUser() {
  console.log('\n=== Seeding Admin User ===\n');

  const passwordHash = await bcrypt.hash('Nationalbeef1', 10);
  console.log('  Password hashed with bcrypt (10 rounds)');

  // Get admin role ID
  const roleResult = await sql(
    `SELECT id FROM roles WHERE name = 'admin' LIMIT 1`,
    'Fetch admin role ID'
  );
  await delay();

  const adminRoleId = roleResult?.rows?.[0]?.id || 1;
  console.log(`  Admin role ID: ${adminRoleId}`);

  // Check if admin user already exists
  const existingUser = await sql(
    `SELECT id FROM users WHERE email = 'admin@nationalbeef.com' LIMIT 1`,
    'Check existing admin user'
  );
  await delay();

  if (existingUser?.rows?.length > 0) {
    // Update existing user
    await sql(
      `UPDATE users SET ` +
      `password_hash = ${esc(passwordHash)}, ` +
      `role = 'admin', ` +
      `role_id = ${adminRoleId}, ` +
      `first_name = 'System', ` +
      `last_name = 'Administrator', ` +
      `username = 'admin', ` +
      `status = 'active' ` +
      `WHERE email = 'admin@nationalbeef.com'`,
      'Update admin user'
    );
  } else {
    // Insert new admin user
    await sql(
      `INSERT INTO users (username, email, password_hash, first_name, last_name, role, role_id, status, organization_id, created_at) ` +
      `VALUES (` +
      `'admin', ` +
      `'admin@nationalbeef.com', ` +
      `${esc(passwordHash)}, ` +
      `'System', ` +
      `'Administrator', ` +
      `'admin', ` +
      `${adminRoleId}, ` +
      `'active', ` +
      `1, ` +
      `NOW()` +
      `)`,
      'Insert admin user'
    );
  }
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('╔══════════════════════════════════════════════╗');
  console.log('║  National Beef — Auth System Setup           ║');
  console.log('╚══════════════════════════════════════════════╝\n');

  await initialize();
  await createTables();
  await seedRoles();
  await seedPermissions();
  await seedRolePermissions();
  await seedAdminUser();

  console.log('\n══════════════════════════════════════════');
  console.log(`  ✅ Success: ${totalSuccess}`);
  console.log(`  ❌ Failed:  ${totalFail}`);
  console.log('══════════════════════════════════════════\n');

  if (totalFail > 0) {
    console.log('⚠️  Some operations failed. Check the output above for details.');
  } else {
    console.log('🎉 Auth system setup complete!');
    console.log('   Admin login: admin@nationalbeef.com / Nationalbeef1');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
