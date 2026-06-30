import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';

const app = createApp();

describe('api-service', () => {
  it('GET /healthz returns ok', async () => {
    const res = await request(app).get('/healthz');
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('GET /metrics exposes Prometheus text', async () => {
    const res = await request(app).get('/metrics');
    expect(res.status).toBe(200);
    expect(res.text).toContain('process_cpu_user_seconds_total');
  });

  it('protected route without token returns 401', async () => {
    const res = await request(app).get('/satellites');
    expect(res.status).toBe(401);
  });

  it('login with invalid body returns 400', async () => {
    const res = await request(app).post('/auth/login').send({ username: '' });
    expect(res.status).toBe(400);
  });
});
