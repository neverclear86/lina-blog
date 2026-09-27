import { env } from "cloudflare:workers";
import { actions, i18n, middleware, pages } from "astro/hono";
import { Hono } from "hono";
import api, { type ApiEnv } from "./api";

const app = new Hono<ApiEnv>();

// Worker routes go before the Astro handlers. For a path that nothing matches, `middleware()`
// answers 404 without calling next, and Astro serves the prerendered `src/pages/404.astro`.
app.route("/", api);

// `middleware()` goes before `actions()`: `actions()` throws when no route matches and the
// only 404 route is prerendered, which would turn every unmatched path into a 500.
app.use(middleware());
app.use(actions());
app.use(pages());
// `pages()` does not call next, so i18n() is never reached and `astro build` warns about it.
// Keep it after `pages()`: with prefixDefaultLocale it answers 404 for paths without a locale
// prefix, such as `/blog/`.
app.use(i18n());

// Astro calls this handler with the request only, so pass the Worker's bindings and secrets
// from `cloudflare:workers` to Hono here; the routes in `src/api.ts` read them as `c.env`.
export default { fetch: (request: Request) => app.fetch(request, env) };
