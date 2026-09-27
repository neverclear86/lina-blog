import { describe, expect, it, vi } from "vitest";
import {
  createPublishClient,
  type PublishClientOptions,
  readPublishConfig,
} from "./client";

const URL_BASE = "https://publish.example.test";
const TOKEN = "shared-secret";
const IMAGE = `${"a".repeat(64)}.png`;
const SLUG = "hello-world-0001";

/** Returns a `fetch` stub that answers the calls in order with the given responses. */
const stubFetch = (...responses: (() => Response)[]) => {
  const fetchImpl = vi.fn<typeof fetch>();
  for (const response of responses) {
    fetchImpl.mockImplementationOnce(async () => response());
  }
  return fetchImpl;
};

/** Returns a client that calls `fetchImpl` and does not wait between resends. */
const clientWith = (
  fetchImpl: typeof fetch,
  options: PublishClientOptions = {},
) =>
  createPublishClient(
    { url: URL_BASE, token: TOKEN },
    { fetchImpl, retryDelaysMs: [0, 0], ...options },
  );

const errorBody = (status: number, error: Record<string, unknown>) => () =>
  Response.json({ error }, { status });

const init = (fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>, n: number) =>
  fetchImpl.mock.calls[n]?.[1];

describe("readPublishConfig", () => {
  it("PUBLISH_URL と PUBLISH_TOKEN が有れば url と token を返す", () => {
    expect(
      readPublishConfig({ PUBLISH_URL: URL_BASE, PUBLISH_TOKEN: TOKEN }),
    ).toEqual({ url: URL_BASE, token: TOKEN });
  });

  it.each([
    [{ PUBLISH_TOKEN: TOKEN }, "Set the environment variables: PUBLISH_URL."],
    [
      { PUBLISH_URL: URL_BASE, PUBLISH_TOKEN: "" },
      "Set the environment variables: PUBLISH_TOKEN.",
    ],
    [{}, "Set the environment variables: PUBLISH_URL, PUBLISH_TOKEN."],
  ])("無いか空の変数 %j を挙げて投げる", (env, message) => {
    expect(() => readPublishConfig(env)).toThrow(new Error(message));
  });
});

describe("createPublishClient", () => {
  it("一覧、画像の確認とアップロード、記事の公開と取り下げのすべての要求に Bearer の共有シークレットを付ける", async () => {
    const fetchImpl = stubFetch(
      () => Response.json({ articles: [] }),
      () => new Response(null, { status: 404 }),
      () => Response.json({ name: IMAGE }, { status: 201 }),
      () => Response.json({ slug: SLUG }),
      () => new Response(null, { status: 204 }),
    );
    const client = clientWith(fetchImpl);

    await client.listArticles();
    await client.uploadImage(IMAGE, new Uint8Array([1, 2, 3]));
    await client.putArticle(SLUG, "# hi");
    await client.deleteArticle(SLUG);

    expect(fetchImpl).toHaveBeenCalledTimes(5);
    expect(
      fetchImpl.mock.calls.map(
        ([, request]) =>
          (request?.headers as Record<string, string> | undefined)
            ?.Authorization,
      ),
    ).toEqual(Array(5).fill(`Bearer ${TOKEN}`));
  });

  it("一覧を GET /articles で読み、hash の null をそのまま返す", async () => {
    const fetchImpl = stubFetch(() =>
      Response.json({
        articles: [
          { slug: "a-article-0001", hash: "f".repeat(64) },
          { slug: "b-article-0001", hash: null },
        ],
      }),
    );
    const client = createPublishClient(
      { url: `${URL_BASE}/`, token: TOKEN },
      { fetchImpl, retryDelaysMs: [0, 0] },
    );

    const result = await client.listArticles();

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${URL_BASE}/articles`);
    expect(init(fetchImpl, 0)?.method).toBe("GET");
    expect(result).toEqual({
      ok: true,
      value: [
        { slug: "a-article-0001", hash: "f".repeat(64) },
        { slug: "b-article-0001", hash: null },
      ],
    });
  });

  it("一覧の本文の形が違えば unexpected_response を返す", async () => {
    const fetchImpl = stubFetch(() =>
      Response.json({ articles: [{ slug: "a-article-0001" }] }),
    );

    const result = await clientWith(fetchImpl).listArticles();

    expect(result).toEqual({
      ok: false,
      error: {
        status: 200,
        code: "unexpected_response",
        message:
          "The publish Worker answered GET /articles with a body that is not a list of articles.",
      },
    });
  });

  it("HEAD /images/{name} が 200 なら PUT しない", async () => {
    const fetchImpl = stubFetch(() => new Response(null, { status: 200 }));

    const result = await clientWith(fetchImpl).uploadImage(
      IMAGE,
      new Uint8Array([1, 2, 3]),
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${URL_BASE}/images/${IMAGE}`);
    expect(init(fetchImpl, 0)?.method).toBe("HEAD");
    expect(result).toEqual({ ok: true, value: { uploaded: false } });
  });

  it("HEAD が 404 なら Content-Type と Content-Length を付けて画像の本体を PUT する", async () => {
    const fetchImpl = stubFetch(
      () => new Response(null, { status: 404 }),
      () => Response.json({ name: IMAGE }, { status: 201 }),
    );
    const bytes = new Uint8Array([1, 2, 3]);

    const result = await clientWith(fetchImpl).uploadImage(IMAGE, bytes);

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(fetchImpl.mock.calls[1]?.[0]).toBe(`${URL_BASE}/images/${IMAGE}`);
    expect(init(fetchImpl, 1)?.method).toBe("PUT");
    expect(init(fetchImpl, 1)?.headers).toEqual({
      "Content-Type": "image/png",
      "Content-Length": "3",
      Authorization: `Bearer ${TOKEN}`,
    });
    expect(init(fetchImpl, 1)?.body).toBe(bytes);
    expect(result).toEqual({ ok: true, value: { uploaded: true } });
  });

  it("HEAD が 404 以外のエラー（401）なら PUT しない", async () => {
    const fetchImpl = stubFetch(() => new Response(null, { status: 401 }));

    const result = await clientWith(fetchImpl).uploadImage(
      IMAGE,
      new Uint8Array([1]),
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      error: {
        status: 401,
        code: "unexpected_response",
        message: "The publish Worker answered 401 without an error body.",
      },
    });
  });

  it("表に無い拡張子（.svg）の画像は要求を送らずに unsupported_image を返す", async () => {
    const fetchImpl = stubFetch();
    const name = `${"a".repeat(64)}.svg`;

    const result = await clientWith(fetchImpl).uploadImage(
      name,
      new Uint8Array([1]),
    );

    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result).toEqual({
      ok: false,
      error: {
        status: null,
        code: "unsupported_image",
        message: `${name} has an extension that the publish Worker does not accept.`,
      },
    });
  });

  it("記事を PUT /articles/{slug} に markdown の JSON と application/json で送る", async () => {
    const fetchImpl = stubFetch(() => Response.json({ slug: SLUG }));

    const result = await clientWith(fetchImpl).putArticle(SLUG, "# hi\n");

    expect(fetchImpl.mock.calls[0]).toEqual([
      `${URL_BASE}/articles/${SLUG}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${TOKEN}`,
        },
        body: JSON.stringify({ markdown: "# hi\n" }),
      },
    ]);
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("取り下げは DELETE の 2xx を本文に依らず成功とする", async () => {
    const fetchImpl = stubFetch(() => new Response("done", { status: 200 }));

    const result = await clientWith(fetchImpl).deleteArticle(SLUG);

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${URL_BASE}/articles/${SLUG}`);
    expect(init(fetchImpl, 0)?.method).toBe("DELETE");
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("エラーの本文の状態、code、message、step を返し、422 は再送しない", async () => {
    const fetchImpl = stubFetch(
      errorBody(422, {
        code: "invalid_frontmatter",
        message: "title is empty",
        step: "validate",
      }),
    );

    const result = await clientWith(fetchImpl).putArticle(SLUG, "---\n");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      error: {
        status: 422,
        code: "invalid_frontmatter",
        message: "title is empty",
        step: "validate",
      },
    });
  });

  it("本文がエラーの形でない失敗は unexpected_response と状態を返す", async () => {
    const fetchImpl = stubFetch(
      () => new Response("<html>not found</html>", { status: 404 }),
    );

    const result = await clientWith(fetchImpl).deleteArticle(SLUG);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      error: {
        status: 404,
        code: "unexpected_response",
        message: "The publish Worker answered 404 without an error body.",
      },
    });
  });

  it("409 は再送し、次が成功すれば成功を返す", async () => {
    const fetchImpl = stubFetch(
      errorBody(409, { code: "conflict", message: "main moved" }),
      () => Response.json({ slug: SLUG }),
    );

    const result = await clientWith(fetchImpl).putArticle(SLUG, "# hi");

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ ok: true, value: undefined });
  });

  it("5xx は 3 回まで送り、最後のエラーを返す", async () => {
    const fetchImpl = stubFetch(
      errorBody(502, { code: "upstream_error", message: "1", step: "commit" }),
      errorBody(502, { code: "upstream_error", message: "2", step: "commit" }),
      errorBody(502, { code: "upstream_error", message: "3", step: "nostr" }),
      () => Response.json({ slug: SLUG }),
    );

    const result = await clientWith(fetchImpl).putArticle(SLUG, "# hi");

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      ok: false,
      error: {
        status: 502,
        code: "upstream_error",
        message: "3",
        step: "nostr",
      },
    });
  });

  it("fetch が投げると 3 回まで送り、network_error を返す", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });

    const result = await clientWith(fetchImpl).deleteArticle(SLUG);

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      ok: false,
      error: {
        status: null,
        code: "network_error",
        message: `Could not reach the publish Worker for DELETE /articles/${SLUG}.`,
      },
    });
  });

  it("500 の misconfigured は再送しない", async () => {
    const fetchImpl = stubFetch(
      errorBody(500, { code: "misconfigured", message: "no secret" }),
      () => Response.json({ slug: SLUG }),
    );

    const result = await clientWith(fetchImpl).putArticle(SLUG, "# hi");

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      ok: false,
      error: { status: 500, code: "misconfigured", message: "no secret" },
    });
  });

  it("既定では 1 秒と 4 秒を待って 2 回まで再送する", async () => {
    vi.useFakeTimers();
    try {
      const fetchImpl = vi.fn<typeof fetch>(async () =>
        errorBody(503, { code: "internal_error", message: "down" })(),
      );
      const client = createPublishClient(
        { url: URL_BASE, token: TOKEN },
        { fetchImpl },
      );

      const pending = client.deleteArticle(SLUG);

      await vi.advanceTimersByTimeAsync(999);
      expect(fetchImpl).toHaveBeenCalledTimes(1);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(3999);
      expect(fetchImpl).toHaveBeenCalledTimes(2);
      await vi.advanceTimersByTimeAsync(1);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
      await vi.advanceTimersByTimeAsync(10_000);
      expect(fetchImpl).toHaveBeenCalledTimes(3);
      expect(await pending).toEqual({
        ok: false,
        error: { status: 503, code: "internal_error", message: "down" },
      });
    } finally {
      vi.useRealTimers();
    }
  });

  it("エラーの本文が JSON でも形が違えば unexpected_response と状態を返す", async () => {
    const fetchImpl = stubFetch(errorBody(400, { code: 1, message: "x" }));

    const result = await clientWith(fetchImpl).putArticle(SLUG, "# hi");

    expect(result).toEqual({
      ok: false,
      error: {
        status: 400,
        code: "unexpected_response",
        message: "The publish Worker answered 400 without an error body.",
      },
    });
  });

  it("エラーの本文の step が文字列でなければ step を返さない", async () => {
    const fetchImpl = stubFetch(
      errorBody(422, {
        code: "invalid_frontmatter",
        message: "title is empty",
        step: 3,
      }),
    );

    const result = await clientWith(fetchImpl).putArticle(SLUG, "---\n");

    expect(result).toEqual({
      ok: false,
      error: {
        status: 422,
        code: "invalid_frontmatter",
        message: "title is empty",
      },
    });
  });

  it("本文がエラーの形でない 502（<html>）も 3 回まで送り、unexpected_response を返す", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response("<html>bad gateway</html>", { status: 502 }),
    );

    const result = await clientWith(fetchImpl).putArticle(SLUG, "# hi");

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(result).toEqual({
      ok: false,
      error: {
        status: 502,
        code: "unexpected_response",
        message: "The publish Worker answered 502 without an error body.",
      },
    });
  });
});
