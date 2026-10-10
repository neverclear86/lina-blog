import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { experimental_readRawConfig } from "wrangler";
import app from "./app";
import { DATE_LINE_MESSAGE } from "./article-markdown";
import { contentHash } from "./content-hash";
import {
  AUTHOR_PUBKEY,
  BUNKER_RELAY,
  BUNKER_URL,
  CLIENT_KEY,
  FakeNostrSocket,
  nostr,
  SIGNER_PUBKEY,
  WRITE_RELAYS,
} from "./fake-nostr";
import type { ImageBucket, StoredImage } from "./images";

const env = { PUBLISH_TOKEN: "test-token" };

// The Nostr settings of the Worker, for the bunker that fake-nostr.ts plays.
const NOSTR_ENV = {
  NOSTR_CLIENT_KEY: CLIENT_KEY,
  NOSTR_BUNKER_URL: BUNKER_URL,
};

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
const RECORD_TREE = "5".repeat(40);
const RECORD_COMMIT = "6".repeat(40);
const ZENN_HEAD = "7".repeat(40);
const ZENN_TREE = "8".repeat(40);
const ZENN_NEW_TREE = "9".repeat(40);
const ZENN_COMMIT = "a".repeat(40);
const GIT = "https://api.github.com/repos/neverclear86/lina-blog/git";
const ZENN_GIT = "https://api.github.com/repos/neverclear86/zenn-contents/git";
const RECORD_URL =
  "https://api.github.com/repos/neverclear86/lina-blog/contents/src/content/published.json";
const RECORD = `${RECORD_URL}?ref=${HEAD}`;
// The published record that step 6 reads, on top of the commit that step 3 made.
const RECORD_AT_COMMIT = `${RECORD_URL}?ref=${COMMIT}`;

const json = (body: unknown, init?: ResponseInit) =>
  new Response(JSON.stringify(body), init);

type Answer = () => Response | Promise<Response>;

/**
 * Replaces the global `fetch` with a stub that answers by `"<METHOD> <URL>"`. The default
 * answers are those of a successful publish: step 3 on top of `HEAD`, whose published record
 * does not exist, step 5 on top of `ZENN_HEAD` of zenn-contents, and step 6 on top of
 * `COMMIT`, whose published record has the article with a null hash. `overrides` replaces the
 * answer of a key; an array answers the n-th call of the key with its n-th element and the
 * calls after its end with its last element. A key it does not know is answered 599.
 */
const stubGitHub = (overrides: Record<string, Answer | Answer[]> = {}) => {
  const ref =
    (sha: string): Answer =>
    () =>
      json({ object: { sha } });
  const answers: Record<string, Answer | Answer[]> = {
    [`GET ${GIT}/ref/heads/main`]: [ref(HEAD), ref(COMMIT)],
    [`GET ${RECORD}`]: () => new Response("Not Found", { status: 404 }),
    [`GET ${RECORD_AT_COMMIT}`]: () =>
      json({
        articles: {
          "hello-ikili-pro": {
            hash: null,
            date: "2026-09-28T12:34:56Z",
            images: [`${"b".repeat(64)}.jpg`, `${"a".repeat(64)}.png`],
          },
        },
      }),
    [`GET ${GIT}/commits/${HEAD}`]: () => json({ tree: { sha: TREE } }),
    [`GET ${GIT}/commits/${COMMIT}`]: () => json({ tree: { sha: NEW_TREE } }),
    [`POST ${GIT}/trees`]: [
      () => json({ sha: NEW_TREE }, { status: 201 }),
      () => json({ sha: RECORD_TREE }, { status: 201 }),
    ],
    [`POST ${GIT}/commits`]: [
      () => json({ sha: COMMIT }, { status: 201 }),
      () => json({ sha: RECORD_COMMIT }, { status: 201 }),
    ],
    [`PATCH ${GIT}/refs/heads/main`]: () => json({ ref: "refs/heads/main" }),
    [`GET ${ZENN_GIT}/ref/heads/master`]: ref(ZENN_HEAD),
    [`GET ${ZENN_GIT}/commits/${ZENN_HEAD}`]: () =>
      json({ tree: { sha: ZENN_TREE } }),
    [`POST ${ZENN_GIT}/trees`]: () =>
      json({ sha: ZENN_NEW_TREE }, { status: 201 }),
    [`POST ${ZENN_GIT}/commits`]: () =>
      json({ sha: ZENN_COMMIT }, { status: 201 }),
    [`PATCH ${ZENN_GIT}/refs/heads/master`]: () =>
      json({ ref: "refs/heads/master" }),
    ...overrides,
  };
  const counts: Record<string, number> = {};
  const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
    const key = `${init?.method ?? "GET"} ${String(input)}`;
    const answer = answers[key];
    const n = counts[key] ?? 0;
    counts[key] = n + 1;
    const fn = Array.isArray(answer)
      ? answer[Math.min(n, answer.length - 1)]
      : answer;
    return fn?.() ?? new Response("unknown", { status: 599 });
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

/** The JSON bodies of every call of `fetchImpl` that is `"<METHOD> <URL>"`, in order. */
const bodiesOf = (fetchImpl: ReturnType<typeof stubGitHub>, key: string) =>
  fetchImpl.mock.calls
    .filter(([url, init]) => `${init?.method ?? "GET"} ${url}` === key)
    .map(([, init]) => JSON.parse(String(init?.body)));

beforeEach(() => {
  nostr.reset();
  vi.stubGlobal("WebSocket", FakeNostrSocket);
});

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
      { ...env, ...NOSTR_ENV, GITHUB_TOKEN: "github-token", IMAGES: bucket },
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

  it("画像が揃った記事は 200 と、段 3 のコミット、Nostr のイベント ID、Zenn のコミットの SHA を返す", async () => {
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
      nostr: { eventId: nostr.posted[0].event.id },
      zenn: { commit: ZENN_COMMIT },
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
    nostrEnv: Record<string, string> = NOSTR_ENV,
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
      {
        ...env,
        ...nostrEnv,
        GITHUB_TOKEN: githubToken ?? undefined,
        IMAGES: bucket,
      },
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
      nostr: { eventId: nostr.posted[0].event.id },
      zenn: { commit: ZENN_COMMIT },
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

  it("段 3 と段 6 はそれぞれ main の先頭の SHA で公開の記録を読み、同じ SHA を親にする", async () => {
    const fetchImpl = stubGitHub();

    await publish();

    expect(calls(fetchImpl)).toEqual([
      `GET ${GIT}/ref/heads/main`,
      `GET ${RECORD}`,
      `GET ${GIT}/commits/${HEAD}`,
      TREES,
      COMMITS,
      REFS,
      `GET ${ZENN_GIT}/ref/heads/master`,
      `GET ${ZENN_GIT}/commits/${ZENN_HEAD}`,
      `POST ${ZENN_GIT}/trees`,
      `POST ${ZENN_GIT}/commits`,
      `PATCH ${ZENN_GIT}/refs/heads/master`,
      `GET ${GIT}/ref/heads/main`,
      `GET ${RECORD_AT_COMMIT}`,
      `GET ${GIT}/commits/${COMMIT}`,
      TREES,
      COMMITS,
      REFS,
    ]);
    expect(bodiesOf(fetchImpl, COMMITS).map((b) => b.parents)).toEqual([
      [HEAD],
      [COMMIT],
    ]);
  });

  it("段 3 の後に、公開の記録の hash を内容のハッシュにした記録だけを段 3 のコミットを親にして書く", async () => {
    const fetchImpl = stubGitHub();

    const res = await publish();

    expect(res.status).toBe(200);
    expect(((await res.json()) as { commit: unknown }).commit).toBe(COMMIT);
    expect(bodiesOf(fetchImpl, TREES)[1]).toEqual({
      base_tree: NEW_TREE,
      tree: [
        {
          path: "src/content/published.json",
          mode: "100644",
          type: "blob",
          content: `${JSON.stringify(
            {
              articles: {
                [SLUG]: {
                  hash: await contentHash(MARKDOWN),
                  date: NOW,
                  images: [B, A],
                },
              },
            },
            null,
            2,
          )}\n`,
        },
      ],
    });
    expect(bodiesOf(fetchImpl, COMMITS)[1]).toEqual({
      message: `content: ${SLUG} の公開を記録する`,
      tree: RECORD_TREE,
      parents: [COMMIT],
    });
    expect(bodiesOf(fetchImpl, REFS)[1]).toEqual({
      sha: RECORD_COMMIT,
      force: false,
    });
  });

  it("公開の記録の hash がすでに内容のハッシュなら段 6 のコミットを作らない", async () => {
    const hash = await contentHash(MARKDOWN);
    const fetchImpl = stubGitHub({
      [`GET ${RECORD_AT_COMMIT}`]: () =>
        json({ articles: { [SLUG]: { hash, date: NOW, images: [B, A] } } }),
    });

    const res = await publish();

    expect(res.status).toBe(200);
    expect(calls(fetchImpl).slice(11)).toEqual([
      `GET ${GIT}/ref/heads/main`,
      `GET ${RECORD_AT_COMMIT}`,
    ]);
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
      [`GET ${GIT}/ref/heads/main`]: () => json({ object: { sha: HEAD } }),
      [`GET ${RECORD}`]: () =>
        json({
          articles: { [SLUG]: { hash: null, date: NOW, images: [B, A] } },
        }),
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

  it("段 6 で main が並行した公開で動いた（ref の更新が 422）ときは 409 と conflict、step: record を返し、記録の hash は null のままである", async () => {
    const fetchImpl = stubGitHub({
      [REFS]: [
        () => json({ ref: "refs/heads/main" }),
        () => new Response("Update is not a fast forward", { status: 422 }),
      ],
    });

    const res = await publish();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: {
        code: "conflict",
        message: `refs/heads/main on GitHub is no longer ${COMMIT}; another publish moved it.`,
        step: "record",
      },
    });
    const written = JSON.parse(bodiesOf(fetchImpl, TREES)[0].tree[1].content);
    expect(written.articles[SLUG].hash).toBeNull();
  });

  it("段 3 の後に公開の記録から記事の項目が消えていたときは 409 と conflict、step: record を返し、コミットを作らない", async () => {
    const fetchImpl = stubGitHub({
      [`GET ${RECORD_AT_COMMIT}`]: () => json({ articles: {} }),
    });

    const res = await publish();

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: {
        code: "conflict",
        message: `src/content/published.json on main has no entry for ${SLUG} after step 3.`,
        step: "record",
      },
    });
    expect(calls(fetchImpl)).toHaveLength(13);
  });

  it.each([
    [
      "段 6 の ref の読み出し",
      `GET ${GIT}/ref/heads/main`,
      [
        () => json({ object: { sha: HEAD } }),
        () => new Response("x", { status: 500 }),
      ],
    ],
    [
      "段 6 の公開の記録の読み出し",
      `GET ${RECORD_AT_COMMIT}`,
      () => new Response("x", { status: 500 }),
    ],
    [
      "段 6 の tree の作成",
      TREES,
      [
        () => json({ sha: NEW_TREE }, { status: 201 }),
        () => new Response("x", { status: 500 }),
      ],
    ],
  ])(
    "%sが失敗すると 502 と upstream_error、step: record を返す",
    async (_label, key, answer) => {
      stubGitHub({ [key]: answer });

      const res = await publish();

      expect(res.status).toBe(502);
      expect(await res.json()).toMatchObject({
        error: { code: "upstream_error", step: "record" },
      });
    },
  );

  it("段 6 で失敗した記事の再送は、段 3 でコミットを作らずに段 6 で hash を書く", async () => {
    const fetchImpl = stubGitHub({
      [`GET ${GIT}/ref/heads/main`]: () => json({ object: { sha: HEAD } }),
      [`GET ${RECORD}`]: () =>
        json({
          articles: { [SLUG]: { hash: null, date: NOW, images: [B, A] } },
        }),
      [TREES]: [
        () => json({ sha: TREE }, { status: 201 }),
        () => json({ sha: RECORD_TREE }, { status: 201 }),
      ],
      [COMMITS]: () => json({ sha: RECORD_COMMIT }, { status: 201 }),
    });

    const res = await publish();

    expect(res.status).toBe(200);
    expect(((await res.json()) as { commit: unknown }).commit).toBeNull();
    expect(bodiesOf(fetchImpl, COMMITS)).toEqual([
      {
        message: `content: ${SLUG} の公開を記録する`,
        tree: RECORD_TREE,
        parents: [HEAD],
      },
    ]);
  });

  it("完了した記事を同じ内容で送り直すと、段 3 は hash を残し、段 3 も段 6 もコミットを作らない", async () => {
    const hash = await contentHash(MARKDOWN);
    const fetchImpl = stubGitHub({
      [`GET ${GIT}/ref/heads/main`]: () => json({ object: { sha: HEAD } }),
      [`GET ${RECORD}`]: () =>
        json({ articles: { [SLUG]: { hash, date: NOW, images: [B, A] } } }),
      [TREES]: () => json({ sha: TREE }, { status: 201 }),
    });

    const res = await publish();

    expect(res.status).toBe(200);
    const written = JSON.parse(bodiesOf(fetchImpl, TREES)[0].tree[1].content);
    expect(written.articles[SLUG].hash).toBe(hash);
    expect(bodiesOf(fetchImpl, TREES)).toHaveLength(1);
    expect(calls(fetchImpl)).not.toContain(COMMITS);
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

describe("PUT /articles/{slug} の Nostr への投稿", () => {
  const SLUG = "hello-ikili-pro";
  const A = `${"a".repeat(64)}.png`;
  const B = `${"b".repeat(64)}.jpg`;
  const NOW = "2026-09-28T12:34:56Z";
  const OLD_DATE = "2026-01-02T03:04:05Z";
  const REFS = `PATCH ${GIT}/refs/heads/main`;
  const COMMITS = `POST ${GIT}/commits`;
  const seconds = (date: string) => String(Date.parse(date) / 1000);
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
    "",
  ].join("\n");
  // The body that the event carries: the text after the frontmatter, the references replaced.
  const BODY = MARKDOWN.replaceAll("image:", "https://img.ikili.pro/").split(
    "\n---\n",
  )[1];

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
    markdown = MARKDOWN,
    nostrEnv: {
      NOSTR_CLIENT_KEY?: string;
      NOSTR_BUNKER_URL?: string;
    } = NOSTR_ENV,
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
      {
        ...env,
        ...nostrEnv,
        GITHUB_TOKEN: "github-token",
        IMAGES: bucket,
      },
    );
  }

  it("段 4 は公開の記録の date を published_at にして署名し、write リレーに投稿して eventId を返す", async () => {
    stubGitHub({
      [`GET ${RECORD}`]: () =>
        json({
          articles: { [SLUG]: { hash: null, date: OLD_DATE, images: [B, A] } },
        }),
    });

    const res = await publish();

    expect(res.status).toBe(200);
    expect(nostr.posted.map((post) => post.relay)).toEqual(WRITE_RELAYS);
    const { event } = nostr.posted[0];
    expect(event.tags).toEqual([
      ["d", SLUG],
      ["title", "記事の題"],
      ["published_at", seconds(OLD_DATE)],
      ["summary", "記事の説明"],
      ["t", "技術"],
    ]);
    expect(event.created_at).toBe(
      Math.floor(Date.parse("2026-09-28T12:34:56.789Z") / 1000),
    );
    expect(event.content).toBe(BODY);
    expect(((await res.json()) as { nostr: unknown }).nostr).toEqual({
      eventId: event.id,
    });
  });

  it("記録に記事が無い最初の公開は published_at が段 3 で決めた date になる", async () => {
    stubGitHub();

    await publish();

    expect(nostr.posted[0].event.tags).toContainEqual([
      "published_at",
      seconds(NOW),
    ]);
  });

  it("段 4 は段 3 のコミットの後、段 6 の読み直しの前に行う", async () => {
    const fetchImpl = stubGitHub();
    const posted = vi.fn();
    nostr.onPost = posted;

    await publish();

    const all = calls(fetchImpl);
    const ref = fetchImpl.mock.invocationCallOrder[all.indexOf(REFS)];
    const reread =
      fetchImpl.mock.invocationCallOrder[
        all.indexOf(`GET ${GIT}/ref/heads/main`, 1)
      ];
    expect(posted).toHaveBeenCalled();
    expect(posted.mock.invocationCallOrder[0]).toBeGreaterThan(ref);
    expect(posted.mock.invocationCallOrder[0]).toBeLessThan(reread);
  });

  it("署名できなければ 502 と upstream_error、step: nostr を返し、段 6 のコミットを作らない", async () => {
    const fetchImpl = stubGitHub();
    nostr.signError = "denied";

    const res = await publish();

    expect(res.status).toBe(502);
    expect(await res.json()).toEqual({
      error: {
        code: "upstream_error",
        message: "Signing failed: sign_event: denied",
        step: "nostr",
      },
    });
    expect(calls(fetchImpl).filter((call) => call === COMMITS)).toHaveLength(1);
    expect(nostr.posted).toEqual([]);
  });

  it("どのリレーも受理しなければ 502 と upstream_error、step: nostr を返す", async () => {
    stubGitHub();
    nostr.accepts = { [WRITE_RELAYS[0]]: false, [WRITE_RELAYS[1]]: false };

    const res = await publish();

    expect(res.status).toBe(502);
    const { error } = (await res.json()) as {
      error: { code: string; message: string; step: string };
    };
    expect(error.code).toBe("upstream_error");
    expect(error.step).toBe("nostr");
    expect(error.message).toContain("No relay accepted the event.");
  });

  it("NIP-46 の要求に収まらない長い記事は段 3 の前に 422 と invalid_markdown を返し、GitHub を呼ばない", async () => {
    const fetchImpl = stubGitHub();

    const res = await publish(`${MARKDOWN}${'"'.repeat(20_000)}\n`);

    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({
      error: {
        code: "invalid_markdown",
        message:
          "The article is too long for one NIP-46 sign_event request (65535 bytes).",
      },
    });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(nostr.urls).toEqual([]);
  });

  it.each([
    {
      name: "クライアント鍵が無い",
      nostrEnv: { NOSTR_BUNKER_URL: BUNKER_URL },
    },
    { name: "bunker URL が無い", nostrEnv: { NOSTR_CLIENT_KEY: CLIENT_KEY } },
    {
      name: "bunker URL の形が違う",
      nostrEnv: {
        NOSTR_CLIENT_KEY: CLIENT_KEY,
        NOSTR_BUNKER_URL: "bunker://x",
      },
    },
  ])(
    "$name なら段 3 の前に 500 と misconfigured を返し、GitHub を呼ばない",
    async ({ nostrEnv }) => {
      const fetchImpl = stubGitHub();

      const res = await publish(MARKDOWN, nostrEnv);

      expect(res.status).toBe(500);
      expect(
        ((await res.json()) as { error: { code: string } }).error.code,
      ).toBe("misconfigured");
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(nostr.urls).toEqual([]);
    },
  );
});

describe("DELETE /articles/{slug}", () => {
  const SLUG = "hello-ikili-pro";
  const A = `${"a".repeat(64)}.png`;
  const B = `${"b".repeat(64)}.jpg`;
  const DATE = "2026-01-02T03:04:05Z";
  const TREES = `POST ${GIT}/trees`;
  const COMMITS = `POST ${GIT}/commits`;
  const REFS = `PATCH ${GIT}/refs/heads/main`;
  const MAIN_REF = `GET ${GIT}/ref/heads/main`;
  // The tree of the commit that step 4 builds on, as `GET git/trees/{sha}?recursive=1` lists it.
  const TREE_LIST = `GET ${GIT}/trees/${NEW_TREE}?recursive=1`;
  const entry = (images: string[]) => ({
    hash: "d".repeat(64),
    date: DATE,
    images,
  });
  // The published record: the article has A and B, and `other` has B.
  const RECORD_BODY = {
    articles: { [SLUG]: entry([A, B]), other: entry([B]) },
  };

  const bucket = () => ({
    head: vi.fn<ImageBucket["head"]>(),
    put: vi.fn(),
    delete: vi.fn<ImageBucket["delete"]>(async () => undefined),
  });

  /**
   * Stubs GitHub for a successful withdrawal: step 1 reads `HEAD`, step 4 reads `COMMIT`
   * (main has moved by then), and the tree of `COMMIT` has the article file.
   */
  const stubWithdraw = (overrides: Record<string, Answer | Answer[]> = {}) =>
    stubGitHub({
      [MAIN_REF]: [
        () => json({ object: { sha: HEAD } }),
        () => json({ object: { sha: COMMIT } }),
      ],
      [`GET ${RECORD}`]: () => json(RECORD_BODY),
      [`GET ${RECORD_AT_COMMIT}`]: () => json(RECORD_BODY),
      [TREE_LIST]: () =>
        json({
          tree: [
            { type: "blob", path: `src/content/blog/${SLUG}.md` },
            { type: "blob", path: "src/content/published.json" },
          ],
          truncated: false,
        }),
      [TREES]: () => json({ sha: RECORD_TREE }, { status: 201 }),
      [COMMITS]: () => json({ sha: RECORD_COMMIT }, { status: 201 }),
      ...overrides,
    });

  function withdraw(
    images: ReturnType<typeof bucket>,
    options: {
      authorization?: string | null;
      githubToken?: string | null;
      nostrEnv?: { NOSTR_CLIENT_KEY?: string; NOSTR_BUNKER_URL?: string };
    } = {},
  ) {
    const {
      authorization = "Bearer test-token",
      githubToken = "github-token",
    } = options;
    return app.request(
      `/articles/${SLUG}`,
      {
        method: "DELETE",
        headers: authorization === null ? {} : { Authorization: authorization },
      },
      {
        ...env,
        ...(options.nostrEnv ?? NOSTR_ENV),
        GITHUB_TOKEN: githubToken ?? undefined,
        IMAGES: images,
      },
    );
  }

  it("認証の無いリクエストは 401 を返し、GitHub・R2・Nostr に触れない", async () => {
    const fetchImpl = stubWithdraw();
    const images = bucket();

    const res = await withdraw(images, { authorization: null });

    expect(res.status).toBe(401);
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(images.delete).not.toHaveBeenCalled();
    expect(nostr.urls).toEqual([]);
  });

  it("他の記事が参照しない画像だけを R2 から消し、記事のファイルと項目を 1 つのコミットで消して 200 を返す", async () => {
    const fetchImpl = stubWithdraw();
    const images = bucket();

    const res = await withdraw(images);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      slug: SLUG,
      commit: RECORD_COMMIT,
      nostr: { eventId: nostr.posted[0].event.id },
      images: [A],
    });
    expect(images.delete.mock.calls).toEqual([[[A]]]);
    expect(bodyOf(fetchImpl, TREES)).toEqual({
      base_tree: NEW_TREE,
      tree: [
        {
          path: "src/content/published.json",
          mode: "100644",
          type: "blob",
          content: `${JSON.stringify({ articles: { other: entry([B]) } }, null, 2)}\n`,
        },
        {
          path: `src/content/blog/${SLUG}.md`,
          mode: "100644",
          type: "blob",
          sha: null,
        },
      ],
    });
    expect(bodyOf(fetchImpl, COMMITS)).toEqual({
      message: `content: ${SLUG} を取り下げる`,
      tree: RECORD_TREE,
      parents: [COMMIT],
    });
    expect(bodyOf(fetchImpl, REFS)).toEqual({
      sha: RECORD_COMMIT,
      force: false,
    });
  });

  it("どの画像も他の記事が参照していれば R2 を呼ばない", async () => {
    const shared = {
      articles: { [SLUG]: entry([A, B]), other: entry([A, B]) },
    };
    stubWithdraw({
      [`GET ${RECORD}`]: () => json(shared),
      [`GET ${RECORD_AT_COMMIT}`]: () => json(shared),
    });
    const images = bucket();

    const res = await withdraw(images);

    expect(res.status).toBe(200);
    expect(((await res.json()) as { images: string[] }).images).toEqual([]);
    expect(images.delete).not.toHaveBeenCalled();
  });

  it("NIP-09 の削除依頼を、バンカーが返す投稿者の公開鍵の a タグで write リレーに投稿する", async () => {
    stubWithdraw();

    const res = await withdraw(bucket());

    expect(res.status).toBe(200);
    expect(nostr.posted.map((post) => post.relay)).toEqual(WRITE_RELAYS);
    const { event } = nostr.posted[0];
    expect(event.kind).toBe(5);
    expect(event.pubkey).toBe(AUTHOR_PUBKEY);
    expect(AUTHOR_PUBKEY).not.toBe(SIGNER_PUBKEY);
    expect(event.tags).toEqual([
      ["a", `30023:${AUTHOR_PUBKEY}:${SLUG}`],
      ["k", "30023"],
    ]);
    expect(nostr.methods).toEqual([
      "get_public_key",
      "get_public_key",
      "sign_event",
    ]);
    expect(nostr.urls.filter((url) => url === BUNKER_RELAY)).toHaveLength(2);
    expect(nostr.peak).toBeLessThanOrEqual(5);
    expect(nostr.open).toBe(0);
    expect(((await res.json()) as { nostr: unknown }).nostr).toEqual({
      eventId: event.id,
    });
  });

  it("署名者が知らない client なら、公開と取り下げの両方の署名の権限で connect を送る", async () => {
    stubWithdraw();
    nostr.known = false;

    const res = await withdraw(bucket());

    expect(res.status).toBe(200);
    expect(nostr.connects).toEqual([
      [SIGNER_PUBKEY, "s3cret", "sign_event:30023,sign_event:5"],
    ]);
  });

  it("段は Nostr、画像、コミットの順に行う", async () => {
    const postedBeforeDelete: number[] = [];
    const deletesBeforeRef: number[] = [];
    const images = bucket();
    images.delete.mockImplementation(async () => {
      postedBeforeDelete.push(nostr.posted.length);
    });
    stubWithdraw({
      [REFS]: () => {
        deletesBeforeRef.push(images.delete.mock.calls.length);
        return json({ ref: "refs/heads/main" });
      },
    });

    await withdraw(images);

    expect(postedBeforeDelete).toEqual([WRITE_RELAYS.length]);
    expect(deletesBeforeRef).toEqual([1]);
  });

  it("段 4 は読み直した main の先頭を親にする", async () => {
    const fetchImpl = stubWithdraw();

    await withdraw(bucket());

    expect(calls(fetchImpl)).toEqual([
      MAIN_REF,
      `GET ${RECORD}`,
      MAIN_REF,
      `GET ${RECORD_AT_COMMIT}`,
      `GET ${GIT}/commits/${COMMIT}`,
      TREE_LIST,
      TREES,
      COMMITS,
      REFS,
    ]);
    expect(bodiesOf(fetchImpl, COMMITS).map((b) => b.parents)).toEqual([
      [COMMIT],
    ]);
  });

  it("公開の記録に無い slug は 404 not_found を返し、何も書かない", async () => {
    const fetchImpl = stubWithdraw({
      [`GET ${RECORD}`]: () => json({ articles: { other: entry([B]) } }),
    });
    const images = bucket();

    const res = await withdraw(images);

    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: {
        code: "not_found",
        message: `The published record has no article ${SLUG}.`,
      },
    });
    expect(nostr.urls).toEqual([]);
    expect(images.delete).not.toHaveBeenCalled();
    expect(calls(fetchImpl)).not.toContain(TREES);
  });

  it.each([
    {
      name: "GitHub のトークンが無い",
      options: { githubToken: null },
    },
    {
      name: "クライアント鍵が無い",
      options: { nostrEnv: { NOSTR_BUNKER_URL: BUNKER_URL } },
    },
    {
      name: "bunker URL が無い",
      options: { nostrEnv: { NOSTR_CLIENT_KEY: CLIENT_KEY } },
    },
    {
      name: "bunker URL の形が違う",
      options: {
        nostrEnv: {
          NOSTR_CLIENT_KEY: CLIENT_KEY,
          NOSTR_BUNKER_URL: "bunker://x",
        },
      },
    },
  ])(
    "$name なら 500 と misconfigured を返し、GitHub と Nostr に触れない",
    async ({ options }) => {
      const fetchImpl = stubWithdraw();

      const res = await withdraw(bucket(), options);

      expect(res.status).toBe(500);
      expect(
        ((await res.json()) as { error: { code: string } }).error.code,
      ).toBe("misconfigured");
      expect(fetchImpl).not.toHaveBeenCalled();
      expect(nostr.urls).toEqual([]);
    },
  );

  // The last step that a failing request reaches, in order: the bunker is contacted, a
  // signature is asked, R2 is called, a tree is created, a commit is created.
  const STAGES = [
    "none",
    "bunker",
    "signed",
    "images",
    "trees",
    "commits",
  ] as const;
  type Stage = (typeof STAGES)[number];

  const failure = (status: number) => () => new Response("failed", { status });
  const SECOND_REF_500 = [() => json({ object: { sha: HEAD } }), failure(500)];

  it.each([
    {
      name: "1 回目の main の先頭の読み出しが失敗する",
      overrides: { [MAIN_REF]: failure(500) },
      status: 502,
      code: "upstream_error",
      step: "record",
      reached: "none",
    },
    {
      name: "1 回目の公開の記録の読み出しが失敗する",
      overrides: { [`GET ${RECORD}`]: failure(500) },
      status: 502,
      code: "upstream_error",
      step: "record",
      reached: "none",
    },
    {
      name: "投稿者の公開鍵が得られない",
      setup: () => {
        nostr.publicKeyError = "busy";
      },
      status: 502,
      code: "upstream_error",
      step: "nostr",
      message: "Getting the public key failed: get_public_key: busy",
      reached: "bunker",
    },
    {
      name: "署名が断られる",
      setup: () => {
        nostr.signError = "permission denied";
      },
      status: 502,
      code: "upstream_error",
      step: "nostr",
      message: "Signing failed: sign_event: permission denied",
      reached: "signed",
    },
    {
      name: "どのリレーも受理しない",
      setup: () => {
        nostr.accepts = { [WRITE_RELAYS[0]]: false, [WRITE_RELAYS[1]]: false };
        nostr.okMessages = {
          [WRITE_RELAYS[0]]: "blocked: no deletes",
          [WRITE_RELAYS[1]]: "blocked: no deletes",
        };
      },
      status: 502,
      code: "upstream_error",
      step: "nostr",
      messageContains: "blocked: no deletes",
      reached: "signed",
    },
    {
      name: "R2 の削除が失敗する",
      setup: (images: ReturnType<typeof bucket>) => {
        images.delete.mockRejectedValue(new Error("delete: Internal error"));
      },
      status: 502,
      code: "upstream_error",
      step: "images",
      reached: "images",
    },
    {
      name: "2 回目の main の先頭の読み出しが失敗する",
      overrides: { [MAIN_REF]: SECOND_REF_500 },
      status: 502,
      code: "upstream_error",
      step: "commit",
      reached: "images",
    },
    {
      name: "2 回目の公開の記録の読み出しが失敗する",
      overrides: { [`GET ${RECORD_AT_COMMIT}`]: failure(500) },
      status: 502,
      code: "upstream_error",
      step: "commit",
      reached: "images",
    },
    {
      name: "2 回目の公開の記録に項目が無い",
      overrides: {
        [`GET ${RECORD_AT_COMMIT}`]: () =>
          json({ articles: { other: entry([B]) } }),
      },
      status: 409,
      code: "conflict",
      step: "commit",
      message: `src/content/published.json on main has no entry for ${SLUG}; another call has withdrawn it.`,
      reached: "images",
    },
    {
      name: "tree の作成が失敗する",
      overrides: { [TREES]: failure(500) },
      status: 502,
      code: "upstream_error",
      step: "commit",
      reached: "trees",
    },
    {
      name: "main の更新が 422 で断られる",
      overrides: { [REFS]: failure(422) },
      status: 409,
      code: "conflict",
      step: "commit",
      reached: "commits",
    },
  ] as {
    name: string;
    overrides?: Record<string, Answer | Answer[]>;
    setup?: (images: ReturnType<typeof bucket>) => void;
    status: number;
    code: string;
    step: string;
    message?: string;
    messageContains?: string;
    reached: Stage;
  }[])(
    "$name とき、$status と $code（step: $step）を返し、後の段に進まない",
    async ({
      overrides,
      setup,
      status,
      code,
      step,
      message,
      messageContains,
      reached,
    }) => {
      const fetchImpl = stubWithdraw(overrides);
      const images = bucket();
      setup?.(images);

      const res = await withdraw(images);

      expect(res.status).toBe(status);
      const { error } = (await res.json()) as {
        error: { code: string; message: string; step: string };
      };
      expect(error.code).toBe(code);
      expect(error.step).toBe(step);
      if (message !== undefined) expect(error.message).toBe(message);
      if (messageContains !== undefined) {
        expect(error.message).toContain(messageContains);
      }
      const made = calls(fetchImpl);
      const at = STAGES.indexOf(reached);
      expect(nostr.urls.length > 0).toBe(at >= 1);
      expect(nostr.methods.includes("sign_event")).toBe(at >= 2);
      if (reached === "bunker")
        expect(nostr.methods).toEqual(["get_public_key"]);
      expect(images.delete.mock.calls.length > 0).toBe(at >= 3);
      expect(made.includes(TREES)).toBe(at >= 4);
      expect(made.includes(COMMITS)).toBe(at >= 5);
    },
  );

  it("画像の削除が失敗した後の再送で、取り下げが完了する", async () => {
    const images = bucket();
    images.delete.mockRejectedValueOnce(new Error("delete: Internal error"));
    stubWithdraw();

    const first = await withdraw(images);
    const second = await (async () => {
      stubWithdraw();
      return withdraw(images);
    })();

    expect(first.status).toBe(502);
    expect(second.status).toBe(200);
    expect(images.delete.mock.calls).toEqual([[[A]], [[A]]]);
    expect(
      nostr.posted.filter((p) => p.relay === WRITE_RELAYS[0]),
    ).toHaveLength(2);
    expect(nostr.posted.every((p) => p.event.kind === 5)).toBe(true);
  });

  it("コミットが失敗した後の再送で、取り下げが完了する", async () => {
    const images = bucket();
    stubWithdraw({ [REFS]: failure(500) });

    const first = await withdraw(images);
    stubWithdraw();
    const second = await withdraw(images);

    expect(first.status).toBe(502);
    expect(
      ((await first.json()) as { error: { step: string } }).error.step,
    ).toBe("commit");
    expect(second.status).toBe(200);
    expect(
      nostr.posted.filter((p) => p.relay === WRITE_RELAYS[0]),
    ).toHaveLength(2);
    expect(images.delete.mock.calls).toEqual([[[A]], [[A]]]);
  });
});

describe("PUT /articles/{slug} の Zenn への転載", () => {
  const SLUG = "hello-ikili-pro";
  const A = `${"a".repeat(64)}.png`;
  const ZENN_TREES = `POST ${ZENN_GIT}/trees`;
  const ZENN_COMMITS = `POST ${ZENN_GIT}/commits`;
  const ZENN_REFS = `PATCH ${ZENN_GIT}/refs/heads/master`;
  const ZENN_READ = `GET ${ZENN_GIT}/ref/heads/master`;
  const MAIN_READ = `GET ${GIT}/ref/heads/main`;

  function article(tags: string, body: string): string {
    return `---\ntitle: 記事の題\nslug: ${SLUG}\nemoji: 📝\ntags:\n  - ${tags}\ndescription: 記事の説明\n---\n\n${body}\n`;
  }

  const bucket = {
    head: vi.fn<ImageBucket["head"]>(async () => ({
      httpEtag: '"etag"',
      writeHttpMetadata: vi.fn(),
    })),
    put: vi.fn(),
  };

  function publish(markdown: string, extra: Record<string, unknown> = {}) {
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
      {
        ...env,
        ...NOSTR_ENV,
        GITHUB_TOKEN: "github-token",
        IMAGES: bucket,
        ...extra,
      },
    );
  }

  const TECH = article("技術", `本文。\n\n![図](image:${A})`);
  const zennCalls = (fetchImpl: ReturnType<typeof stubGitHub>) =>
    calls(fetchImpl).filter((call) => call.includes("/zenn-contents/"));

  beforeEach(() => {
    bucket.head.mockClear();
  });

  it("技術タグの記事は zenn-contents の master に articles/<slug>.md を書くコミットを作り、その SHA を zenn に返す", async () => {
    const fetchImpl = stubGitHub();

    const res = await publish(TECH);

    expect(res.status).toBe(200);
    expect(((await res.json()) as { zenn: unknown }).zenn).toEqual({
      commit: ZENN_COMMIT,
    });
    const [tree] = bodiesOf(fetchImpl, ZENN_TREES);
    expect(tree.base_tree).toBe(ZENN_TREE);
    expect(tree.tree).toHaveLength(1);
    const [file] = tree.tree;
    expect(file).toMatchObject({
      path: `articles/${SLUG}.md`,
      mode: "100644",
      type: "blob",
    });
    expect(file.content).toContain("published: true");
    expect(file.content).toContain(`https://img.ikili.pro/${A}`);
    expect(file.content).toContain(`https://ikili.pro/blog/${SLUG}`);
    expect(file.content).not.toContain("image:");
    expect(file.content).not.toContain("date:");
    expect(bodyOf(fetchImpl, ZENN_COMMITS)).toEqual({
      message: `content: ${SLUG} を Zenn に転載する`,
      tree: ZENN_NEW_TREE,
      parents: [ZENN_HEAD],
    });
    expect(bodyOf(fetchImpl, ZENN_REFS)).toEqual({
      sha: ZENN_COMMIT,
      force: false,
    });
  });

  it("技術タグの無い記事は zenn-contents に要求を送らず、生の HTML もそのまま通す", async () => {
    const fetchImpl = stubGitHub();

    const res = await publish(article("日記", "<kbd>Ctrl</kbd> を押す。"));

    expect(res.status).toBe(200);
    expect(((await res.json()) as { zenn: unknown }).zenn).toBeNull();
    expect(zennCalls(fetchImpl)).toEqual([]);
  });

  it("zenn-contents の木が変わらないときは commit: null の 200 を返し、ref を更新しない", async () => {
    const fetchImpl = stubGitHub({
      [ZENN_TREES]: () => json({ sha: ZENN_TREE }, { status: 201 }),
    });

    const res = await publish(TECH);

    expect(res.status).toBe(200);
    expect(((await res.json()) as { zenn: unknown }).zenn).toEqual({
      commit: null,
    });
    expect(zennCalls(fetchImpl)).toEqual([
      ZENN_READ,
      `GET ${ZENN_GIT}/commits/${ZENN_HEAD}`,
      ZENN_TREES,
    ]);
  });

  it.each([
    ["ref の読み出し", ZENN_READ],
    ["親のコミットの読み出し", `GET ${ZENN_GIT}/commits/${ZENN_HEAD}`],
    ["tree の作成", ZENN_TREES],
    ["コミットの作成", ZENN_COMMITS],
    ["ref の更新", ZENN_REFS],
  ])(
    "zenn-contents の%sが失敗すると 502 と upstream_error、step: zenn を返し、段 6 を行わない",
    async (_label, key) => {
      const fetchImpl = stubGitHub({
        [key]: () => new Response("x", { status: 500 }),
      });

      const res = await publish(TECH);

      expect(res.status).toBe(502);
      const { error } = (await res.json()) as {
        error: { code: string; step: string };
      };
      expect(error.code).toBe("upstream_error");
      expect(error.step).toBe("zenn");
      expect(calls(fetchImpl)).not.toContain(`GET ${RECORD_AT_COMMIT}`);
      expect(
        calls(fetchImpl).filter((call) => call === MAIN_READ),
      ).toHaveLength(1);
    },
  );

  it("zenn-contents の master が動いた（ref の更新が 422）ときは 409 と conflict、step: zenn を返す", async () => {
    stubGitHub({
      [ZENN_REFS]: () => new Response("x", { status: 422 }),
    });

    const res = await publish(TECH);

    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: {
        code: "conflict",
        message: `refs/heads/master on GitHub is no longer ${ZENN_HEAD}; another publish moved it.`,
        step: "zenn",
      },
    });
  });

  it("段 5 は段 3 の後で段 6 の前に行い、段 5 で失敗しても記事のファイルは main に書いてある", async () => {
    const fetchImpl = stubGitHub({
      [ZENN_TREES]: () => new Response("x", { status: 500 }),
    });

    await publish(TECH);

    const all = calls(fetchImpl);
    expect(all.filter((call) => call === `POST ${GIT}/commits`)).toHaveLength(
      1,
    );
    expect(all.at(-1)).toBe(ZENN_TREES);
  });

  it("Zenn で表示できない HTML のある技術記事は 422 と invalid_markdown、step: zenn を返し、R2 も GitHub も呼ばない", async () => {
    const fetchImpl = stubGitHub();

    const res = await publish(
      article("技術", `<kbd>Ctrl</kbd>\n\n![図](image:${A})`),
    );

    expect(res.status).toBe(422);
    const { error } = (await res.json()) as {
      error: { code: string; message: string; step: string };
    };
    expect(error.code).toBe("invalid_markdown");
    expect(error.step).toBe("zenn");
    expect(error.message).toContain("The body has HTML that Zenn cannot show");
    expect(bucket.head).not.toHaveBeenCalled();
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("GITHUB_API_URL があれば zenn-contents への要求も同じ基底 URL に送る", async () => {
    const base = "https://github.example";
    const inner = stubGitHub();
    const urls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn<typeof fetch>(async (input, init) => {
        const url = String(input);
        urls.push(url);
        return inner(url.replace(base, "https://api.github.com"), init);
      }),
    );

    const res = await publish(TECH, { GITHUB_API_URL: base });

    expect(res.status).toBe(200);
    expect(urls.every((url) => url.startsWith(`${base}/`))).toBe(true);
    expect(urls.filter((url) => url.includes("/zenn-contents/"))).toHaveLength(
      5,
    );
  });

  it("段 5 は段 4 の投稿の後に行い、段 4 で失敗すると zenn-contents に要求を送らない", async () => {
    const posted = vi.fn();
    nostr.onPost = posted;
    const fetchImpl = stubGitHub();

    await publish(TECH);

    const zennRead =
      fetchImpl.mock.invocationCallOrder[calls(fetchImpl).indexOf(ZENN_READ)];
    expect(posted).toHaveBeenCalled();
    expect(posted.mock.invocationCallOrder[0]).toBeLessThan(zennRead);

    const failed = stubGitHub();
    nostr.signError = "denied";

    const res = await publish(TECH);

    expect(res.status).toBe(502);
    expect(zennCalls(failed)).toEqual([]);
  });
});
