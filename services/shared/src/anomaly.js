import { THRESHOLDS } from './config.js';

// Rolling-window state per sensor for z-score detection (in-memory; resets on restart)
const windows = new Map();
const WINDOW_SIZE = 30;

function pushWindow(key, value) {
  let w = windows.get(key);
  if (!w) {
    w = [];
    windows.set(key, w);
  }
  w.push(value);
  if (w.length > WINDOW_SIZE) w.shift();
  return w;
}

function zScore(w, value) {
  if (w.length < 5) return 0;
  const mean = w.reduce((a, b) => a + b, 0) / w.length;
  const variance = w.reduce((a, b) => a + (b - mean) ** 2, 0) / w.length;
  const std = Math.sqrt(variance);
  return std === 0 ? 0 : (value - mean) / std;
}

/**
 * Evaluate a telemetry packet for anomalies.
 * Combines static operating thresholds with a rolling z-score outlier check.
 * Returns { status, severity, message } where status is NOMINAL | WARNING | CRITICAL.
 */
export function evaluate(packet) {
  const { satelliteId, sensorId, type, value, unit } = packet;
  const t = THRESHOLDS[type];
  const key = `${satelliteId}:${sensorId}`;
  const w = pushWindow(key, value);
  const z = zScore(w, value);

  let status = 'NOMINAL';
  let severity = null;
  let message = null;

  if (t) {
    const breachesCritical =
      (t.critical !== undefined && t.unit !== '%' && value >= t.critical) ||
      (t.unit === '%' && value <= t.critical) ||
      (type === 'signal' && value <= t.critical);

    if (breachesCritical) {
      status = 'CRITICAL';
      severity = 'critical';
      message = `${type} on ${sensorId} reached critical level ${value}${unit}`;
    } else if (value < t.min || value > t.max) {
      status = 'WARNING';
      severity = 'warning';
      message = `${type} on ${sensorId} out of nominal range (${value}${unit}, expected ${t.min}-${t.max}${unit})`;
    }
  }

  // Statistical outlier even if within static bounds
  if (status === 'NOMINAL' && Math.abs(z) >= 3) {
    status = 'WARNING';
    severity = 'warning';
    message = `${type} on ${sensorId} statistical anomaly (z=${z.toFixed(2)})`;
  }

  return { status, severity, message, z };
}

export default { evaluate };
