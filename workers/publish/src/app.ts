import { Hono } from "hono";
import { requireBearerToken } from "./auth";
import type { PublishEnv } from "./env";
import { errorBody } from "./errors";
import { listPublishedArticles } from "./published-record";

/**
 * Hono app of the publish Worker, and the Worker entry (`main` in `wrangler.jsonc`).
 * Every route sits behind `requireBearerToken`, so unknown paths also answer 401 without the
 * secret. Tests call it with `app.request()` and pass the bindings as the third argument.
 */
const app = new Hono<PublishEnv>();

app.use("*", requireBearerToken);

// Lets clients check the URL and the secret without side effects.
app.get("/health", (c) => c.json({ ok: true }));

// Lists published articles from the published record on GitHub (docs/publish-api.md).
app.get("/articles", async (c) => {
  const token = c.env.GITHUB_TOKEN;
  if (!token) {
    return c.json(errorBody("misconfigured", "GITHUB_TOKEN is not set."), 500);
  }
  const result = await listPublishedArticles({
    token,
    apiUrl: c.env.GITHUB_API_URL,
  });
  if (!result.ok) {
    return c.json(errorBody("upstream_error", result.message, "list"), 502);
  }
  return c.json({ articles: result.articles });
});

export default app;
