import { useEffect, useState } from 'react';
import { api, getToken, setToken, clearToken, subscribeAlerts } from './api.js';
import Login from './components/Login.jsx';
import HealthTiles from './components/HealthTiles.jsx';
import TelemetryChart from './components/TelemetryChart.jsx';
import AlertsFeed from './components/AlertsFeed.jsx';
import DependencyGraph from './components/DependencyGraph.jsx';

export default function App() {
  const [authed, setAuthed] = useState(!!getToken());
  const [role, setRole] = useState(localStorage.getItem('otp_role') || '');
  const [satellites, setSatellites] = useState([]);
  const [selected, setSelected] = useState('');
  const [liveAlerts, setLiveAlerts] = useState([]);

  useEffect(() => {
    if (!authed) return;
    api
      .satellites()
      .then((d) => {
        const list = d.catalog?.map((s) => s._id) || d.live || [];
        setSatellites(list);
        if (list.length) setSelected(list[0]);
      })
      .catch((e) => {
        if (String(e.message).includes('401')) handleLogout();
      });
  }, [authed]);

  useEffect(() => {
    if (!authed) return;
    const unsub = subscribeAlerts((a) => setLiveAlerts((prev) => [a, ...prev].slice(0, 50)));
    return unsub;
  }, [authed]);

  async function handleLogin(username, password) {
    const { token, role } = await api.login(username, password);
    setToken(token);
    localStorage.setItem('otp_role', role);
    setRole(role);
    setAuthed(true);
  }
  function handleLogout() {
    clearToken();
    localStorage.removeItem('otp_role');
    setAuthed(false);
  }

  if (!authed) return <Login onLogin={handleLogin} />;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">🛰️ Orbital Telemetry — Mission Control</div>
        <div className="controls">
          <select value={selected} onChange={(e) => setSelected(e.target.value)}>
            {satellites.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <span className="role">{role}</span>
          <button onClick={handleLogout}>Logout</button>
        </div>
      </header>

      {selected && (
        <main className="grid">
          <section className="card span-2">
            <h2>Live Health — {selected}</h2>
            <HealthTiles satelliteId={selected} />
          </section>

          <section className="card span-2">
            <h2>Telemetry History</h2>
            <TelemetryChart satelliteId={selected} />
          </section>

          <section className="card">
            <h2>Live Alerts</h2>
            <AlertsFeed satelliteId={selected} liveAlerts={liveAlerts} />
          </section>

          <section className="card">
            <h2>Component Dependency / Fault Tree</h2>
            <DependencyGraph satelliteId={selected} />
          </section>
        </main>
      )}
    </div>
  );
}
