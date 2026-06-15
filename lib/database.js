/**
 * Database helper — runs SQL queries via the MCP protocol against the
 * managed MySQL database.
 *
 * Provides structured query building and convenience functions for all tables.
 * All database access in the app should go through this module.
 */

import { query } from './mcp-db';

// ── SQL helpers ──────────────────────────────────────────────────

function escapeValue(val) {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (typeof val === 'object') {
    return `'${JSON.stringify(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
  }
  return `'${String(val).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
}

function escapeColumn(col) {
  // Backtick-quote to handle reserved words like `last_value`
  if (col.includes('`') || col.includes('.') || col === '*') return col;
  return `\`${col}\``;
}

// ── Core query functions ─────────────────────────────────────────

/**
 * Execute a read query.
 * @param {string} table - Table name
 * @param {object} options - { where, orderBy, limit, offset, select }
 * @returns {Promise<{data: Array, total: number}>}
 */
export async function dbQuery(table, options = {}) {
  const { where, orderBy, limit = 50, offset = 0, select = '*' } = options;

  let sql = `SELECT ${select} FROM \`${table}\``;

  if (where && Object.keys(where).length > 0) {
    const conditions = Object.entries(where)
      .filter(([, val]) => val !== undefined)
      .map(([key, val]) => `${escapeColumn(key)} = ${escapeValue(val)}`)
      .join(' AND ');
    if (conditions) sql += ` WHERE ${conditions}`;
  }

  if (orderBy) sql += ` ORDER BY ${orderBy}`;
  sql += ` LIMIT ${limit}`;
  if (offset) sql += ` OFFSET ${offset}`;

  try {
    const result = await query(sql);
    return {
      data: result?.rows || [],
      total: result?.total_rows || 0,
    };
  } catch (error) {
    console.error(`[db] Query failed for table ${table}:`, error.message);
    return { data: [], total: 0 };
  }
}

/**
 * Execute a raw SQL query (for JOINs, aggregates, complex queries).
 * @param {string} sql - Raw SQL string
 * @returns {Promise<{data: Array, total: number, insertId: number|null, affectedRows: number}>}
 */
export async function dbRawQuery(sql) {
  try {
    const result = await query(sql);
    return {
      data: result?.rows || [],
      total: result?.total_rows || 0,
      insertId: result?.insertId || null,
      affectedRows: result?.affectedRows || 0,
    };
  } catch (error) {
    console.error('[db] Raw query failed:', error.message);
    return { data: [], total: 0, insertId: null, affectedRows: 0 };
  }
}

/**
 * Execute a write operation (INSERT, UPDATE, DELETE).
 * @param {string} table - Table name
 * @param {string} operation - 'insert' | 'update' | 'delete'
 * @param {object} data - Record data (for insert/update)
 * @param {object} where - Where clause (for update/delete)
 * @returns {Promise<{success: boolean, data?: any, id?: number, affectedRows?: number, message?: string}>}
 */
export async function dbWrite(table, operation, data, where = null) {
  let sql;

  try {
    switch (operation) {
      case 'insert': {
        const cols = Object.keys(data).map(escapeColumn).join(', ');
        const vals = Object.values(data).map(escapeValue).join(', ');
        sql = `INSERT INTO \`${table}\` (${cols}) VALUES (${vals})`;
        break;
      }
      case 'update': {
        const sets = Object.entries(data)
          .map(([key, val]) => `${escapeColumn(key)} = ${escapeValue(val)}`)
          .join(', ');
        sql = `UPDATE \`${table}\` SET ${sets}`;
        if (where && Object.keys(where).length > 0) {
          const conditions = Object.entries(where)
            .map(([key, val]) => `${escapeColumn(key)} = ${escapeValue(val)}`)
            .join(' AND ');
          sql += ` WHERE ${conditions}`;
        }
        break;
      }
      case 'delete': {
        sql = `DELETE FROM \`${table}\``;
        if (where && Object.keys(where).length > 0) {
          const conditions = Object.entries(where)
            .map(([key, val]) => `${escapeColumn(key)} = ${escapeValue(val)}`)
            .join(' AND ');
          sql += ` WHERE ${conditions}`;
        }
        break;
      }
      default:
        return { success: false, message: `Unknown operation: ${operation}` };
    }

    const result = await query(sql);
    return {
      success: true,
      data: result?.rows || null,
      id: result?.insertId || null,
      affectedRows: result?.affectedRows || 0,
    };
  } catch (error) {
    console.error(`[db] Write failed for table ${table}:`, error.message);
    return { success: false, message: error.message };
  }
}

// ── Convenience functions ──────────────────────────────────────

export async function getAlerts(facilityId, options = {}) {
  const result = await dbQuery('alerts', {
    where: { facility_id: facilityId, ...options.where },
    orderBy: 'created_at DESC',
    limit: options.limit || 20,
  });
  result.data = result.data.map((row) => {
    const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    return { ...row, metadata };
  });
  return result;
}

export async function getIncidents(facilityId, options = {}) {
  const result = await dbQuery('incidents', {
    where: { facility_id: facilityId, ...options.where },
    orderBy: 'created_at DESC',
    limit: options.limit || 20,
  });
  result.data = result.data.map((row) => {
    const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    return { ...row, metadata };
  });
  return result;
}

export async function getCameras(facilityId) {
  const result = await dbQuery('cameras', {
    where: { facility_id: facilityId },
    orderBy: 'name ASC',
    limit: 100,
  });

  // Parse JSON columns and map to UI-expected field names
  result.data = result.data.map((row) => {
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {});
    const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    return {
      ...row,
      config,
      metadata,
      // Fields expected by CameraFeedGrid and other UI components
      image: config.image || null,
      location: row.location_description || '',
      zone: config.zone || row.camera_type || 'Floor',
      // AI-related fields for production line cameras
      aiStatus: config.aiStatus || null,
      aiConfidence: config.aiConfidence || null,
      detections: config.detections || 0,
      cameraType: config.cameraType || row.camera_type,
      line: config.line || null,
      lineNumber: config.lineNumber || null,
    };
  });

  return result;
}

export async function getProductionLines(facilityId) {
  return dbQuery('production_lines', {
    where: { facility_id: facilityId },
    orderBy: 'line_number ASC',
  });
}

export async function getEmployees(facilityId, options = {}) {
  return dbQuery('employees', {
    where: { facility_id: facilityId, ...options.where },
    orderBy: 'last_name ASC',
    limit: options.limit || 50,
  });
}

export async function getDevices(facilityId) {
  const result = await dbQuery('iot_devices', {
    where: { facility_id: facilityId },
    orderBy: 'device_name ASC',
  });
  result.data = result.data.map((row) => {
    const config = typeof row.config === 'string' ? JSON.parse(row.config) : (row.config || {});
    const metadata = typeof row.metadata === 'string' ? JSON.parse(row.metadata) : (row.metadata || {});
    return { ...row, config, metadata };
  });
  return result;
}

export async function getDashboardStats(facilityId) {
  // Aggregate multiple queries in parallel for the dashboard
  const [cameras, alerts, employees, lines, devices] = await Promise.all([
    getCameras(facilityId),
    getAlerts(facilityId, { limit: 100 }),
    getEmployees(facilityId, { where: { status: 'active' } }),
    getProductionLines(facilityId),
    getDevices(facilityId),
  ]);

  const activeAlerts = alerts.data.filter(a => !a.acknowledged);
  const criticalAlerts = activeAlerts.filter(
    a => a.severity === 'critical' || a.severity === 'emergency'
  );
  const onlineCameras = cameras.data.filter(c => c.status === 'online');
  const runningLines = lines.data.filter(l => l.status === 'running');
  const onlineDevices = devices.data.filter(d => d.status === 'online');

  return {
    cameras: { online: onlineCameras.length, total: cameras.data.length },
    alerts: { active: activeAlerts.length, critical: criticalAlerts.length },
    employees: { onShift: employees.total, total: employees.total },
    productionLines: { running: runningLines.length, total: lines.data.length },
    devices: { online: onlineDevices.length, total: devices.data.length },
    safetyScore:
      criticalAlerts.length === 0
        ? 100
        : Math.max(0, 100 - criticalAlerts.length * 10),
  };
}
