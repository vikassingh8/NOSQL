import { initTelemetry } from '@otp/shared/telemetry';
import { createApp } from './app.js';
import { config } from '@otp/shared/config';
import { createLogger } from '@otp/shared/logger';

await initTelemetry('api-service');
import { connectMongo } from '@otp/shared/db/mongo';
import { getRedis } from '@otp/shared/db/redis';
import { getCassandra } from '@otp/shared/db/cassandra';
import { getDriver } from '@otp/shared/db/neo4j';

const log = createLogger('api-service');

await connectMongo();
await getRedis();
await getCassandra();
getDriver();

const app = createApp();
app.listen(config.api.port, () => log.info(`API listening on :${config.api.port}`));
