import { Hono } from "hono";
import { requireBearerToken } from "./auth";
import type { PublishEnv } from "./env";

/**
 * Hono app of the publish Worker, and the Worker entry (`main` in `wrangler.jsonc`).
 * Every route sits behind `requireBearerToken`, so unknown paths also answer 401 without the
 * secret. Tests call it with `app.request()` and pass the bindings as the third argument.
 */
const app = new Hono<PublishEnv>();

app.use("*", requireBearerToken);

// Lets clients check the URL and the secret without side effects.
app.get("/health", (c) => c.json({ ok: true }));

export default app;
