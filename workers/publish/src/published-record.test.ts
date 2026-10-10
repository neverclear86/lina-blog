import { describe, expect, it, vi } from "vitest";
import {
  exclusiveImages,
  listPublishedArticles,
  type PublishedEntry,
  type PublishedRecord,
  readPublishedRecord,
  serializePublishedRecord,
  withoutPublishedEntry,
  withPublishedEntry,
} from "./published-record";

const TOKEN = "github-token";
const RECORD_URL =
  "https://api.github.com/repos/neverclear86/lina-blog/contents/src/content/published.json?ref=main";
const HASH_A = "a".repeat(64);
const HASH_B = "0123456789abcdef".repeat(4);
const DATE = "2026-09-28T12:34:56Z";
const IMAGE = `${HASH_B}.png`;
const IMAGE_X = `${"1".repeat(64)}.webp`;
const IMAGE_Y = `${"2".repeat(64)}.jpg`;
const IMAGE_Z = `${"3".repeat(64)}.png`;
const SHA = "0123456789abcdef0123456789abcdef01234567";
const BASE_URL =
  "https://api.github.com/repos/neverclear86/lina-blog/contents/src/content/published.json";

/** An entry of the published record, with `overrides` on top of a valid one. */
const entry = (overrides: Partial<PublishedEntry> = {}): PublishedEntry => ({
  hash: HASH_A,
  date: DATE,
  images: [IMAGE],
  ...overrides,
});

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
          zeta: { hash: HASH_A, date: DATE, images: [] },
          9: { hash: null, date: DATE, images: [] },
          10: { hash: HASH_B, date: DATE, images: [] },
          alpha: { hash: null, date: DATE, images: [] },
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
    ["hash が無い", `{"articles":{"a":{"date":"${DATE}","images":[]}}}`],
    [
      "hash が大文字",
      `{"articles":{"a":{"hash":"${"A".repeat(64)}","date":"${DATE}","images":[]}}}`,
    ],
    [
      "hash が 63 文字",
      `{"articles":{"a":{"hash":"${"a".repeat(63)}","date":"${DATE}","images":[]}}}`,
    ],
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

describe("readPublishedRecord", () => {
  it("ref をクエリに付けて公開の記録を読む", async () => {
    const fetchImpl = stubFetch(JSON.stringify({ articles: {} }));

    const result = await readPublishedRecord(
      { token: TOKEN, ref: SHA },
      fetchImpl,
    );

    expect(result).toEqual({ ok: true, record: { articles: {} } });
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE_URL}?ref=${SHA}`);
  });

  it("ref を URL のクエリとして符号化する", async () => {
    const fetchImpl = stubFetch(JSON.stringify({ articles: {} }));

    await readPublishedRecord({ token: TOKEN, ref: "a/b&c" }, fetchImpl);

    expect(fetchImpl.mock.calls[0]?.[0]).toBe(`${BASE_URL}?ref=a%2Fb%26c`);
  });

  it("項目の hash・date・images だけを記録として返し、ほかのフィールドを落とす", async () => {
    const fetchImpl = stubFetch(
      JSON.stringify({
        extra: 1,
        articles: {
          a: { hash: HASH_A, date: DATE, images: [IMAGE], title: "x" },
          b: { hash: null, date: DATE, images: [] },
        },
      }),
    );

    const result = await readPublishedRecord(
      { token: TOKEN, ref: "main" },
      fetchImpl,
    );

    expect(result).toEqual({
      ok: true,
      record: {
        articles: {
          a: { hash: HASH_A, date: DATE, images: [IMAGE] },
          b: { hash: null, date: DATE, images: [] },
        },
      },
    });
  });

  it("__proto__ の slug も記録の項目として返す", async () => {
    const fetchImpl = stubFetch(
      `{"articles":{"__proto__":{"hash":null,"date":"${DATE}","images":[]},"b":{"hash":null,"date":"${DATE}","images":[]}}}`,
    );

    const result = await readPublishedRecord(
      { token: TOKEN, ref: "main" },
      fetchImpl,
    );

    expect(
      result.ok && Object.hasOwn(result.record.articles, "__proto__"),
    ).toBe(true);
  });

  it("公開の記録が無い（404）ときは空の記録を返す", async () => {
    const fetchImpl = stubFetch("Not Found", { status: 404 });

    const result = await readPublishedRecord(
      { token: TOKEN, ref: "main" },
      fetchImpl,
    );

    expect(result).toEqual({ ok: true, record: { articles: {} } });
  });

  it("GitHub が失敗を返すと、状態コードを含む説明で失敗を返す（503）", async () => {
    const fetchImpl = stubFetch("", { status: 503 });

    const result = await readPublishedRecord(
      { token: TOKEN, ref: "main" },
      fetchImpl,
    );

    expect(result).toEqual({
      ok: false,
      message: "GitHub answered 503 when reading src/content/published.json.",
    });
  });

  it.each([
    ["date が無い", { hash: HASH_A, images: [] }],
    ["date が日付だけ", { hash: HASH_A, date: "2026-09-28", images: [] }],
    [
      "date がミリ秒付き",
      { hash: HASH_A, date: "2026-09-28T12:34:56.000Z", images: [] },
    ],
    [
      "date がオフセット付き",
      { hash: HASH_A, date: "2026-09-28T12:34:56+09:00", images: [] },
    ],
    [
      "date が暦に無い日",
      { hash: HASH_A, date: "2026-02-30T00:00:00Z", images: [] },
    ],
    [
      "date の月が 13",
      { hash: HASH_A, date: "2026-13-01T00:00:00Z", images: [] },
    ],
    ["images が無い", { hash: HASH_A, date: DATE }],
    ["images が文字列", { hash: HASH_A, date: DATE, images: IMAGE }],
    ["images の要素が数値", { hash: HASH_A, date: DATE, images: [1] }],
    [
      "images の名前の形が違う",
      { hash: HASH_A, date: DATE, images: ["a.png"] },
    ],
    [
      "images の拡張子が違う",
      { hash: HASH_A, date: DATE, images: [`${HASH_B}.svg`] },
    ],
  ])("項目の形が違う（%s）ときは失敗を返す", async (_label, bad) => {
    const fetchImpl = stubFetch(JSON.stringify({ articles: { a: bad } }));

    const result = await readPublishedRecord(
      { token: TOKEN, ref: "main" },
      fetchImpl,
    );

    expect(result).toEqual({
      ok: false,
      message:
        "src/content/published.json on GitHub is not a valid published record.",
    });
  });
});

describe("withPublishedEntry", () => {
  it("新しい slug の項目を足し、既存の項目を残す", () => {
    const record: PublishedRecord = { articles: { a: entry() } };

    const result = withPublishedEntry(record, "b", entry({ hash: null }));

    expect(result).toEqual({
      articles: { a: entry(), b: entry({ hash: null }) },
    });
  });

  it("既存の slug の項目を置き換え、渡した記録を変えない", () => {
    const record: PublishedRecord = { articles: { a: entry() } };

    const result = withPublishedEntry(record, "a", entry({ hash: HASH_B }));

    expect(result).toEqual({ articles: { a: entry({ hash: HASH_B }) } });
    expect(record).toEqual({ articles: { a: entry() } });
  });

  it("__proto__ の slug の項目も足す", () => {
    const result = withPublishedEntry({ articles: {} }, "__proto__", entry());

    expect(Object.hasOwn(result.articles, "__proto__")).toBe(true);
  });
});

describe("withoutPublishedEntry", () => {
  const record: PublishedRecord = {
    articles: { a: entry(), b: entry({ hash: null }) },
  };

  it("指定した slug の項目を除き、ほかの項目を残す", () => {
    expect(withoutPublishedEntry(record, "a")).toEqual({
      articles: { b: entry({ hash: null }) },
    });
  });

  it("渡した記録を変えない", () => {
    withoutPublishedEntry(record, "a");

    expect(Object.keys(record.articles)).toEqual(["a", "b"]);
  });

  it("記録に無い slug には、項目をすべて残した写しを返す", () => {
    const result = withoutPublishedEntry(record, "missing");

    expect(result).toEqual(record);
    expect(result).not.toBe(record);
  });

  it("__proto__ の slug の項目も、ほかの項目と同じに残し、除く", () => {
    const withProto = JSON.parse(
      `{"articles":{"__proto__":{"hash":null,"date":"${DATE}","images":[]},"b":{"hash":null,"date":"${DATE}","images":[]}}}`,
    ) as PublishedRecord;

    const withoutB = withoutPublishedEntry(withProto, "b");
    const withoutProto = withoutPublishedEntry(withProto, "__proto__");

    expect(Object.hasOwn(withoutB.articles, "__proto__")).toBe(true);
    expect(Object.hasOwn(withoutProto.articles, "__proto__")).toBe(false);
    expect(Object.keys(withoutProto.articles)).toEqual(["b"]);
  });
});

describe("exclusiveImages", () => {
  const record: PublishedRecord = {
    articles: {
      a: entry({ images: [IMAGE_X, IMAGE_Y, IMAGE] }),
      b: entry({ images: [IMAGE_Y] }),
      c: entry({ images: [IMAGE, IMAGE_Z] }),
    },
  };

  it("他の記事の images に無い画像だけを、項目の images の順に返す", () => {
    const ordered: PublishedRecord = {
      articles: {
        a: entry({ images: [IMAGE_Y, IMAGE_X, IMAGE_Z, IMAGE] }),
        b: entry({ images: [IMAGE] }),
      },
    };

    expect(exclusiveImages(ordered, "a")).toEqual([IMAGE_Y, IMAGE_X, IMAGE_Z]);
    expect(exclusiveImages(record, "a")).toEqual([IMAGE_X]);
  });

  it("すべての画像を他の記事も参照していれば、空の配列を返す", () => {
    expect(exclusiveImages(record, "b")).toEqual([]);
  });

  it("hash が null の記事の images も参照として数える", () => {
    const partway: PublishedRecord = {
      articles: {
        a: entry({ images: [IMAGE_X, IMAGE_Y] }),
        b: entry({ hash: null, images: [IMAGE_Y] }),
      },
    };

    expect(exclusiveImages(partway, "a")).toEqual([IMAGE_X]);
  });

  it("項目の images が同じ名前を重ねていても、1 つにして返す", () => {
    const repeated: PublishedRecord = {
      articles: { a: entry({ images: [IMAGE_X, IMAGE_Y, IMAGE_X] }) },
    };

    expect(exclusiveImages(repeated, "a")).toEqual([IMAGE_X, IMAGE_Y]);
  });

  it("記録に項目の無い slug には空の配列を返す", () => {
    expect(exclusiveImages(record, "missing")).toEqual([]);
  });
});

describe("serializePublishedRecord", () => {
  it("slug の昇順に並べ、JSON.stringify(値, null, 2) の後に改行 1 つにする", () => {
    const record: PublishedRecord = {
      articles: {
        b: { hash: null, date: DATE, images: [] },
        a: { hash: HASH_A, date: DATE, images: [IMAGE] },
      },
    };

    expect(serializePublishedRecord(record)).toBe(
      `{
  "articles": {
    "a": {
      "hash": "${HASH_A}",
      "date": "${DATE}",
      "images": [
        "${IMAGE}"
      ]
    },
    "b": {
      "hash": null,
      "date": "${DATE}",
      "images": []
    }
  }
}
`,
    );
  });

  it("空の記録を書き出す", () => {
    expect(serializePublishedRecord({ articles: {} })).toBe(
      '{\n  "articles": {}\n}\n',
    );
  });

  it("項目のキーを hash・date・images の順に書く", () => {
    const record = {
      articles: { a: { images: [], date: DATE, hash: null } },
    } as PublishedRecord;

    const json = serializePublishedRecord(record);

    expect(Object.keys(JSON.parse(json).articles.a)).toEqual([
      "hash",
      "date",
      "images",
    ]);
  });

  it("__proto__ の slug の項目も書き出す", () => {
    const record = JSON.parse(
      `{"articles":{"__proto__":{"hash":null,"date":"${DATE}","images":[]}}}`,
    ) as PublishedRecord;

    const json = serializePublishedRecord(record);

    expect(Object.keys(JSON.parse(json).articles)).toContain("__proto__");
  });
});
