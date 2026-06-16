#!/usr/bin/env node

/**
 * Quick diagnostic: verify the admin user exists and the password hash is valid.
 */

import bcrypt from 'bcryptjs';

const API_KEY = 'vntg_I8B07QTVVff24CXHEvE_UGg1GBIkkbWFxu-nojD3JuU';
const MCP_URL = 'https://mcp.intuidy.com/mcp';
const DB_ID = 10;

async function sql(query) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: Date.now(),
      method: 'tools/call',
      params: { name: 'execute_managed_db_query', arguments: { databaseId: DB_ID, query } },
    }),
  });

  const text = await res.text();
  for (const line of text.split('\n')) {
    if (line.startsWith('data: ')) {
      try { return JSON.parse(line.slice(6)); } catch {}
    }
  }
  try { return JSON.parse(text); } catch { return text; }
}

function parseRows(res) {
  const content = res?.result?.content?.[0]?.text;
  if (!content) return [];
  try {
    const parsed = JSON.parse(content);
    return parsed?.rows || [];
  } catch {
    return content;
  }
}

async function main() {
  console.log('=== Admin User Diagnostic ===\n');

  // 1. Check users table structure
  console.log('1. Users table columns:');
  const cols = parseRows(await sql(`SHOW COLUMNS FROM users`));
  if (Array.isArray(cols)) {
    cols.forEach(c => console.log(`   - ${c.Field} (${c.Type}) ${c.Null === 'YES' ? 'NULL' : 'NOT NULL'} ${c.Key || ''}`));
  } else {
    console.log('   Error:', cols);
  }

  // 2. Find admin user
  console.log('\n2. Looking up admin@nationalbeef.com:');
  const users = parseRows(await sql(`SELECT id, username, email, password_hash, first_name, last_name, role_id, status FROM users WHERE email = 'admin@nationalbeef.com'`));
  
  if (!Array.isArray(users) || users.length === 0) {
    console.log('   ❌ User NOT FOUND!');
    
    // Check all users
    console.log('\n   All users in table:');
    const allUsers = parseRows(await sql(`SELECT id, username, email, status FROM users LIMIT 20`));
    if (Array.isArray(allUsers)) {
      allUsers.forEach(u => console.log(`   - [${u.id}] ${u.email} (${u.status})`));
    }
    return;
  }

  const user = users[0];
  console.log(`   ✅ Found! ID: ${user.id}, Username: ${user.username}, Status: ${user.status}`);
  console.log(`   Role ID: ${user.role_id}`);
  console.log(`   Name: ${user.first_name} ${user.last_name}`);
  console.log(`   Hash exists: ${!!user.password_hash} (${user.password_hash?.length} chars)`);
  console.log(`   Hash prefix: ${user.password_hash?.slice(0, 20)}...`);

  // 3. Verify password
  console.log('\n3. Verifying password "Nationalbeef1":');
  const match = await bcrypt.compare('Nationalbeef1', user.password_hash);
  console.log(`   ${match ? '✅ Password MATCHES!' : '❌ Password does NOT match!'}`);

  // 4. Check role
  console.log('\n4. Checking role:');
  const roles = parseRows(await sql(`SELECT * FROM roles WHERE id = ${user.role_id}`));
  if (Array.isArray(roles) && roles.length > 0) {
    console.log(`   Role: ${JSON.stringify(roles[0])}`);
  } else {
    console.log('   ❌ Role not found for role_id:', user.role_id);
  }
}

main().catch(err => console.error('Fatal:', err));
