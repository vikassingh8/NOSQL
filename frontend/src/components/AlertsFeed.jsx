import { useEffect, useState } from 'react';
import { api } from '../api.js';

export default function AlertsFeed({ satelliteId, liveAlerts }) {
  const [historical, setHistorical] = useState([]);
  const [acked, setAcked] = useState({}); // id -> ackedBy (optimistic local overlay)

  useEffect(() => {
    api.alerts(satelliteId).then((d) => setHistorical(d.alerts || [])).catch(() => {});
  }, [satelliteId]);

  async function acknowledge(id) {
    try {
      const { alert } = await api.ackAlert(id);
      setAcked((prev) => ({ ...prev, [id]: alert.ackedBy || 'you' }));
    } catch (e) {
      // eslint-disable-next-line no-alert
      alert(`Could not acknowledge: ${e.message}`);
    }
  }

  // Merge live (newest first) with historical, de-dupe roughly by ts+sensor
  const merged = [...liveAlerts.filter((a) => a.satelliteId === satelliteId), ...historical].slice(0, 40);

  if (!merged.length) return <p className="muted">No alerts — all systems nominal.</p>;

  return (
    <ul className="alerts">
      {merged.map((a, i) => {
        const ackedBy = acked[a._id] || (a.acknowledged ? a.ackedBy || 'ack' : null);
        return (
          <li key={a._id || `${a.ts}-${i}`} className={`alert ${a.severity}`}>
            <span className="badge">{a.severity}</span>
            <div>
              <div className="alert-msg">{a.message}</div>
              <div className="muted small">
                {a.sensorId} · {new Date(a.ts).toLocaleTimeString()}
              </div>
            </div>
            {a._id && (
              ackedBy ? (
                <span className="muted small ack-tag">✓ ack {ackedBy}</span>
              ) : (
                <button className="ack-btn" onClick={() => acknowledge(a._id)}>
                  Acknowledge
                </button>
              )
            )}
          </li>
        );
      })}
    </ul>
  );
}
