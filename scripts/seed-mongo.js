// Seeds satellites, sensors, and demo users into MongoDB (idempotent).
import bcrypt from 'bcryptjs';
import { connectMongo, models, disconnectMongo } from '@otp/shared/db/mongo';
import { config } from '@otp/shared/config';

const SATELLITES = config.simulator.satellites;
const SENSOR_TYPES = [
  { type: 'temperature', unit: 'C', module: 'Thermal' },
  { type: 'battery', unit: '%', module: 'Power' },
  { type: 'voltage', unit: 'V', module: 'Power' },
  { type: 'signal', unit: 'dBm', module: 'Comms' },
  { type: 'pressure', unit: 'kPa', module: 'Propulsion' },
];

await connectMongo();

// Satellites
for (const id of SATELLITES) {
  await models.Satellite.updateOne(
    { _id: id },
    { _id: id, name: `Orbital ${id}`, orbit: 'LEO', launchedAt: new Date('2024-01-01'), status: 'NOMINAL' },
    { upsert: true }
  );
  // Sensors per satellite
  for (const s of SENSOR_TYPES) {
    const sensorId = `${id}:${s.type.toUpperCase()}`;
    await models.Sensor.updateOne(
      { _id: sensorId },
      { _id: sensorId, satelliteId: id, type: s.type, unit: s.unit, module: s.module },
      { upsert: true }
    );
  }
}

// Demo users (RBAC roles)
const users = [
  { username: 'mission', password: 'mission123', role: 'mission-ops' },
  { username: 'scientist', password: 'science123', role: 'scientist' },
  { username: 'admin', password: 'admin123', role: 'admin' },
];
for (const u of users) {
  await models.User.updateOne(
    { username: u.username },
    { username: u.username, passwordHash: await bcrypt.hash(u.password, 10), role: u.role },
    { upsert: true }
  );
}

console.log(`[mongo] seeded ${SATELLITES.length} satellites, ${SATELLITES.length * SENSOR_TYPES.length} sensors, ${users.length} users ✔`);
console.log('[mongo] logins → mission/mission123, scientist/science123, admin/admin123');
await disconnectMongo();
