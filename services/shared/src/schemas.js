import { z } from 'zod';

export const SENSOR_TYPES = ['temperature', 'battery', 'voltage', 'signal', 'pressure'];

// Incoming raw telemetry packet (what the simulator / satellites publish to Kafka)
export const TelemetryPacketSchema = z.object({
  satelliteId: z.string().min(1),
  sensorId: z.string().min(1),
  type: z.enum(SENSOR_TYPES),
  value: z.number().finite(),
  unit: z.string().min(1),
  ts: z.string().datetime().or(z.number()),
  meta: z
    .object({
      orbit: z.string().optional(),
      fw: z.string().optional(),
    })
    .partial()
    .optional(),
});

// Alert emitted when a threshold is breached
export const AlertSchema = z.object({
  satelliteId: z.string(),
  sensorId: z.string(),
  type: z.string(),
  value: z.number(),
  unit: z.string(),
  severity: z.enum(['warning', 'critical']),
  message: z.string(),
  ts: z.string().datetime(),
});

// Auth: login request
export const LoginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

// History query params
export const HistoryQuerySchema = z.object({
  sensorId: z.string().optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  limit: z.coerce.number().int().min(1).max(5000).default(500),
});

export default { TelemetryPacketSchema, AlertSchema, LoginSchema, HistoryQuerySchema, SENSOR_TYPES };
