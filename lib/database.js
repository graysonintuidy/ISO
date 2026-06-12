/**
 * Database helper — runs queries via Vantage workflow execution.
 * All database access goes through Vantage's MySQL Connector nodes.
 *
 * In production, each query type would map to a Vantage workflow.
 * For now, this provides the interface and falls back to returning
 * empty results when workflows aren't yet configured.
 */

import vantage from './vantage';

// Workflow IDs — will be populated once workflows are created in Vantage
const WORKFLOW_IDS = {
  DB_QUERY: process.env.VANTAGE_DB_QUERY_WORKFLOW_ID || null,
  DB_WRITE: process.env.VANTAGE_DB_WRITE_WORKFLOW_ID || null,
};

/**
 * Execute a read query via Vantage.
 * @param {string} table - Table name
 * @param {object} options - { where, orderBy, limit, offset, select }
 */
export async function dbQuery(table, options = {}) {
  const { where, orderBy, limit = 50, offset = 0, select = '*' } = options;

  if (!WORKFLOW_IDS.DB_QUERY) {
    console.warn('[db] No DB_QUERY workflow configured. Returning empty results.');
    return { data: [], total: 0 };
  }

  try {
    const result = await vantage.executeWorkflow(WORKFLOW_IDS.DB_QUERY, {
      table,
      select,
      where: where || {},
      orderBy: orderBy || 'created_at DESC',
      limit,
      offset,
    });

    return {
      data: result?.data || [],
      total: result?.total || 0,
    };
  } catch (error) {
    console.error(`[db] Query failed for table ${table}:`, error.message);
    return { data: [], total: 0 };
  }
}

/**
 * Execute a write operation via Vantage.
 * @param {string} table - Table name
 * @param {string} operation - 'insert' | 'update' | 'delete'
 * @param {object} data - Record data
 * @param {object} where - Where clause for update/delete
 */
export async function dbWrite(table, operation, data, where = null) {
  if (!WORKFLOW_IDS.DB_WRITE) {
    console.warn('[db] No DB_WRITE workflow configured. Skipping write.');
    return { success: false, message: 'No workflow configured' };
  }

  try {
    const result = await vantage.executeWorkflow(WORKFLOW_IDS.DB_WRITE, {
      table,
      operation,
      data,
      where,
    });

    return {
      success: true,
      data: result?.data || null,
      id: result?.insertId || null,
    };
  } catch (error) {
    console.error(`[db] Write failed for table ${table}:`, error.message);
    return { success: false, message: error.message };
  }
}

// ── Convenience functions ──────────────────────────────────────

export async function getAlerts(facilityId, options = {}) {
  return dbQuery('alerts', {
    where: { facility_id: facilityId, ...options.where },
    orderBy: 'created_at DESC',
    limit: options.limit || 20,
  });
}

export async function getIncidents(facilityId, options = {}) {
  return dbQuery('incidents', {
    where: { facility_id: facilityId, ...options.where },
    orderBy: 'created_at DESC',
    limit: options.limit || 20,
  });
}

export async function getCameras(facilityId) {
  return dbQuery('cameras', {
    where: { facility_id: facilityId },
    orderBy: 'name ASC',
  });
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
  return dbQuery('iot_devices', {
    where: { facility_id: facilityId },
    orderBy: 'device_name ASC',
  });
}

export async function getDashboardStats(facilityId) {
  // This would ideally be a single workflow that aggregates multiple queries
  const [cameras, alerts, employees, lines, devices] = await Promise.all([
    getCameras(facilityId),
    getAlerts(facilityId, { limit: 100 }),
    getEmployees(facilityId, { where: { status: 'active' } }),
    getProductionLines(facilityId),
    getDevices(facilityId),
  ]);

  const activeAlerts = alerts.data.filter(a => !a.acknowledged);
  const criticalAlerts = activeAlerts.filter(a => a.severity === 'critical' || a.severity === 'emergency');
  const onlineCameras = cameras.data.filter(c => c.status === 'online');
  const runningLines = lines.data.filter(l => l.status === 'running');
  const onlineDevices = devices.data.filter(d => d.status === 'online');

  return {
    cameras: { online: onlineCameras.length, total: cameras.total },
    alerts: { active: activeAlerts.length, critical: criticalAlerts.length },
    employees: { onShift: employees.total, total: employees.total },
    productionLines: { running: runningLines.length, total: lines.total },
    devices: { online: onlineDevices.length, total: devices.total },
    safetyScore: criticalAlerts.length === 0 ? 100 : Math.max(0, 100 - (criticalAlerts.length * 10)),
  };
}
