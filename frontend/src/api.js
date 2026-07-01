// Thin API client. Token stored in localStorage; all calls go through the Vite proxy.
const API = '/api';
const ALERTS_API = '/alerts-api';

export function getToken() {
  return localStorage.getItem('otp_token');
}
export function setToken(t) {
  localStorage.setItem('otp_token', t);
}
export function clearToken() {
  localStorage.removeItem('otp_token');
}

async function req(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    headers: {
      'Content-Type': 'application/json',
      ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}),
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `HTTP ${res.status}`);
  return res.json();
}

export const api = {
  login: (username, password) =>
    req('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  satellites: () => req('/satellites'),
  health: (id) => req(`/satellites/${id}/health`),
  snapshot: (id) => req(`/telemetry/${id}/snapshot`),
  history: (id, sensorId, limit = 100) =>
    req(`/telemetry/${id}/history?sensorId=${encodeURIComponent(sensorId)}&limit=${limit}`),
  graph: (id) => req(`/graph/${id}`),
  impact: (id, module) => req(`/graph/${id}/impact?module=${encodeURIComponent(module)}`),
  alerts: (id) => req(`/alerts${id ? `?satelliteId=${id}` : ''}`),
  ackAlert: (alertId) => req(`/alerts/${alertId}/ack`, { method: 'PATCH' }),
};

// Live alert stream via SSE (served by alert-service)
export function subscribeAlerts(onAlert) {
  const es = new EventSource(`${ALERTS_API}/alerts/stream`);
  es.onmessage = (e) => {
    try {
      onAlert(JSON.parse(e.data));
    } catch { /* ignore */ }
  };
  return () => es.close();
}
