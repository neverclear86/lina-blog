import { afterEach, describe, expect, it, vi } from "vitest";
import { experimental_readRawConfig } from "wrangler";
import app from "./app";
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

describe("PUT /articles/{slug}", () => {
  const AUTHORIZATION = "Bearer test-token";
  const SLUG = "hello-ikili-pro";
  const A = `${"a".repeat(64)}.png`;
  const B = `${"b".repeat(64)}.jpg`;
  const C = `${"c".repeat(64)}.webp`;
  const IMG = "https://img.ikili.pro";

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
      { ...env, IMAGES: bucket },
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

  it("画像が揃った記事は 200 と、差し替えた markdown と段 3 以降の null を返す", async () => {
    const bucket = bucketWith([A, B]);
    const markdown = article([A, B]);

    const res = await putArticle(send(markdown), bucket);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      slug: SLUG,
      url: `https://ikili.pro/blog/${SLUG}`,
      hash: await contentHash(markdown),
      commit: null,
      nostr: null,
      zenn: { commit: null },
      markdown: markdown
        .replace(`image:${A}`, `${IMG}/${A}`)
        .replace(`image:${B}`, `${IMG}/${B}`),
    });
    expect(bucket.head.mock.calls).toEqual([[A], [B]]);
  });

  it("技術タグの無い記事は zenn に null を返す", async () => {
    const bucket = bucketWith([]);

    const res = await putArticle(send(article([], "  - 日記")), bucket);

    expect(res.status).toBe(200);
    expect(((await res.json()) as { zenn: unknown }).zenn).toBeNull();
  });
});
