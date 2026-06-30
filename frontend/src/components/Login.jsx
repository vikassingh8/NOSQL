import { useState } from 'react';

export default function Login({ onLogin }) {
  const [username, setUsername] = useState('mission');
  const [password, setPassword] = useState('mission123');
  const [error, setError] = useState('');

  async function submit(e) {
    e.preventDefault();
    setError('');
    try {
      await onLogin(username, password);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="login-wrap">
      <form className="login-card" onSubmit={submit}>
        <h1>🛰️ Mission Control</h1>
        <p className="muted">Orbital Telemetry Platform</p>
        <input value={username} onChange={(e) => setUsername(e.target.value)} placeholder="username" />
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
        />
        {error && <div className="error">{error}</div>}
        <button type="submit">Sign in</button>
        <p className="hint">try mission / mission123 · scientist / science123 · admin / admin123</p>
      </form>
    </div>
  );
}
