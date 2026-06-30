import { Kafka, logLevel } from 'kafkajs';
import { config } from '../config.js';

let kafka;

export function getKafka() {
  if (kafka) return kafka;
  kafka = new Kafka({
    clientId: config.kafka.clientId,
    brokers: config.kafka.brokers,
    logLevel: logLevel.ERROR,
    retry: { initialRetryTime: 300, retries: 10 },
  });
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
