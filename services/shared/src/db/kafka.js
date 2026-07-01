import { Kafka, logLevel } from 'kafkajs';
import { config } from '../config.js';

let kafka;

export function getKafka() {
  if (kafka) return kafka;
  const opts = {
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
    logLevel: logLevel.ERROR,
    retry: { initialRetryTime: 300, retries: 10 },
  };
  // Managed Kafka (Azure Event Hubs): TLS + SASL/PLAIN.
  if (config.kafka.ssl) opts.ssl = true;
  if (config.kafka.saslMechanism) {
    opts.sasl = {
      mechanism: config.kafka.saslMechanism,
      username: config.kafka.saslUsername,
      password: config.kafka.saslPassword,
    };
  }
  kafka = new Kafka(opts);
  return kafka;
}

export async function createProducer() {
  const producer = getKafka().producer();
  await producer.connect();
  return producer;
}

export async function createConsumer(groupId) {
  const consumer = getKafka().consumer({ groupId });
  await consumer.connect();
  return consumer;
}
