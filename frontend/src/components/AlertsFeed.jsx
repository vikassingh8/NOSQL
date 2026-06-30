import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function AlertsFeed({ satelliteId, liveAlerts }) {
  const [historical, setHistorical] = useState([]);

  useEffect(() => {
    api.alerts(satelliteId).then((d) => setHistorical(d.alerts || [])).catch(() => {});
  }, [satelliteId]);

  // Merge live (newest first) with historical, de-dupe roughly by ts+sensor
  const merged = [...liveAlerts.filter((a) => a.satelliteId === satelliteId), ...historical].slice(0, 40);

  if (!merged.length) return <p className="muted">No alerts — all systems nominal.</p>;

  return (
    <ul className="alerts">
      {merged.map((a, i) => (
        <li key={a._id || `${a.ts}-${i}`} className={`alert ${a.severity}`}>
          <span className="badge">{a.severity}</span>
          <div>
            <div className="alert-msg">{a.message}</div>
            <div className="muted small">
              {a.sensorId} · {new Date(a.ts).toLocaleTimeString()}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
