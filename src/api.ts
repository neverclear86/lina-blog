import { Hono } from "hono";

/**
 * Routes that the Worker handles itself, mounted by `src/fetch.ts` before the Astro handlers.
 * Kept separate from the Astro pipeline so it can be tested with `app.request()`.
 */
const api = new Hono();

api.get("/api/health", (c) => c.json({ ok: true }));

export default api;
