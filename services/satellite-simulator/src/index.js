// Satellite telemetry simulator — publishes realistic JSON packets to Kafka.
import { initTelemetry } from '@otp/shared/telemetry';
import { createProducer } from '@otp/shared/db/kafka';
import { config, THRESHOLDS } from '@otp/shared/config';
import { createLogger } from '@otp/shared/logger';

await initTelemetry('satellite-simulator');

const log = createLogger('simulator');

const SENSORS = [
  { type: 'temperature', unit: 'C', nominal: () => 20 + Math.random() * 30 },
  { type: 'battery', unit: '%', nominal: () => 60 + Math.random() * 40 },
  { type: 'voltage', unit: 'V', nominal: () => 26 + Math.random() * 6 },
  { type: 'signal', unit: 'dBm', nominal: () => -70 + Math.random() * 25 },
  { type: 'pressure', unit: 'kPa', nominal: () => 98 + Math.random() * 6 },
];

// Occasionally push a value into the critical range to exercise the alert path.
function maybeAnomalous(sensor, value) {
  if (Math.random() > config.simulator.anomalyRate) return value;
  const t = THRESHOLDS[sensor.type];
  if (sensor.type === 'battery') return t.critical - Math.random() * 10; // drained
  if (sensor.type === 'signal') return t.critical - Math.random() * 10; // signal loss
  return t.critical + Math.random() * 15; // overheat / overpressure / overvolt
}

const producer = await createProducer();
log.info({ brokers: config.kafka.brokers, topic: config.kafka.telemetryTopic }, 'simulator started');

let count = 0;
const tick = async () => {
  const messages = [];
  for (const sat of config.simulator.satellites) {
    for (const sensor of SENSORS) {
      const value = Number(maybeAnomalous(sensor, sensor.nominal()).toFixed(2));
      const packet = {
        satelliteId: sat,
        sensorId: `${sat}:${sensor.type.toUpperCase()}`,
        type: sensor.type,
        value,
        unit: sensor.unit,
        ts: new Date().toISOString(),
        meta: { orbit: 'LEO', fw: '1.4.2' },
      };
      messages.push({ key: sat, value: JSON.stringify(packet) });
    }
  }
  await producer.send({ topic: config.kafka.telemetryTopic, messages });
  count += messages.length;
  if (count % 100 < messages.length) log.info({ sent: count }, 'telemetry published');
};

const timer = setInterval(() => tick().catch((e) => log.error(e, 'tick failed')), config.simulator.intervalMs);

const shutdown = async () => {
  clearInterval(timer);
  await producer.disconnect();
  log.info('simulator stopped');
  process.exit(0);
};
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
