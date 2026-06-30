import { useEffect, useState } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { api } from '../api.js';

const SENSOR_TYPES = ['TEMPERATURE', 'BATTERY', 'VOLTAGE', 'SIGNAL', 'PRESSURE'];

export default function TelemetryChart({ satelliteId }) {
  const [sensorType, setSensorType] = useState('TEMPERATURE');
  const [data, setData] = useState([]);
  const [err, setErr] = useState('');

  useEffect(() => {
    let active = true;
    const sensorId = `${satelliteId}:${sensorType}`;
    const load = async () => {
      try {
        const { rows } = await api.history(satelliteId, sensorId, 100);
        if (!active) return;
        setData(
          rows
            .map((r) => ({
              t: new Date(r.event_time).toLocaleTimeString(),
              value: r.value,
            }))
            .reverse()
        );
        setErr('');
      } catch (e) {
        if (active) setErr(e.message);
      }
    };
    load();
    const t = setInterval(load, 5000);
    return () => {
      active = false;
      clearInterval(t);
    };
  }, [satelliteId, sensorType]);

  return (
    <div>
      <div className="chart-controls">
        {SENSOR_TYPES.map((s) => (
          <button
            key={s}
            className={s === sensorType ? 'pill active' : 'pill'}
            onClick={() => setSensorType(s)}
          >
            {s}
          </button>
        ))}
      </div>
      {err && <p className="muted">{err}</p>}
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" stroke="#22304a" />
          <XAxis dataKey="t" tick={{ fontSize: 10, fill: '#9fb3c8' }} minTickGap={40} />
          <YAxis tick={{ fontSize: 10, fill: '#9fb3c8' }} domain={['auto', 'auto']} />
          <Tooltip contentStyle={{ background: '#0f1a2e', border: '1px solid #22304a' }} />
          <Line type="monotone" dataKey="value" stroke="#38bdf8" dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
