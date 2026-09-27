import { Hono } from "hono";
import { requireBearerToken } from "./auth";
import type { PublishEnv } from "./env";
import { errorBody } from "./errors";
import { headImage, imageUrl, parseImageName, putImage } from "./images";
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

const INVALID_NAME =
  "Image name must be <sha256>.<ext> with the extension avif, gif, jpg, png or webp.";

// Tells whether an image is stored. Hono routes HEAD to GET handlers, so a plain GET gets
// 404 here.
app.get("/images/:name", async (c) => {
  if (c.req.method !== "HEAD") {
    return c.notFound();
  }
  const image = parseImageName(c.req.param("name"));
  if (!image) {
    return c.json(errorBody("invalid_request", INVALID_NAME), 400);
  }
  const result = await headImage(c.env.IMAGES, image.name);
  if (!result.ok) {
    return c.body(null, 502);
  }
  if (result.image === null) {
    return c.body(null, 404);
  }
  const headers = new Headers();
  result.image.writeHttpMetadata(headers);
  headers.set("ETag", result.image.httpEtag);
  return new Response(null, { status: 200, headers });
});

// Stores an image under its content hash (docs/publish-api.md).
app.put("/images/:name", async (c) => {
  const image = parseImageName(c.req.param("name"));
  if (!image) {
    return c.json(errorBody("invalid_request", INVALID_NAME), 400);
  }
  if (c.req.header("Content-Type") !== image.contentType) {
    return c.json(
      errorBody(
        "invalid_request",
        `Content-Type must be ${image.contentType}.`,
      ),
      400,
    );
  }
  const body = c.req.raw.body;
  if (c.req.header("Content-Length") === undefined || body === null) {
    return c.json(
      errorBody("invalid_request", "Content-Length is required."),
      400,
    );
  }
  const result = await putImage(c.env.IMAGES, image, body);
  if (!result.ok) {
    return c.json(
      errorBody(result.code, result.message),
      result.code === "hash_mismatch" ? 422 : 502,
    );
  }
  return c.json(
    { name: image.name, url: imageUrl(image.name) },
    result.created ? 201 : 200,
  );
});

export default app;
