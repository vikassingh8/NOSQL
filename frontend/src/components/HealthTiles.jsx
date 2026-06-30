import { useEffect, useState } from 'react';
import { api } from '../api.js';

const STATUS_COLOR = { NOMINAL: '#16a34a', WARNING: '#d97706', CRITICAL: '#dc2626' };

export default function HealthTiles({ satelliteId }) {
  const [health, setHealth] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    let active = true;
    const load = () =>
      api
        .health(satelliteId)
        .then((d) => active && (setHealth(d.health), setErr('')))
        .catch((e) => active && setErr(e.message));
    load();
    const t = setInterval(load, 3000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [satelliteId]);

  if (err) return <p className="muted">{err}</p>;
  if (!health) return <p className="muted">Loading…</p>;

  const { status, lastSeen, ...metrics } = health;
  return (
    <div>
      <div className="status-line">
        Status: <strong style={{ color: STATUS_COLOR[status] || '#888' }}>{status}</strong>
        <span className="muted"> · last seen {lastSeen && new Date(lastSeen).toLocaleTimeString()}</span>
      </div>
      <div className="tiles">
        {Object.entries(metrics).map(([k, v]) => (
          <div className="tile" key={k}>
            <div className="tile-label">{k}</div>
            <div className="tile-value">{Number(v).toFixed(1)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
