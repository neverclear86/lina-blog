import { env } from "cloudflare:workers";
import { actions, i18n, middleware, pages } from "astro/hono";
import { Hono } from "hono";
import api, { type ApiEnv } from "./api";

const app = new Hono<ApiEnv>();

// Worker routes go before the Astro handlers; `pages()` answers 404 for anything it does not match.
app.route("/", api);

app.use(actions());
app.use(middleware());
app.use(pages());
// `pages()` does not call next, so i18n() is never reached and `astro build` warns about it.
// Keep it after `pages()`: with prefixDefaultLocale it answers 404 for paths without a locale
// prefix, such as `/blog/`.
app.use(i18n());

// Astro calls this handler with the request only, so pass the Worker's bindings and secrets
// from `cloudflare:workers` to Hono here; the routes in `src/api.ts` read them as `c.env`.
export default { fetch: (request: Request) => app.fetch(request, env) };
