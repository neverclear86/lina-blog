import { Hono } from "hono";
import { buildArticleEvent } from "./article-event";
import {
  articleBody,
  DATE_LINE_MESSAGE,
  insertFrontmatterDate,
  parseArticleMarkdown,
} from "./article-markdown";
import { requireBearerToken } from "./auth";
import { contentHash } from "./content-hash";
import type { PublishEnv } from "./env";
import { errorBody } from "./errors";
import { commitFiles, getMainHead } from "./github-commit";
import { rewriteImageRefs } from "./image-refs";
import {
  deleteImages,
  headImage,
  imageUrl,
  parseImageName,
  putImage,
} from "./images";
import {
  fitsBunkerRequest,
  publishToNostr,
  readNostrConfig,
} from "./nostr-publish";
import { requestNostrDeletion } from "./nostr-withdraw";
import {
  exclusiveImages,
  listPublishedArticles,
  readPublishedRecord,
  serializePublishedRecord,
  withoutPublishedEntry,
  withPublishedEntry,
} from "./published-record";
import {
  buildZennArticle,
  isZennTarget,
  zennArticlePath,
} from "./zenn-article";
import { convertToZennSyntax } from "./zenn-syntax";
import { unpublishZennArticle } from "./zenn-unpublish";

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

// Path of the published record in this repository (docs/publish-api.md).
const PUBLISHED_RECORD_PATH = "src/content/published.json";

// Where step 5 writes: the Zenn repository and its default branch.
const ZENN_REPO = "neverclear86/zenn-contents";
const ZENN_BRANCH = "master";

// Publishes an article (docs/publish-api.md) by running steps 0 to 6: the request, the
// frontmatter and the image references are checked, each referenced image is looked up in R2 in
// turn, the references are rewritten, the article file and its entry of the published record
// are written to main in one commit, the article's Nostr event is signed through the bunker and
// posted to the author's write relays, an article with the tag 技術 is written to zenn-contents
// in the syntax of Zenn, and the entry's hash is then set to the content hash.
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

  // Converts the body for Zenn before anything is written: HTML that Zenn cannot show does not
  // go away by sending the article again, so it must not leave the article half published.
  let zennArticle: string | null = null;
  if (isZennTarget(article.frontmatter.tags)) {
    const converted = convertToZennSyntax(articleBody(rewritten.markdown));
    if (!converted.ok) {
      return c.json(
        errorBody("invalid_markdown", converted.message, "zenn"),
        422,
      );
    }
    zennArticle = buildZennArticle({
      frontmatter: article.frontmatter,
      body: converted.markdown,
      originalUrl: `${ARTICLE_BASE_URL}/${slug}`,
      published: true,
    });
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
  const nostr = readNostrConfig(c.env);
  if (!nostr.ok) {
    return c.json(errorBody("misconfigured", nostr.message), 500);
  }
  const { frontmatter } = article;
  if (
    !fitsBunkerRequest(
      buildArticleEvent({
        frontmatter,
        body: articleBody(rewritten.markdown),
        publishedDate: new Date().toISOString(),
        now: new Date(),
      }),
    )
  ) {
    return c.json(
      errorBody(
        "invalid_markdown",
        "The article is too long for one NIP-46 sign_event request (65535 bytes).",
      ),
      422,
    );
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
  const hash = await contentHash(markdown);
  // A done article sent again with the same content keeps its hash, so that neither step 3 nor
  // step 6 makes a commit.
  const kept =
    Object.hasOwn(current.record.articles, slug) &&
    current.record.articles[slug].hash === hash;
  const date = Object.hasOwn(current.record.articles, slug)
    ? current.record.articles[slug].date
    : `${new Date().toISOString().slice(0, 19)}Z`;
  const articleFile = insertFrontmatterDate(rewritten.markdown, date);
  if (articleFile === null) {
    return c.json(errorBody("invalid_frontmatter", DATE_LINE_MESSAGE), 422);
  }
  const committed = await commitFiles({
    token,
    apiUrl,
    message: `content: ${slug} を公開する`,
    parent: head.sha,
    files: [
      { path: `src/content/blog/${slug}.md`, content: articleFile },
      {
        path: PUBLISHED_RECORD_PATH,
        content: serializePublishedRecord(
          withPublishedEntry(current.record, slug, {
            hash: kept ? hash : null,
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

  // Step 4: posts the article's event, whose published_at is the date of the published record,
  // so that publishing again replaces the event with the same d tag.
  const now = new Date();
  const posted = await publishToNostr(
    buildArticleEvent({
      frontmatter,
      body: articleBody(rewritten.markdown),
      publishedDate: date,
      now,
    }),
    nostr.config,
    now,
  );
  if (!posted.ok) {
    return c.json(errorBody("upstream_error", posted.message, "nostr"), 502);
  }

  // Step 5: writes the article to the Zenn repository on top of its branch as it is now. When
  // this fails, step 6 does not run: the entry keeps the hash that step 3 wrote, which is null
  // unless a done article was sent again with the same content, so the sync sends it again.
  let zenn: { commit: string | null } | null = null;
  if (zennArticle !== null) {
    const written = await commitFiles({
      token,
      apiUrl,
      repo: ZENN_REPO,
      branch: ZENN_BRANCH,
      message: `content: ${slug} を Zenn に転載する`,
      files: [{ path: zennArticlePath(slug), content: zennArticle }],
    });
    if (!written.ok) {
      return c.json(
        errorBody(written.code, written.message, "zenn"),
        written.code === "conflict" ? 409 : 502,
      );
    }
    zenn = { commit: written.commit };
  }

  // Step 6: sets the entry's hash to the content hash on top of main as it is now, which marks
  // the article as done for GET /articles.
  const recordHead = await getMainHead({ token, apiUrl });
  if (!recordHead.ok) {
    return c.json(
      errorBody("upstream_error", recordHead.message, "record"),
      502,
    );
  }
  const latest = await readPublishedRecord({
    token,
    apiUrl,
    ref: recordHead.sha,
  });
  if (!latest.ok) {
    return c.json(errorBody("upstream_error", latest.message, "record"), 502);
  }
  if (!Object.hasOwn(latest.record.articles, slug)) {
    return c.json(
      errorBody(
        "conflict",
        `${PUBLISHED_RECORD_PATH} on main has no entry for ${slug} after step 3.`,
        "record",
      ),
      409,
    );
  }
  const entry = latest.record.articles[slug];
  if (entry.hash !== hash) {
    const recorded = await commitFiles({
      token,
      apiUrl,
      message: `content: ${slug} の公開を記録する`,
      parent: recordHead.sha,
      files: [
        {
          path: PUBLISHED_RECORD_PATH,
          content: serializePublishedRecord(
            withPublishedEntry(latest.record, slug, { ...entry, hash }),
          ),
        },
      ],
    });
    if (!recorded.ok) {
      return c.json(
        errorBody(recorded.code, recorded.message, "record"),
        recorded.code === "conflict" ? 409 : 502,
      );
    }
  }

  return c.json({
    slug,
    url: `${ARTICLE_BASE_URL}/${slug}`,
    hash,
    commit: committed.commit,
    nostr: { eventId: posted.eventId },
    zenn,
  });
});

// Withdraws an article (docs/publish-api.md): reads the published record, asks Nostr to delete
// the article's event, sets the article's file in zenn-contents to `published: false`, deletes
// the images that no other article refers to, and deletes the article file and its entry of
// the published record from main in one commit.
app.delete("/articles/:slug", async (c) => {
  const token = c.env.GITHUB_TOKEN;
  if (!token) {
    return c.json(errorBody("misconfigured", "GITHUB_TOKEN is not set."), 500);
  }
  const nostrConfig = readNostrConfig(c.env);
  if (!nostrConfig.ok) {
    return c.json(errorBody("misconfigured", nostrConfig.message), 500);
  }
  const slug = c.req.param("slug");
  const apiUrl = c.env.GITHUB_API_URL;

  // Step 1: reads the record on main as it is now; the images to delete come from it.
  const head = await getMainHead({ token, apiUrl });
  if (!head.ok) {
    return c.json(errorBody("upstream_error", head.message, "record"), 502);
  }
  const current = await readPublishedRecord({ token, apiUrl, ref: head.sha });
  if (!current.ok) {
    return c.json(errorBody("upstream_error", current.message, "record"), 502);
  }
  if (!Object.hasOwn(current.record.articles, slug)) {
    return c.json(
      errorBody("not_found", `The published record has no article ${slug}.`),
      404,
    );
  }

  // Step 2: asks Nostr to delete the article's event.
  const nostr = await requestNostrDeletion(
    slug,
    nostrConfig.config,
    new Date(),
  );
  if (!nostr.ok) {
    return c.json(errorBody("upstream_error", nostr.message, "nostr"), 502);
  }

  // Step 3: sets the article's file in zenn-contents to `published: false`.
  const zenn = await unpublishZennArticle({ token, apiUrl, slug });
  if (!zenn.ok) {
    return c.json(
      errorBody(zenn.code, zenn.message, "zenn"),
      zenn.code === "conflict" ? 409 : 502,
    );
  }

  // Step 4: deletes the images that no other article refers to.
  const images = exclusiveImages(current.record, slug);
  const deleted = await deleteImages(c.env.IMAGES, images);
  if (!deleted.ok) {
    return c.json(errorBody(deleted.code, deleted.message, "images"), 502);
  }

  // Step 5: removes the article file and its entry on top of main as it is now.
  const latestHead = await getMainHead({ token, apiUrl });
  if (!latestHead.ok) {
    return c.json(
      errorBody("upstream_error", latestHead.message, "commit"),
      502,
    );
  }
  const latest = await readPublishedRecord({
    token,
    apiUrl,
    ref: latestHead.sha,
  });
  if (!latest.ok) {
    return c.json(errorBody("upstream_error", latest.message, "commit"), 502);
  }
  if (!Object.hasOwn(latest.record.articles, slug)) {
    return c.json(
      errorBody(
        "conflict",
        `${PUBLISHED_RECORD_PATH} on main has no entry for ${slug}; another call has withdrawn it.`,
        "commit",
      ),
      409,
    );
  }
  const committed = await commitFiles({
    token,
    apiUrl,
    message: `content: ${slug} を取り下げる`,
    parent: latestHead.sha,
    files: [
      {
        path: PUBLISHED_RECORD_PATH,
        content: serializePublishedRecord(
          withoutPublishedEntry(latest.record, slug),
        ),
      },
    ],
    deletes: [`src/content/blog/${slug}.md`],
  });
  if (!committed.ok) {
    return c.json(
      errorBody(committed.code, committed.message, "commit"),
      committed.code === "conflict" ? 409 : 502,
    );
  }

  return c.json({
    slug,
    commit: committed.commit,
    nostr: { eventId: nostr.eventId },
    zenn: zenn.zenn,
    images,
  });
});

export default app;
