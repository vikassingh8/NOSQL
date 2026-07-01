import { describe, it, expect } from 'vitest';
import { TelemetryPacketSchema, AlertSchema, LoginSchema } from '../src/schemas.js';

describe('TelemetryPacketSchema', () => {
  const valid = {
    satelliteId: 'SAT-01',
    sensorId: 'SAT-01:TEMPERATURE',
    type: 'temperature',
    value: 21.5,
    unit: 'C',
    ts: '2026-07-01T00:00:00.000Z',
  };

  it('accepts a valid packet', () => {
    expect(TelemetryPacketSchema.safeParse(valid).success).toBe(true);
  });

  it('accepts a numeric epoch ts', () => {
    expect(TelemetryPacketSchema.safeParse({ ...valid, ts: 1751328000000 }).success).toBe(true);
  });

  it('rejects an unknown sensor type', () => {
    expect(TelemetryPacketSchema.safeParse({ ...valid, type: 'radiation' }).success).toBe(false);
  });

  it('rejects a non-finite value', () => {
    expect(TelemetryPacketSchema.safeParse({ ...valid, value: Infinity }).success).toBe(false);
  });

  it('rejects a missing satelliteId', () => {
    const rest = { ...valid };
    delete rest.satelliteId;
    expect(TelemetryPacketSchema.safeParse(rest).success).toBe(false);
  });
});

describe('AlertSchema', () => {
  it('rejects an invalid severity', () => {
    const r = AlertSchema.safeParse({
      satelliteId: 'SAT-01',
      sensorId: 'SAT-01:TEMPERATURE',
      type: 'temperature',
      value: 95,
      unit: 'C',
      severity: 'fatal',
      message: 'x',
      ts: '2026-07-01T00:00:00.000Z',
    });
    expect(r.success).toBe(false);
  });
});

describe('LoginSchema', () => {
  it('rejects empty username', () => {
    expect(LoginSchema.safeParse({ username: '', password: 'x' }).success).toBe(false);
  });
});
