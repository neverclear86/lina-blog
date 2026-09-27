import { describe, expect, it } from 'vitest';
import api from './api';

describe('api', () => {
	it('GET /api/health は 200 と { ok: true } を返す', async () => {
		const res = await api.request('/api/health');
		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ ok: true });
	});

	it('定義していないパスは 404 を返す', async () => {
		const res = await api.request('/api/unknown');
		expect(res.status).toBe(404);
	});
});
