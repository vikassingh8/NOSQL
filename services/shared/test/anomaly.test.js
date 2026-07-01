import { describe, it, expect } from 'vitest';
import { evaluate } from '../src/anomaly.js';

const base = { satelliteId: 'SAT-01', sensorId: 'SAT-01:TEMPERATURE', unit: 'C' };

describe('anomaly.evaluate — static thresholds', () => {
  it('flags a high-temperature critical breach', () => {
    const r = evaluate({ ...base, type: 'temperature', value: 95 });
    expect(r.status).toBe('CRITICAL');
    expect(r.severity).toBe('critical');
    expect(r.message).toMatch(/critical/i);
  });

  it('flags an out-of-range warning (above max, below critical)', () => {
    const r = evaluate({ ...base, type: 'temperature', value: 85 });
    expect(r.status).toBe('WARNING');
    expect(r.severity).toBe('warning');
  });

  it('treats a nominal reading as NOMINAL', () => {
    const r = evaluate({ ...base, type: 'temperature', value: 25 });
    expect(r.status).toBe('NOMINAL');
    expect(r.severity).toBeNull();
  });

  it('handles percent-style sensors where low is critical (battery)', () => {
    const r = evaluate({
      satelliteId: 'SAT-02',
      sensorId: 'SAT-02:BATTERY',
      unit: '%',
      type: 'battery',
      value: 15,
    });
    expect(r.status).toBe('CRITICAL');
  });

  it('handles signal sensors where low dBm is critical', () => {
    const r = evaluate({
      satelliteId: 'SAT-03',
      sensorId: 'SAT-03:SIGNAL',
      unit: 'dBm',
      type: 'signal',
      value: -105,
    });
    expect(r.status).toBe('CRITICAL');
  });
});

describe('anomaly.evaluate — statistical outlier', () => {
  it('flags a z-score spike even within static bounds', () => {
    const s = { satelliteId: 'SAT-09', sensorId: 'SAT-09:VOLTAGE', unit: 'V', type: 'voltage' };
    // Build a tight in-range window around ~28V
    for (let i = 0; i < 20; i++) evaluate({ ...s, value: 28 + (i % 2 === 0 ? 0.1 : -0.1) });
    const r = evaluate({ ...s, value: 32 }); // still within 22..34 but far from the mean
    expect(r.status).toBe('WARNING');
    expect(Math.abs(r.z)).toBeGreaterThanOrEqual(3);
  });
});
