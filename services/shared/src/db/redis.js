import { createClient } from 'redis';
import { config } from '../config.js';

let client;

export async function getRedis() {
  if (client?.isOpen) return client;
  client = createClient({ url: config.redis.url });
  client.on('error', (err) => console.error('[redis] error', err.message));
  await client.connect();
  return client;
}

// ─── Health status helpers (key-value model) ─────────────────────────────────
export const keys = {
  satHealth: (id) => `sat:${id}:health`,
  sensorLatest: (id) => `sensor:${id}:latest`,
  satSet: () => 'satellites:all',
};

export async function updateHealth(satelliteId, sensorType, value, status) {
  const c = await getRedis();
  const key = keys.satHealth(satelliteId);
  await c.hSet(key, {
    [sensorType]: String(value),
    status,
    lastSeen: new Date().toISOString(),
  });
  await c.expire(key, config.redis.healthTtl);
  await c.sAdd(keys.satSet(), satelliteId);
}

export async function setSensorLatest(sensorId, payload) {
  const c = await getRedis();
  await c.set(keys.sensorLatest(sensorId), JSON.stringify(payload), {
    EX: config.redis.healthTtl,
  });
}

export async function getHealth(satelliteId) {
  const c = await getRedis();
  return c.hGetAll(keys.satHealth(satelliteId));
}

export async function listSatellites() {
  const c = await getRedis();
  return c.sMembers(keys.satSet());
}

export async function disconnectRedis() {
  if (client?.isOpen) await client.quit();
}
