import mongoose from 'mongoose';
import { config } from '../config.js';

const { Schema } = mongoose;

// ─── Models ─────────────────────────────────────────────────────────────────
const SatelliteSchema = new Schema(
  {
    _id: String, // e.g. "SAT-01"
    name: String,
    orbit: String,
    launchedAt: Date,
    status: { type: String, default: 'NOMINAL' },
  },
  { _id: false, collection: 'satellites' }
);

const SensorSchema = new Schema(
  {
    _id: String, // e.g. "SAT-01:TEMP-3"
    satelliteId: { type: String, index: true },
    type: String,
    unit: String,
    module: String,
  },
  { _id: false, collection: 'sensors' }
);

const TelemetrySchema = new Schema(
  {
    satelliteId: { type: String, index: true },
    sensorId: String,
    type: String,
    value: Number,
    unit: String,
    status: String, // NOMINAL | WARNING | CRITICAL
    ts: Date,
    meta: Schema.Types.Mixed,
  },
  { collection: 'telemetry' }
);
TelemetrySchema.index({ satelliteId: 1, ts: -1 });
TelemetrySchema.index({ type: 1, ts: -1 });

const AlertSchema = new Schema(
  {
    satelliteId: { type: String, index: true },
    sensorId: String,
    type: String,
    value: Number,
    unit: String,
    severity: String, // warning | critical
    message: String,
    acknowledged: { type: Boolean, default: false },
    ts: { type: Date, index: true },
  },
  { collection: 'alerts' }
);

const FailureEventSchema = new Schema(
  {
    satelliteId: String,
    module: String,
    cause: String,
    ts: Date,
  },
  { collection: 'failure_events' }
);

const UserSchema = new Schema(
  {
    username: { type: String, unique: true },
    passwordHash: String,
    role: { type: String, enum: ['mission-ops', 'scientist', 'admin'], default: 'scientist' },
  },
  { collection: 'users' }
);

const AuditLogSchema = new Schema(
  {
    username: String,
    action: String,
    path: String,
    ts: { type: Date, default: Date.now },
  },
  { collection: 'audit_logs' }
);

export const models = {};

export async function connectMongo() {
  if (mongoose.connection.readyState === 1) return mongoose.connection;
  await mongoose.connect(config.mongo.uri, { dbName: config.mongo.db });

  models.Satellite = mongoose.models.Satellite || mongoose.model('Satellite', SatelliteSchema);
  models.Sensor = mongoose.models.Sensor || mongoose.model('Sensor', SensorSchema);
  models.Telemetry = mongoose.models.Telemetry || mongoose.model('Telemetry', TelemetrySchema);
  models.Alert = mongoose.models.Alert || mongoose.model('Alert', AlertSchema);
  models.FailureEvent =
    mongoose.models.FailureEvent || mongoose.model('FailureEvent', FailureEventSchema);
  models.User = mongoose.models.User || mongoose.model('User', UserSchema);
  models.AuditLog = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);

  return mongoose.connection;
}

export async function disconnectMongo() {
  await mongoose.disconnect();
}

export { mongoose };
