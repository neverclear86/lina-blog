import { type Context, Hono } from "hono";
import { negotiateLocale } from "./i18n/negotiate";

/**
 * Routes that the Worker handles itself, mounted by `src/fetch.ts` before the Astro handlers.
 * Kept separate from the Astro pipeline so it can be tested with `app.request()`.
 */
const api = new Hono();

api.get("/api/health", (c) => c.json({ ok: true }));

/**
 * Redirects to `/<locale>/`, the top page of the locale that the request's `Accept-Language`
 * prefers (see `negotiateLocale`). The response depends on that header, so it carries
 * `Vary: Accept-Language`.
 */
function redirectToLocale(c: Context): Response {
  c.header("Vary", "Accept-Language");
  return c.redirect(`/${negotiateLocale(c.req.header("Accept-Language"))}/`);
}

// `/` must not have a page in `src/pages/`: the adapter would serve it before this route.
api.get("/", redirectToLocale);

export default api;
