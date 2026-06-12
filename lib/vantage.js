/**
 * Vantage API Client
 * Server-side only — keeps the API key secure.
 *
 * Handles all communication with the Vantage REST API.
 */

const API_KEY = process.env.VANTAGE_API_KEY;
const API_BASE = process.env.VANTAGE_API_BASE || 'https://vantage.intuidy.com/api/v1/';

class VantageError extends Error {
  constructor(message, status, data) {
    super(message);
    this.name = 'VantageError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Make an authenticated request to the Vantage API.
 */
async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint.replace(/^\//, '')}`;

  const config = {
    ...options,
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  };

  if (options.body && typeof options.body === 'object') {
    config.body = JSON.stringify(options.body);
  }

  let lastError;

  // Retry up to 3 times with exponential backoff
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new VantageError(
          `Vantage API error: ${response.status} ${response.statusText}`,
          response.status,
          errorData
        );
      }

      const data = await response.json().catch(() => null);
      return data;
    } catch (error) {
      lastError = error;

      // Don't retry on 4xx errors (client errors)
      if (error instanceof VantageError && error.status >= 400 && error.status < 500) {
        throw error;
      }

      // Exponential backoff: 500ms, 1000ms, 2000ms
      if (attempt < 2) {
        await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, attempt)));
      }
    }
  }

  throw lastError;
}

/**
 * Vantage API client methods
 */
const vantage = {
  // ── Workflows ──────────────────────────────────────────────
  async listWorkflows() {
    return request('workflows');
  },

  async getWorkflow(workflowId) {
    return request(`workflows/${workflowId}`);
  },

  async executeWorkflow(workflowId, input = {}) {
    return request(`workflows/${workflowId}/execute`, {
      method: 'POST',
      body: input,
    });
  },

  async getWorkflowStatus(executionId) {
    return request(`workflows/executions/${executionId}`);
  },

  // ── Key Info ───────────────────────────────────────────────
  async getKeyInfo() {
    return request('key-info');
  },

  // ── Generic request for custom endpoints ───────────────────
  async get(endpoint) {
    return request(endpoint, { method: 'GET' });
  },

  async post(endpoint, body) {
    return request(endpoint, { method: 'POST', body });
  },

  async put(endpoint, body) {
    return request(endpoint, { method: 'PUT', body });
  },

  async del(endpoint) {
    return request(endpoint, { method: 'DELETE' });
  },
};

export default vantage;
export { VantageError };
