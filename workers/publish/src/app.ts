import { Hono } from "hono";
import {
  insertFrontmatterDate,
  parseArticleMarkdown,
} from "./article-markdown";
import { requireBearerToken } from "./auth";
import { contentHash } from "./content-hash";
import type { PublishEnv } from "./env";
import { errorBody } from "./errors";
import { commitFiles, getMainHead } from "./github-commit";
import { rewriteImageRefs } from "./image-refs";
import { headImage, imageUrl, parseImageName, putImage } from "./images";
import {
  listPublishedArticles,
  readPublishedRecord,
  serializePublishedRecord,
  withPublishedEntry,
} from "./published-record";

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

// Base of an article's public URL, the `url` of the response in docs/publish-api.md.
const ARTICLE_BASE_URL = "https://ikili.pro/blog";

// Publishes an article (docs/publish-api.md) by running steps 0 to 3: the request, the
// frontmatter and the image references are checked, each referenced image is looked up in R2 in
// turn, the references are rewritten, and the article file and its entry of the published record
// are written to main in one commit. No Nostr event is made yet, so `nostr` is null.
app.put("/articles/:slug", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(errorBody("invalid_request", "The body must be JSON."), 400);
  }
  const markdown =
    typeof body === "object" && body !== null && "markdown" in body
      ? body.markdown
      : undefined;
  if (typeof markdown !== "string") {
    return c.json(
      errorBody("invalid_request", 'The body must be {"markdown": string}.'),
      400,
    );
  }

  const slug = c.req.param("slug");
  const article = parseArticleMarkdown(markdown, slug);
  if (!article.ok) {
    return c.json(errorBody(article.code, article.message), 422);
  }
  const rewritten = rewriteImageRefs(markdown);
  if (!rewritten.ok) {
    return c.json(errorBody(rewritten.code, rewritten.message), 422);
  }

  const missing: string[] = [];
  for (const name of rewritten.names) {
    const result = await headImage(c.env.IMAGES, name);
    if (!result.ok) {
      return c.json(errorBody("upstream_error", result.message, "images"), 502);
    }
    if (result.image === null) {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    return c.json(
      errorBody(
        "missing_image",
        `Images are not stored: ${missing.join(", ")}.`,
        "images",
      ),
      422,
    );
  }

  const token = c.env.GITHUB_TOKEN;
  if (!token) {
    return c.json(errorBody("misconfigured", "GITHUB_TOKEN is not set."), 500);
  }
  const apiUrl = c.env.GITHUB_API_URL;
  const head = await getMainHead({ token, apiUrl });
  if (!head.ok) {
    return c.json(errorBody("upstream_error", head.message, "commit"), 502);
  }
  const current = await readPublishedRecord({ token, apiUrl, ref: head.sha });
  if (!current.ok) {
    return c.json(errorBody("upstream_error", current.message, "commit"), 502);
  }
  const date = Object.hasOwn(current.record.articles, slug)
    ? current.record.articles[slug].date
    : `${new Date().toISOString().slice(0, 19)}Z`;
  const articleFile = insertFrontmatterDate(rewritten.markdown, date);
  if (articleFile === null) {
    return c.json(
      errorBody(
        "invalid_frontmatter",
        "Markdown must start with a YAML frontmatter between --- lines.",
      ),
      422,
    );
  }
  const committed = await commitFiles({
    token,
    apiUrl,
    message: `content: ${slug} を公開する`,
    parent: head.sha,
    files: [
      { path: `src/content/blog/${slug}.md`, content: articleFile },
      {
        path: "src/content/published.json",
        content: serializePublishedRecord(
          withPublishedEntry(current.record, slug, {
            hash: null,
            date,
            images: rewritten.names,
          }),
        ),
      },
    ],
  });
  if (!committed.ok) {
    return c.json(
      errorBody(committed.code, committed.message, "commit"),
      committed.code === "conflict" ? 409 : 502,
    );
  }

  return c.json({
    slug,
    url: `${ARTICLE_BASE_URL}/${slug}`,
    hash: await contentHash(markdown),
    commit: committed.commit,
    nostr: null,
    zenn: article.frontmatter.tags.includes("技術") ? { commit: null } : null,
  });
});

export default app;
