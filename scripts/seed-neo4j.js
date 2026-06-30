// Seeds the component dependency / fault-tree graph for each satellite (idempotent).
import { runCypher, disconnectNeo4j } from '@otp/shared/db/neo4j';
import { config } from '@otp/shared/config';

const SATELLITES = config.simulator.satellites;

// Subsystem → modules → sensors hierarchy, plus inter-module dependencies.
const TOPOLOGY = {
  Power: { modules: ['BatteryPack', 'SolarArray', 'PowerBus'], sensors: ['BATTERY', 'VOLTAGE'] },
  Thermal: { modules: ['Radiator', 'Heater'], sensors: ['TEMPERATURE'] },
  Comms: { modules: ['Transceiver', 'Antenna'], sensors: ['SIGNAL'] },
  Propulsion: { modules: ['Thruster', 'FuelTank'], sensors: ['PRESSURE'] },
};

// Module-level dependencies (failure of A affects B): B DEPENDS_ON A
const DEPENDENCIES = [
  ['Transceiver', 'PowerBus'],
  ['Heater', 'PowerBus'],
  ['Thruster', 'PowerBus'],
  ['PowerBus', 'BatteryPack'],
  ['BatteryPack', 'SolarArray'],
  ['Antenna', 'Transceiver'],
];

await runCypher('CREATE CONSTRAINT sat_id IF NOT EXISTS FOR (s:Satellite) REQUIRE s.id IS UNIQUE');

for (const sat of SATELLITES) {
  await runCypher('MERGE (s:Satellite {id: $id}) SET s.name = $name', {
    id: sat,
    name: `Orbital ${sat}`,
  });

  for (const [subsystem, def] of Object.entries(TOPOLOGY)) {
    await runCypher(
      `MATCH (s:Satellite {id: $sat})
       MERGE (sub:Subsystem {name: $subsystem, sat: $sat})
       MERGE (sub)-[:PART_OF]->(s)`,
      { sat, subsystem }
    );
    for (const mod of def.modules) {
      await runCypher(
        `MATCH (sub:Subsystem {name: $subsystem, sat: $sat})
         MERGE (m:Module {name: $mod, sat: $sat})
         MERGE (m)-[:PART_OF]->(sub)`,
        { sat, subsystem, mod }
      );
    }
  }

  for (const [child, parent] of DEPENDENCIES) {
    await runCypher(
      `MATCH (a:Module {name: $child, sat: $sat}), (b:Module {name: $parent, sat: $sat})
       MERGE (a)-[:DEPENDS_ON]->(b)`,
      { sat, child, parent }
    );
  }
}

console.log(`[neo4j] seeded dependency graph for ${SATELLITES.length} satellites ✔`);
await disconnectNeo4j();
