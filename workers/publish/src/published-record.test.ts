import { describe, expect, it, vi } from "vitest";
import { listPublishedArticles } from "./published-record";

const TOKEN = "github-token";
const RECORD_URL =
  "https://api.github.com/repos/neverclear86/lina-blog/contents/src/content/published.json?ref=main";
const HASH_A = "a".repeat(64);
const HASH_B = "0123456789abcdef".repeat(4);

/** Returns a `fetch` stub that answers every call with `body` as the response text. */
const stubFetch = (body: string | null, init?: ResponseInit) =>
  vi.fn<typeof fetch>(async () => new Response(body, init));

describe("listPublishedArticles", () => {
  it("main の公開の記録を raw の形で、トークンと User-Agent を付けて GitHub から読む", async () => {
    const fetchImpl = stubFetch(JSON.stringify({ articles: {} }));

    await listPublishedArticles({ token: TOKEN }, fetchImpl);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0]).toEqual([
      RECORD_URL,
      {
        headers: {
          Accept: "application/vnd.github.raw+json",
          Authorization: `Bearer ${TOKEN}`,
          "User-Agent": "lina-blog-publish",
          "X-GitHub-Api-Version": "2022-11-28",
        },
      },
    ]);
  });

  it("apiUrl を渡すとその基底 URL から読む", async () => {
    const fetchImpl = stubFetch(JSON.stringify({ articles: {} }));

    await listPublishedArticles(
      { token: TOKEN, apiUrl: "http://127.0.0.1:9999" },
      fetchImpl,
    );

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(
      "http://127.0.0.1:9999/repos/neverclear86/lina-blog/contents/src/content/published.json?ref=main",
    );
  });

  it("記録の記事を slug の昇順に並べ、保存済みの hash と null をそのまま返す", async () => {
    const fetchImpl = stubFetch(
      JSON.stringify({
        articles: {
          zeta: { hash: HASH_A, date: "2026-09-01", images: [] },
          9: { hash: null },
          10: { hash: HASH_B },
          alpha: { hash: null },
        },
      }),
    );

    const result = await listPublishedArticles({ token: TOKEN }, fetchImpl);

    expect(result).toEqual({
      ok: true,
      articles: [
        { slug: "10", hash: HASH_B },
        { slug: "9", hash: null },
        { slug: "alpha", hash: null },
        { slug: "zeta", hash: HASH_A },
      ],
    });
  });

  it("公開の記録が無い（404）ときは空の一覧を返す", async () => {
    const fetchImpl = stubFetch("Not Found", { status: 404 });

    const result = await listPublishedArticles({ token: TOKEN }, fetchImpl);

    expect(result).toEqual({ ok: true, articles: [] });
  });

  it("GitHub が 404 以外の失敗を返すと、状態コードを含む説明で失敗を返す（401）", async () => {
    const fetchImpl = stubFetch("Bad credentials", { status: 401 });

    const result = await listPublishedArticles({ token: TOKEN }, fetchImpl);

    expect(result).toEqual({
      ok: false,
      message: "GitHub answered 401 when reading src/content/published.json.",
    });
  });

  it("GitHub に届かないときは失敗を返し、例外を投げない", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });

    const result = await listPublishedArticles({ token: TOKEN }, fetchImpl);

    expect(result).toEqual({
      ok: false,
      message: "Could not reach GitHub to read src/content/published.json.",
    });
  });

  it.each([
    ["JSON でない", "not json"],
    ["null", "null"],
    ["articles が無い", "{}"],
    ["articles が配列", '{"articles":[]}'],
    ["項目が null", '{"articles":{"a":null}}'],
    ["hash が無い", '{"articles":{"a":{}}}'],
    ["hash が大文字", `{"articles":{"a":{"hash":"${"A".repeat(64)}"}}}`],
    ["hash が 63 文字", `{"articles":{"a":{"hash":"${"a".repeat(63)}"}}}`],
  ])("公開の記録の形が違う（%s）ときは失敗を返す", async (_label, body) => {
    const fetchImpl = stubFetch(body);

    const result = await listPublishedArticles({ token: TOKEN }, fetchImpl);

    expect(result).toEqual({
      ok: false,
      message:
        "src/content/published.json on GitHub is not a valid published record.",
    });
  });
});
