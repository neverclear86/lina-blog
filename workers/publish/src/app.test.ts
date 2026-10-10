import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { experimental_readRawConfig } from "wrangler";
import app from "./app";
import { DATE_LINE_MESSAGE } from "./article-markdown";
import { contentHash } from "./content-hash";
import type { ImageBucket, StoredImage } from "./images";

const env = { PUBLISH_TOKEN: "test-token" };

function withAuthorization(value: string): RequestInit {
  return { headers: { Authorization: value } };
}

describe("publish app", () => {
  it("Authorization の無いリクエストは 401 と WWW-Authenticate: Bearer を返す", async () => {
    const res = await app.request("/health", {}, env);
    expect(res.status).toBe(401);
    expect(res.headers.get("WWW-Authenticate")).toBe("Bearer");
    expect(await res.json()).toEqual({
      error: {
        code: "unauthorized",
        message: "Missing or invalid bearer token.",
      },
    });
  });

  it("Bearer 以外の方式は 401 を返す（Basic test-token）", async () => {
    const res = await app.request(
      "/health",
      withAuthorization("Basic test-token"),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("方式の無いシークレットだけのヘッダーは 401 を返す（test-token）", async () => {
    const res = await app.request(
      "/health",
      withAuthorization("test-token"),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("値が Bearer だけのヘッダーは 401 を返す（`Bearer `。前後の空白は落ちて `Bearer` になる）", async () => {
    const res = await app.request("/health", withAuthorization("Bearer "), env);
    expect(res.status).toBe(401);
  });

  it("違うシークレットは 401 を返す（Bearer wrong-token）", async () => {
    const res = await app.request(
      "/health",
      withAuthorization("Bearer wrong-token"),
      env,
    );
    expect(res.status).toBe(401);
  });

  it("正しいシークレットは通り、GET /health が 200 と { ok: true } を返す", async () => {
    const res = await app.request(
      "/health",
      withAuthorization("Bearer test-token"),
      env,
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("PUBLISH_TOKEN が未設定なら正しい形のヘッダーでも 500 を返す", async () => {
    const res = await app.request(
      "/health",
      withAuthorization("Bearer test-token"),
      {},
    );
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "misconfigured", message: "PUBLISH_TOKEN is not set." },
    });
  });

  it("定義していないパスは認証の無いとき 401、正しいシークレットで 404 を返す", async () => {
    const denied = await app.request("/unknown", {}, env);
    expect(denied.status).toBe(401);
    const allowed = await app.request(
      "/unknown",
      withAuthorization("Bearer test-token"),
      env,
    );
    expect(allowed.status).toBe(404);
  });
});

describe("GET /articles", () => {
  const articlesEnv = { ...env, GITHUB_TOKEN: "github-token" };
  const authorized = withAuthorization("Bearer test-token");
  const HASH = "a".repeat(64);

  /** Replaces the global `fetch` with a stub that answers every call with `body`. */
  const stubGlobalFetch = (body: string | null, init?: ResponseInit) => {
    const fetchImpl = vi.fn<typeof fetch>(async () => new Response(body, init));
    vi.stubGlobal("fetch", fetchImpl);
    return fetchImpl;
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("認証の無いリクエストは 401 を返し、GitHub を呼ばない", async () => {
    const fetchImpl = stubGlobalFetch(JSON.stringify({ articles: {} }));

    const res = await app.request("/articles", {}, articlesEnv);

    expect(res.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("公開の記録の slug と hash を 200 で返す", async () => {
    stubGlobalFetch(
      JSON.stringify({
        articles: {
          b: { hash: null, date: "2026-09-01T00:00:00Z", images: [] },
          a: { hash: HASH, date: "2026-09-01T00:00:00Z", images: [] },
        },
      }),
    );

    const res = await app.request("/articles", authorized, articlesEnv);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      articles: [
        { slug: "a", hash: HASH },
        { slug: "b", hash: null },
      ],
    });
  });

  it("GITHUB_API_URL があればその基底 URL の GitHub から読む", async () => {
    const fetchImpl = stubGlobalFetch(JSON.stringify({ articles: {} }));

    await app.request("/articles", authorized, {
      ...articlesEnv,
      GITHUB_API_URL: "http://127.0.0.1:9999",
    });

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:9999/repos/neverclear86/lina-blog/contents/src/content/published.json?ref=main",
    );
  });

  it("GitHub から読めないときは 502 と upstream_error、step: list を返す（GitHub が 503）", async () => {
    stubGlobalFetch("Service Unavailable", { status: 503 });

    const res = await app.request("/articles", authorized, articlesEnv);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: {
        code: "upstream_error",
        message: "GitHub answered 503 when reading src/content/published.json.",
        step: "list",
      },
    });
  });

  it("GITHUB_TOKEN が未設定なら 500 と misconfigured を返し、GitHub を呼ばない", async () => {
    const fetchImpl = stubGlobalFetch(JSON.stringify({ articles: {} }));

    const res = await app.request("/articles", authorized, env);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "misconfigured", message: "GITHUB_TOKEN is not set." },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("images", () => {
  const HELLO_HASH =
    "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824";
  const ZERO_HASH = "0".repeat(64);
  const AUTHORIZATION = "Bearer test-token";

  type Stored = { contentType: string; cacheControl: string; etag: string };

  /**
   * A bucket stub over a `Map`. `put` reads the body and, like R2, throws BadDigest (10037)
   * when its SHA-256 differs from `sha256`.
   */
  function fakeBucket() {
    const objects = new Map<string, Stored>();
    const toStoredImage = (stored: Stored): StoredImage => ({
      httpEtag: stored.etag,
      writeHttpMetadata: (headers) => {
        headers.set("Content-Type", stored.contentType);
        headers.set("Cache-Control", stored.cacheControl);
      },
    });
    const head = vi.fn<ImageBucket["head"]>(async (key) => {
      const stored = objects.get(key);
      return stored ? toStoredImage(stored) : null;
    });
    const put = vi.fn<ImageBucket["put"]>(async (key, value, options) => {
      const bytes = await new Response(value).arrayBuffer();
      const digest = await crypto.subtle.digest("SHA-256", bytes);
      const hex = [...new Uint8Array(digest)]
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      if (hex !== options.sha256) {
        throw new Error(
          "put: The SHA-256 checksum you specified did not match what we received. (10037)",
        );
      }
      objects.set(key, {
        contentType: options.httpMetadata.contentType,
        cacheControl: options.httpMetadata.cacheControl,
        etag: `"${hex.slice(0, 32)}"`,
      });
      return {};
    });
    return { objects, head, put };
  }

  /** A `PUT /images/{name}` request with an explicit `Content-Length`. */
  function putRequest(
    body: string,
    headers: Record<string, string> = {},
  ): RequestInit {
    return {
      method: "PUT",
      body,
      headers: {
        Authorization: AUTHORIZATION,
        "Content-Type": "image/png",
        "Content-Length": String(new TextEncoder().encode(body).length),
        ...headers,
      },
    };
  }

  const headRequest: RequestInit = {
    method: "HEAD",
    headers: { Authorization: AUTHORIZATION },
  };

  it("認証の無い PUT は 401 を返し、R2 を呼ばない", async () => {
    const bucket = fakeBucket();

    const res = await app.request(
      `/images/${HELLO_HASH}.png`,
      { method: "PUT", body: "hello" },
      { ...env, IMAGES: bucket },
    );

    expect(res.status).toBe(401);
    expect(bucket.head).not.toHaveBeenCalled();
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("ハッシュの合う画像を置き、201 と名前と img.ikili.pro の URL を返す", async () => {
    const bucket = fakeBucket();

    const res = await app.request(
      `/images/${HELLO_HASH}.png`,
      putRequest("hello"),
      { ...env, IMAGES: bucket },
    );

    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({
      name: `${HELLO_HASH}.png`,
      url: `https://img.ikili.pro/${HELLO_HASH}.png`,
    });
    expect(bucket.objects.get(`${HELLO_HASH}.png`)).toEqual({
      contentType: "image/png",
      cacheControl: "public, max-age=31536000, immutable",
      etag: `"${HELLO_HASH.slice(0, 32)}"`,
    });
  });

  it("既に有る画像は置き直さずに 200 を返す", async () => {
    const bucket = fakeBucket();
    const bindings = { ...env, IMAGES: bucket };
    await app.request(
      `/images/${HELLO_HASH}.png`,
      putRequest("hello"),
      bindings,
    );

    const res = await app.request(
      `/images/${HELLO_HASH}.png`,
      putRequest("hello"),
      bindings,
    );

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      name: `${HELLO_HASH}.png`,
      url: `https://img.ikili.pro/${HELLO_HASH}.png`,
    });
    expect(bucket.put).toHaveBeenCalledTimes(1);
  });

  it("ハッシュが一致しない画像は 422 と hash_mismatch を返し、置かない", async () => {
    const bucket = fakeBucket();

    const res = await app.request(
      `/images/${ZERO_HASH}.png`,
      putRequest("hello"),
      { ...env, IMAGES: bucket },
    );

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: {
        code: "hash_mismatch",
        message: `The image does not match the SHA-256 ${ZERO_HASH}.`,
      },
    });
    expect(bucket.objects.size).toBe(0);
  });

  it("R2 が失敗すると 502 と upstream_error を返す", async () => {
    const bucket = fakeBucket();
    bucket.put.mockRejectedValue(new Error("put: Internal error (10001)"));

    const res = await app.request(
      `/images/${HELLO_HASH}.png`,
      putRequest("hello"),
      { ...env, IMAGES: bucket },
    );

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: {
        code: "upstream_error",
        message: `Could not store ${HELLO_HASH}.png in R2.`,
      },
    });
  });

  it.each([`${HELLO_HASH}.svg`, `${HELLO_HASH}.jpeg`, "not-a-hash.png"])(
    "名前の形が違う PUT（%s）は 400 と invalid_request を返す",
    async (name) => {
      const bucket = fakeBucket();

      const res = await app.request(`/images/${name}`, putRequest("hello"), {
        ...env,
        IMAGES: bucket,
      });

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: {
          code: "invalid_request",
          message:
            "Image name must be <sha256>.<ext> with the extension avif, gif, jpg, png or webp.",
        },
      });
      expect(bucket.put).not.toHaveBeenCalled();
    },
  );

  it("拡張子に合わない Content-Type は 400 を返す", async () => {
    const bucket = fakeBucket();

    const res = await app.request(
      `/images/${HELLO_HASH}.png`,
      putRequest("hello", { "Content-Type": "image/jpeg" }),
      { ...env, IMAGES: bucket },
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "invalid_request",
        message: "Content-Type must be image/png.",
      },
    });
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("パラメーター付きの Content-Type（image/png; charset=binary）は 400 を返し、R2 を呼ばない", async () => {
    const bucket = fakeBucket();

    const res = await app.request(
      `/images/${HELLO_HASH}.png`,
      putRequest("hello", { "Content-Type": "image/png; charset=binary" }),
      { ...env, IMAGES: bucket },
    );

    expect(res.status).toBe(400);
    expect(bucket.head).not.toHaveBeenCalled();
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("Content-Length の無い PUT は 400 を返し、R2 を呼ばない", async () => {
    const bucket = fakeBucket();

    const res = await app.request(
      `/images/${HELLO_HASH}.png`,
      {
        method: "PUT",
        body: "hello",
        headers: { Authorization: AUTHORIZATION, "Content-Type": "image/png" },
      },
      { ...env, IMAGES: bucket },
    );

    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: {
        code: "invalid_request",
        message: "Content-Length is required.",
      },
    });
    expect(bucket.head).not.toHaveBeenCalled();
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("HEAD は有る画像に 200 と保存した Content-Type、Cache-Control、ETag を返す", async () => {
    const bucket = fakeBucket();
    const bindings = { ...env, IMAGES: bucket };
    await app.request(
      `/images/${HELLO_HASH}.png`,
      putRequest("hello"),
      bindings,
    );

    const res = await app.request(
      `/images/${HELLO_HASH}.png`,
      headRequest,
      bindings,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("image/png");
    expect(res.headers.get("Cache-Control")).toBe(
      "public, max-age=31536000, immutable",
    );
    expect(res.headers.get("ETag")).toBe(`"${HELLO_HASH.slice(0, 32)}"`);
    expect(await res.text()).toBe("");
  });

  it("有る画像でも GET /images/{name} は 404 を返す", async () => {
    const bucket = fakeBucket();
    const bindings = { ...env, IMAGES: bucket };
    await app.request(
      `/images/${HELLO_HASH}.png`,
      putRequest("hello"),
      bindings,
    );

    const res = await app.request(
      `/images/${HELLO_HASH}.png`,
      withAuthorization(AUTHORIZATION),
      bindings,
    );

    expect(res.status).toBe(404);
  });

  it("HEAD は無い画像に本文無しの 404 を返す", async () => {
    const bucket = fakeBucket();

    const res = await app.request(`/images/${HELLO_HASH}.png`, headRequest, {
      ...env,
      IMAGES: bucket,
    });

    expect(res.status).toBe(404);
    expect(await res.text()).toBe("");
  });

  it("HEAD は R2 が失敗すると 502 を返す", async () => {
    const bucket = fakeBucket();
    bucket.head.mockRejectedValue(new Error("head: Internal error"));

    const res = await app.request(`/images/${HELLO_HASH}.png`, headRequest, {
      ...env,
      IMAGES: bucket,
    });

    expect(res.status).toBe(502);
  });

  it("HEAD は名前の形が違うと 400 を返す", async () => {
    const bucket = fakeBucket();

    const res = await app.request(`/images/${HELLO_HASH}.svg`, headRequest, {
      ...env,
      IMAGES: bucket,
    });

    expect(res.status).toBe(400);
    expect(bucket.head).not.toHaveBeenCalled();
  });

  it("wrangler.jsonc の IMAGES バインディングが公開用 R2 バケットを指す", () => {
    const { rawConfig } = experimental_readRawConfig({
      config: "workers/publish/wrangler.jsonc",
    });
    expect(rawConfig.r2_buckets).toEqual([
      { binding: "IMAGES", bucket_name: "lina-blog-images" },
    ]);
  });
});

const HEAD = "1".repeat(40);
const TREE = "2".repeat(40);
const NEW_TREE = "3".repeat(40);
const COMMIT = "4".repeat(40);
const GIT = "https://api.github.com/repos/neverclear86/lina-blog/git";
const RECORD = `https://api.github.com/repos/neverclear86/lina-blog/contents/src/content/published.json?ref=${HEAD}`;

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), init);

/**
 * Replaces the global `fetch` with a stub that answers by `"<METHOD> <URL>"`. The default
 * answers are those of a successful publish on top of `HEAD`, whose published record does not
 * exist; `overrides` replaces the answer of a key. A key it does not know is answered 599.
 */
const stubGitHub = (
  overrides: Record<string, () => Response | Promise<Response>> = {},
) => {
  const answers: Record<string, () => Response | Promise<Response>> = {
    [`GET ${GIT}/ref/heads/main`]: () => json({ object: { sha: HEAD } }),
    [`GET ${RECORD}`]: () => new Response("Not Found", { status: 404 }),
    [`GET ${GIT}/commits/${HEAD}`]: () => json({ tree: { sha: TREE } }),
    [`POST ${GIT}/trees`]: () => json({ sha: NEW_TREE }, { status: 201 }),
    [`POST ${GIT}/commits`]: () => json({ sha: COMMIT }, { status: 201 }),
    [`PATCH ${GIT}/refs/heads/main`]: () => json({ ref: "refs/heads/main" }),
    ...overrides,
  };
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${String(input)}`;
    return answers[key]?.() ?? new Response("unknown", { status: 599 });
  });
  vi.stubGlobal("fetch", fetchImpl);
  return fetchImpl;
};

/** The calls of a stub as `"<METHOD> <URL>"`, in order. */
const calls = (fetchImpl: ReturnType<typeof stubGitHub>) =>
  fetchImpl.mock.calls.map(([url, init]) => `${init?.method ?? "GET"} ${url}`);

/** The JSON body of the first call of `fetchImpl` that is `"<METHOD> <URL>"`. */
const bodyOf = (fetchImpl: ReturnType<typeof stubGitHub>, key: string) => {
  const call = fetchImpl.mock.calls.find(
    ([url, init]) => `${init?.method ?? "GET"} ${url}` === key,
  );
  return JSON.parse(String(call?.[1]?.body));
};

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("PUT /articles/{slug}", () => {
  const AUTHORIZATION = "Bearer test-token";
  const SLUG = "hello-ikili-pro";
  const A = `${"a".repeat(64)}.png`;
  const B = `${"b".repeat(64)}.jpg`;
  const C = `${"c".repeat(64)}.webp`;

  function article(names: string[], tags = "  - 技術", slug = SLUG): string {
    const images = names.map((name) => `![図](image:${name})\n`).join("");
    return `---\ntitle: 記事の題\nslug: ${slug}\nemoji: 📝\ntags:\n${tags}\ndescription: 記事の説明\n---\n\n本文。\n\n${images}`;
  }

  function bucketWith(stored: string[]) {
    const head = vi.fn<ImageBucket["head"]>(async (key) =>
      stored.includes(key)
        ? { httpEtag: '"etag"', writeHttpMetadata: vi.fn() }
        : null,
    );
    return { head, put: vi.fn() };
  }

  function putArticle(
    body: string,
    bucket: ReturnType<typeof bucketWith>,
    path = `/articles/${SLUG}`,
  ) {
    return app.request(
      path,
      {
        method: "PUT",
        headers: {
          Authorization: AUTHORIZATION,
          "Content-Type": "application/json",
        },
        body,
      },
      { ...env, GITHUB_TOKEN: "github-token", IMAGES: bucket },
    );
  }

  const send = (markdown: string) => JSON.stringify({ markdown });

  it("認証の無い記事の PUT は 401 を返し、R2 を呼ばない", async () => {
    const bucket = bucketWith([A]);

    const res = await app.request(
      `/articles/${SLUG}`,
      { method: "PUT", body: send(article([A])) },
      { ...env, IMAGES: bucket },
    );

    expect(res.status).toBe(401);
    expect(bucket.head).not.toHaveBeenCalled();
  });

  it.each([
    ["JSON でない", "not json", "The body must be JSON."],
    ["markdown の無い", "{}", 'The body must be {"markdown": string}.'],
    [
      "markdown が文字列でない",
      '{"markdown":1}',
      'The body must be {"markdown": string}.',
    ],
    ["null の", "null", 'The body must be {"markdown": string}.'],
  ])(
    "%s本文は 400 と invalid_request を返す",
    async (_label, body, message) => {
      const bucket = bucketWith([]);

      const res = await putArticle(body, bucket);

      expect(res.status).toBe(400);
      expect(await res.json()).toEqual({
        error: { code: "invalid_request", message },
      });
      expect(bucket.head).not.toHaveBeenCalled();
    },
  );

  it.each([
    [
      "CR を含む",
      article([]).replace("本文。", "本文。\r"),
      "invalid_markdown",
      SLUG,
    ],
    [
      "date のある",
      article([]).replace("slug:", "date: 2026-09-28T00:00:00Z\nslug:"),
      "invalid_frontmatter",
      SLUG,
    ],
    [
      "slug がパスと違う",
      article([], "  - 技術", "other-article-slug"),
      "slug_mismatch",
      SLUG,
    ],
    ["参照の名前が違う", article(["A.png"]), "invalid_markdown", SLUG],
    [
      "参照が 21 種の",
      article(
        Array.from(
          { length: 21 },
          (_, i) => `${String(i).padStart(64, "0")}.png`,
        ),
      ),
      "too_many_images",
      SLUG,
    ],
    [
      "パスが slug の形でない",
      article([], "  - 技術"),
      "slug_mismatch",
      "Hello",
    ],
  ])(
    "%s記事は 422 とそのコードを返し、R2 を呼ばない",
    async (_label, markdown, code, pathSlug) => {
      const bucket = bucketWith([]);

      const res = await putArticle(
        send(markdown),
        bucket,
        `/articles/${pathSlug}`,
      );

      expect(res.status).toBe(422);
      const body = (await res.json()) as {
        error: { code: string; step?: string };
      };
      expect(body.error.code).toBe(code);
      expect(body.error.step).toBeUndefined();
      expect(bucket.head).not.toHaveBeenCalled();
    },
  );

  it("frontmatter と画像の参照の両方が誤った記事は frontmatter のコードを返す", async () => {
    const bucket = bucketWith([]);

    const res = await putArticle(
      send(article(["A.png"], "  - 技術", "other-article-slug")),
      bucket,
    );

    expect(res.status).toBe(422);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe(
      "slug_mismatch",
    );
  });

  it("R2 に無い画像は 422 と missing_image、step: images を返し、無い名前を message に並べる", async () => {
    const bucket = bucketWith([A]);

    const res = await putArticle(send(article([B, A, C])), bucket);

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: {
        code: "missing_image",
        message: `Images are not stored: ${B}, ${C}.`,
        step: "images",
      },
    });
  });

  it("R2 が失敗すると 502 と upstream_error、step: images を返す", async () => {
    const bucket = bucketWith([A]);
    bucket.head.mockRejectedValue(new Error("head: Internal error"));

    const res = await putArticle(send(article([A])), bucket);

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: {
        code: "upstream_error",
        message: `Could not look up ${A} in R2.`,
        step: "images",
      },
    });
  });

  it("画像が揃った記事は 200 と、コミットの SHA と段 4 以降の null を返す", async () => {
    stubGitHub();
    const bucket = bucketWith([A, B]);
    const markdown = article([A, B]);

    const res = await putArticle(send(markdown), bucket);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      slug: SLUG,
      url: `https://ikili.pro/blog/${SLUG}`,
      hash: await contentHash(markdown),
      commit: COMMIT,
      nostr: null,
      zenn: { commit: null },
    });
    expect(bucket.head.mock.calls).toEqual([[A], [B]]);
  });

  it("技術タグの無い記事は zenn に null を返す", async () => {
    stubGitHub();
    const bucket = bucketWith([]);

    const res = await putArticle(send(article([], "  - 日記")), bucket);

    expect(res.status).toBe(200);
    expect(((await res.json()) as { zenn: unknown }).zenn).toBeNull();
  });
});

describe("PUT /articles/{slug} のコミット", () => {
  const SLUG = "hello-ikili-pro";
  const A = `${"a".repeat(64)}.png`;
  const B = `${"b".repeat(64)}.jpg`;
  const IMG = "https://img.ikili.pro";
  const NOW = "2026-09-28T12:34:56Z";
  const TREES = `POST ${GIT}/trees`;
  const COMMITS = `POST ${GIT}/commits`;
  const REFS = `PATCH ${GIT}/refs/heads/main`;
  const MARKDOWN = [
    "---",
    "title: 記事の題",
    `slug: ${SLUG}`,
    "emoji: 📝",
    "tags:",
    "  - 技術",
    "description: 記事の説明",
    "---",
    "",
    "本文。",
    "",
    `![図](image:${B})`,
    `![図](image:${A})`,
    `![図](image:${B})`,
    "",
  ].join("\n");
  // The article that the Worker commits: the references replaced, `date` before the closing `---`.
  const committedArticle = (date: string) =>
    MARKDOWN.replaceAll("image:", `${IMG}/`).replace(
      "description: 記事の説明\n---\n",
      `description: 記事の説明\ndate: ${date}\n---\n`,
    );
  const OLD_DATE = "2026-01-02T03:04:05Z";
  const OLD_HASH = "d".repeat(64);

  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-28T12:34:56.789Z"));
  });

  const bucket = {
    head: vi.fn<ImageBucket["head"]>(async () => ({
      httpEtag: '"etag"',
      writeHttpMetadata: vi.fn(),
    })),
    put: vi.fn(),
  };

  function publish(
    githubToken: string | null = "github-token",
    markdown = MARKDOWN,
  ) {
    return app.request(
      `/articles/${SLUG}`,
      {
        method: "PUT",
        headers: {
          Authorization: "Bearer test-token",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ markdown }),
      },
      { ...env, GITHUB_TOKEN: githubToken ?? undefined, IMAGES: bucket },
    );
  }

  it("公開の記録に無い記事は、現在時刻を date にした記事のファイルと公開の記録の項目を 1 つのコミットで書き、その SHA を返す", async () => {
    const fetchImpl = stubGitHub();

    const res = await publish();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      slug: SLUG,
      url: `https://ikili.pro/blog/${SLUG}`,
      hash: await contentHash(MARKDOWN),
      commit: COMMIT,
      nostr: null,
      zenn: { commit: null },
    });
    expect(bodyOf(fetchImpl, TREES)).toEqual({
      base_tree: TREE,
      tree: [
        {
          path: `src/content/blog/${SLUG}.md`,
          mode: "100644",
          type: "blob",
          content: committedArticle(NOW),
        },
        {
          path: "src/content/published.json",
          mode: "100644",
          type: "blob",
          content: `${JSON.stringify(
            { articles: { [SLUG]: { hash: null, date: NOW, images: [B, A] } } },
            null,
            2,
          )}\n`,
        },
      ],
    });
    expect(bodyOf(fetchImpl, COMMITS)).toEqual({
      message: `content: ${SLUG} を公開する`,
      tree: NEW_TREE,
      parents: [HEAD],
    });
    expect(bodyOf(fetchImpl, REFS)).toEqual({ sha: COMMIT, force: false });
  });

  it("main の先頭の SHA で公開の記録を読み、同じ SHA を親にする（ref は 1 回だけ読む）", async () => {
    const fetchImpl = stubGitHub();

    await publish();

    expect(calls(fetchImpl)).toEqual([
      `GET ${GIT}/ref/heads/main`,
      `GET ${RECORD}`,
      `GET ${GIT}/commits/${HEAD}`,
      TREES,
      COMMITS,
      REFS,
    ]);
    expect(bodyOf(fetchImpl, COMMITS).parents).toEqual([HEAD]);
  });

  it("公開の記録にある記事はその date を使い、hash を null にして、ほかの記事の項目を残す", async () => {
    const other = { hash: null, date: "2026-02-03T04:05:06Z", images: [] };
    const fetchImpl = stubGitHub({
      [`GET ${RECORD}`]: () =>
        json({
          articles: {
            [SLUG]: { hash: OLD_HASH, date: OLD_DATE, images: [A] },
            "other-article": other,
          },
        }),
    });

    const res = await publish();

    expect(res.status).toBe(200);
    const { tree } = bodyOf(fetchImpl, TREES);
    expect(tree[0].content).toBe(committedArticle(OLD_DATE));
    expect(JSON.parse(tree[1].content)).toEqual({
      articles: {
        [SLUG]: { hash: null, date: OLD_DATE, images: [B, A] },
        "other-article": other,
      },
    });
  });

  it("新しい tree が親の tree と同じときは commit: null の 200 を返し、ref を更新しない", async () => {
    const fetchImpl = stubGitHub({
      [TREES]: () => json({ sha: TREE }, { status: 201 }),
    });

    const res = await publish();

    expect(res.status).toBe(200);
    expect(((await res.json()) as { commit: unknown }).commit).toBeNull();
    expect(calls(fetchImpl)).not.toContain(COMMITS);
    expect(calls(fetchImpl)).not.toContain(REFS);
  });

  it("main が並行した公開で動いた（ref の更新が 422）ときは 409 と conflict、step: commit を返す", async () => {
    stubGitHub({
      [REFS]: () =>
        new Response("Update is not a fast forward", { status: 422 }),
    });

    const res = await publish();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: {
        code: "conflict",
        message: `refs/heads/main on GitHub is no longer ${HEAD}; another publish moved it.`,
        step: "commit",
      },
    });
  });

  it.each([
    [
      "ref の読み出し",
      `GET ${GIT}/ref/heads/main`,
      () => new Response("x", { status: 500 }),
    ],
    [
      "公開の記録の読み出し",
      `GET ${RECORD}`,
      () => new Response("x", { status: 500 }),
    ],
    ["形の違う公開の記録", `GET ${RECORD}`, () => json({})],
    ["tree の作成", TREES, () => new Response("x", { status: 500 })],
  ])(
    "%sが失敗すると 502 と upstream_error、step: commit を返す",
    async (_label, key, answer) => {
      stubGitHub({ [key]: answer });

      const res = await publish();

      expect(res.status).toBe(502);
      expect(await res.json()).toMatchObject({
        error: { code: "upstream_error", step: "commit" },
      });
    },
  );

  it("GITHUB_TOKEN が未設定なら 500 と misconfigured を返し、GitHub を呼ばない", async () => {
    const fetchImpl = stubGitHub();

    const res = await publish(null);

    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({
      error: { code: "misconfigured", message: "GITHUB_TOKEN is not set." },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("frontmatter が ... の行で終わる記事は 422 と invalid_frontmatter を返し、GitHub を呼ばない", async () => {
    const fetchImpl = stubGitHub();

    const res = await publish(
      "github-token",
      MARKDOWN.replace("説明\n---\n", "説明\n...\n---\n"),
    );

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: { code: "invalid_frontmatter", message: DATE_LINE_MESSAGE },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("R2 に無い画像があるときは GitHub を呼ばない", async () => {
    const fetchImpl = stubGitHub();
    bucket.head.mockResolvedValueOnce(null);

    const res = await publish();

    expect(res.status).toBe(422);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});
