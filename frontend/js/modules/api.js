/**
 * EcoTrack AI: API Client Module (api.js)
 * Provides typed, timeout-protected asynchronous HTTP interface to Flask backend.
 */

export class ApiError extends Error {
  constructor(message, status = null, code = 'API_ERROR') {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

const BASE_URL = '/api';
const DEFAULT_TIMEOUT_MS = 3000;

async function request(endpoint, options = {}) {
  const timeoutMs = options.timeout || DEFAULT_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${BASE_URL}${endpoint}`;
  try {
    const res = await fetch(url, {
      ...options,
      signal: controller.signal,
      headers: {
        'Accept': 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers
      }
    });
    clearTimeout(timer);

    const contentType = res.headers.get('content-type') || '';
    const data = contentType.includes('application/json') ? await res.json() : await res.text();

    if (!res.ok) {
      const msg = (data && typeof data === 'object' && data.error) ? data.error : `HTTP ${res.status}: ${res.statusText}`;
      throw new ApiError(msg, res.status, 'HTTP_ERROR');
    }
    return data;
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new ApiError(`Request to ${endpoint} timed out after ${timeoutMs}ms`, 408, 'TIMEOUT');
    }
    if (err instanceof ApiError) throw err;
    throw new ApiError(err.message || 'Network error', null, 'NETWORK_ERROR');
  }
}

export const API = {
  health() {
    return request('/health');
  },

  getFactors() {
    return request('/factors');
  },

  getConfig() {
    return request('/config');
  },

  saveActivity(activityData) {
    return request('/activities', {
      method: 'POST',
      body: JSON.stringify(activityData)
    });
  },

  listActivities(options = {}) {
    const params = new URLSearchParams();
    if (options.limit) params.set('limit', options.limit);
    if (options.category) params.set('category', options.category);
    const query = params.toString() ? `?${params.toString()}` : '';
    return request(`/activities${query}`);
  },

  deleteActivity(id) {
    return request(`/activities/${id}`, {
      method: 'DELETE'
    });
  },

  getSummary(days = 14) {
    return request(`/summary?days=${encodeURIComponent(days)}`);
  },

  predict(history, modifiers = {}) {
    return request('/predict', {
      method: 'POST',
      body: JSON.stringify({ history, modifiers })
    });
  },

  getRecommendations(dominantCategory = 'transport') {
    return request('/recommendations', {
      method: 'POST',
      body: JSON.stringify({ dominantCategory })
    });
  }
};
