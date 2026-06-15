/**
 * MCP Database Client — executes SQL queries against the managed MySQL database
 * via the Vantage MCP protocol.
 *
 * The Vantage MCP server is stateless (no session ID needed).
 * Each request is authenticated via the API key and can directly call tools.
 */

const MCP_URL = 'https://mcp.intuidy.com/mcp';
const DB_ID = 10;

function getApiKey() {
  const key = process.env.VANTAGE_API_KEY;
  if (!key) throw new Error('[mcp-db] VANTAGE_API_KEY environment variable is not set');
  return key;
}

/**
 * Send a JSON-RPC request to the MCP server.
 * Handles both plain JSON and SSE (Server-Sent Events) response formats.
 */
async function mcpPost(payload) {
  const res = await fetch(MCP_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${getApiKey()}`,
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();

  // The server returns SSE format: "event: message\ndata: {...}\n"
  // Try to parse SSE data lines first, then fall back to plain JSON
  const lines = text.split('\n');
  for (const line of lines) {
    if (line.startsWith('data: ')) {
      try {
        return JSON.parse(line.slice(6));
      } catch { /* continue to next line */ }
    }
  }

  // Fall back to plain JSON
  try {
    return JSON.parse(text);
  } catch {
    // Empty response (e.g. from notifications) — return null
    if (!text.trim()) return null;
    throw new Error(`[mcp-db] Unparseable response: ${text.slice(0, 200)}`);
  }
}

function parseResult(res) {
  const content = res?.result?.content?.[0]?.text;
  if (!content) return { rows: [], total_rows: 0, truncated: false };

  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`[mcp-db] SQL error: ${content}`);
  }

  // Check for SQL error messages returned as strings
  if (typeof parsed === 'string') {
    if (parsed.toLowerCase().includes('error')) {
      throw new Error(`[mcp-db] ${parsed}`);
    }
    return { rows: [], total_rows: 0, truncated: false };
  }

  return parsed;
}

/**
 * Execute a SQL query against the managed database.
 * @param {string} sql - The SQL query to execute
 * @returns {Promise<{rows: Array, total_rows: number, truncated: boolean}>}
 */
export async function query(sql) {
  const res = await mcpPost({
    jsonrpc: '2.0',
    id: Date.now(),
    method: 'tools/call',
    params: {
      name: 'execute_managed_db_query',
      arguments: { databaseId: DB_ID, query: sql },
    },
  });

  if (res?.error) {
    throw new Error(`[mcp-db] Query failed: ${res.error.message || JSON.stringify(res.error)}`);
  }

  return parseResult(res);
}
