// Runs all seed scripts in sequence.
import { execSync } from 'node:child_process';

const steps = ['seed-cassandra.js', 'seed-mongo.js', 'seed-neo4j.js'];
for (const s of steps) {
  console.log(`\n=== Running ${s} ===`);
  execSync(`node scripts/${s}`, { stdio: 'inherit' });
}
console.log('\nAll stores seeded ✔');
