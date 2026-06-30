import { useEffect, useState } from 'react';
import { api } from '../api.js';

// Renders the Neo4j dependency graph as an adjacency view + on-click impact analysis.
export default function DependencyGraph({ satelliteId }) {
  const [nodes, setNodes] = useState([]);
  const [impact, setImpact] = useState(null);

  useEffect(() => {
    setImpact(null);
    api.graph(satelliteId).then((d) => setNodes(d.graph || [])).catch(() => setNodes([]));
  }, [satelliteId]);

  const modules = nodes.filter((n) => n.labels?.includes('Module'));

  async function analyze(moduleName) {
    const r = await api.impact(satelliteId, moduleName);
    setImpact(r);
  }

  return (
    <div className="graph">
      <p className="muted small">Click a module to run fault-tree impact analysis.</p>
      <div className="modules">
        {modules.map((m) => (
          <button key={m.name} className="module-node" onClick={() => analyze(m.name)}>
            {m.name}
            {m.dependsOn?.filter(Boolean).length > 0 && (
              <span className="muted small"> → {m.dependsOn.filter(Boolean).join(', ')}</span>
            )}
          </button>
        ))}
      </div>
      {impact && (
        <div className="impact">
          <strong>If {impact.failedModule} fails:</strong>{' '}
          {impact.affectedModules?.length
            ? `affects ${impact.affectedModules.join(', ')}`
            : 'no dependent modules affected'}
        </div>
      )}
    </div>
  );
}
