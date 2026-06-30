import neo4j from 'neo4j-driver';
import { config } from '../config.js';

let driver;

export function getDriver() {
  if (driver) return driver;
  driver = neo4j.driver(
    config.neo4j.uri,
    neo4j.auth.basic(config.neo4j.user, config.neo4j.password)
  );
  return driver;
}

export async function runCypher(query, params = {}) {
  const session = getDriver().session();
  try {
    const res = await session.run(query, params);
    return res.records.map((r) => r.toObject());
  } finally {
    await session.close();
  }
}

// Fault-tree impact: given a failed module, what depends on it (transitively)?
export async function impactAnalysis(satelliteId, moduleName) {
  const query = `
    MATCH (sat:Satellite {id: $satelliteId})
    MATCH (failed:Module {name: $moduleName})-[:PART_OF*0..]->(sat)
    OPTIONAL MATCH (affected:Module)-[:DEPENDS_ON*1..]->(failed)
    RETURN failed.name AS failedModule,
           collect(DISTINCT affected.name) AS affectedModules`;
  const rows = await runCypher(query, { satelliteId, moduleName });
  return rows[0] || { failedModule: moduleName, affectedModules: [] };
}

// Full dependency graph for a satellite (for dashboard viz)
export async function dependencyGraph(satelliteId) {
  const query = `
    MATCH (sat:Satellite {id: $satelliteId})
    MATCH (n)-[:PART_OF*1..]->(sat)
    OPTIONAL MATCH (n)-[d:DEPENDS_ON]->(m)
    RETURN labels(n) AS labels, n.name AS name,
           collect(m.name) AS dependsOn`;
  return runCypher(query, { satelliteId });
}

export async function disconnectNeo4j() {
  if (driver) await driver.close();
  driver = undefined;
}
