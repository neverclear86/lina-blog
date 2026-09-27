import { describe, expect, it } from "vitest";
import { workLinkRows, workPagePaths } from "./work-pages";

const work = (slug: string, hasPage: boolean) => ({
  data: { slug, hasPage },
});

const site = new URL("https://ikili.pro");

const empty = { videos: [], posts: [] };

describe("workPagePaths", () => {
  it("詳細ページありの作品だけを言語ごとに返す", () => {
    const paths = workPagePaths([
      work("a", true),
      work("b", false),
      work("c", true),
    ]);
    expect(paths.map((p) => `${p.params.lang}/${p.params.slug}`)).toEqual([
      "ja/a",
      "en/a",
      "ja/c",
      "en/c",
    ]);
  });

  it("props に言語と作品を渡す", () => {
    const a = work("a", true);
    expect(workPagePaths([a]).map((p) => p.props)).toEqual([
      { lang: "ja", work: a },
      { lang: "en", work: a },
    ]);
  });

  it("詳細ページありの作品が無ければ空を返す", () => {
    expect(workPagePaths([work("b", false)])).toEqual([]);
  });
});

describe("workLinkRows", () => {
  it("デモ、リポジトリ、関連動画、制作記の順に並べる", () => {
    const rows = workLinkRows(
      {
        demo: "https://demo.example/",
        repo: "https://github.com/a/b",
        videos: [
          { url: "https://example.com/v1", name: "動画 1" },
          { url: "https://example.com/v2", name: "動画 2" },
        ],
        posts: [{ url: "https://example.com/p", name: "制作記" }],
      },
      "ja",
      site,
    );
    expect(rows.map((r) => [r.kind, r.href])).toEqual([
      ["demo", "https://demo.example/"],
      ["repo", "https://github.com/a/b"],
      ["video", "https://example.com/v1"],
      ["video", "https://example.com/v2"],
      ["blog", "https://example.com/p"],
    ]);
  });

  it("無いリンクの行は出さない", () => {
    const rows = workLinkRows(
      { ...empty, demo: "https://demo.example/" },
      "ja",
      site,
    );
    expect(rows.map((r) => r.kind)).toEqual(["demo"]);
  });

  it("名前があれば名前を文字にする", () => {
    const [row] = workLinkRows(
      { ...empty, videos: [{ url: "https://example.com/v", name: "動画" }] },
      "ja",
      site,
    );
    expect(row?.text).toBe("動画");
  });

  it("名前が無ければ URL から https:// を除いた文字列を文字にする", () => {
    const [row] = workLinkRows(
      { ...empty, repo: "https://github.com/a/b" },
      "ja",
      site,
    );
    expect(row).toEqual({
      kind: "repo",
      href: "https://github.com/a/b",
      text: "github.com/a/b",
      external: true,
    });
  });

  it.each([
    ["ja", "https://x.com/lina", "Twitter(自称X)"],
    ["en", "https://www.twitter.com/lina", "Twitter (self-proclaimed X)"],
  ] as const)(
    "名前の無い Twitter の URL は %s で Twitter の表記を文字にする",
    (lang, url, text) => {
      const [row] = workLinkRows({ ...empty, posts: [{ url }] }, lang, site);
      expect(row?.text).toBe(text);
    },
  );

  it("サイトと同じホストのリンクは外のサイトとしない", () => {
    const [row] = workLinkRows(
      { ...empty, demo: "https://ikili.pro/" },
      "ja",
      site,
    );
    expect(row?.external).toBe(false);
  });
});
