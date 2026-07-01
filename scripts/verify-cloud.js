// Temporary connectivity probe for the Azure-hosted DBs (Mongo/Redis/Cassandra).
import { connectMongo, disconnectMongo, models } from '@otp/shared/db/mongo';
import { getRedis, disconnectRedis } from '@otp/shared/db/redis';
import { rawClient, disconnectCassandra } from '@otp/shared/db/cassandra';

let ok = true;

try {
  await connectMongo();
  const n = await models.Satellite.countDocuments();
  console.log(`[mongo]     OK  — connected, satellites collection count = ${n}`);
} catch (e) {
  ok = false;
  console.error('[mongo]     FAIL —', e.message);
}

try {
  const c = await getRedis();
  await c.set('otp:healthcheck', 'ok', { EX: 30 });
  const v = await c.get('otp:healthcheck');
  console.log(`[redis]     OK  — set/get roundtrip = ${v}`);
} catch (e) {
  ok = false;
  console.error('[redis]     FAIL —', e.message);
}

const cass = rawClient();
try {
  await cass.connect();
  const rs = await cass.execute('SELECT cluster_name FROM system.local');
  console.log(`[cassandra] OK  — connected to cluster "${rs.rows[0]?.cluster_name ?? 'cosmos'}"`);
} catch (e) {
  ok = false;
  console.error('[cassandra] FAIL —', e.message);
}

await Promise.allSettled([disconnectMongo(), disconnectRedis(), cass.shutdown(), disconnectCassandra()]);
console.log(ok ? '\nALL CLOUD DBS REACHABLE ✔' : '\nSOME CONNECTIONS FAILED �’');
process.exit(ok ? 0 : 1);
