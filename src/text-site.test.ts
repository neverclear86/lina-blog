import { describe, expect, it } from "vitest";
import { buildTextSite, displayWidth, type TextSitePost } from "./text-site";

const site = new URL("https://example.com");

const post = (
  slug: string,
  date: string,
  title = `記事 ${slug}`,
  sponsor?: { name: string },
): TextSitePost => ({ data: { title, slug, date: new Date(date), sponsor } });

const posts = [
  post("post-aaaaaaaaaa1", "2026-01-01"),
  post("post-aaaaaaaaaa6", "2026-06-01"),
  post("post-aaaaaaaaaa3", "2026-03-01"),
  post("post-aaaaaaaaaa5", "2026-05-01"),
  post("post-aaaaaaaaaa2", "2026-02-01"),
  post("post-aaaaaaaaaa4", "2026-04-01"),
];

const longTitlePosts = [
  post("post-long-kanji1", "2026-07-01", "長".repeat(50)),
  post("post-long-emoji1", "2026-07-02", "🧪".repeat(40)),
];

const HEADINGS = {
  ja: [
    "$ whoami  # 自己紹介",
    "$ ls ~/works  # つくったもの",
    "$ ls ~/blog  # 最新記事",
    "$ cat ~/links  # リンク",
    "$ mail lina  # お問い合わせ",
  ],
  en: [
    "$ whoami  # About",
    "$ ls ~/works  # Works",
    "$ ls ~/blog  # Latest posts (in Japanese)",
    "$ cat ~/links  # Links",
    "$ mail lina  # Contact",
  ],
} as const;

const POST_LINE = /^\d{4}-\d\d-\d\d {2}/;

describe("buildTextSite", () => {
  it.each(["ja", "en"] as const)(
    "%s: 5 つの節の見出しをこの順に出す",
    (locale) => {
      const lines = buildTextSite(locale, posts, site).split("\n");
      expect(lines.filter((line) => line.startsWith("$ "))).toEqual(
        HEADINGS[locale],
      );
    },
  );

  it.each(["ja", "en"] as const)(
    "%s: 先頭は ikili.pro と空行で、各節の見出しの直前は空行 1 つである",
    (locale) => {
      const lines = buildTextSite(locale, posts, site).split("\n");
      expect(lines.slice(0, 2)).toEqual(["ikili.pro", ""]);
      for (const heading of HEADINGS[locale]) {
        const index = lines.indexOf(heading);
        expect(lines[index - 1], heading).toBe("");
        expect(lines[index - 2], heading).not.toBe("");
      }
    },
  );

  it.each([
    ["ja", "創好リナ（Tsukusu Lina）", "バーチャルイキリプログラマ"],
    ["en", "Tsukusu Lina (創好リナ)", 'A virtual "ikiri" programmer'],
  ] as const)("%s: 自己紹介に名前と肩書きを載せる", (locale, name, title) => {
    const text = buildTextSite(locale, [], site);
    expect(text).toContain(`\n${name}\n`);
    expect(text).toContain(`\n${title}`);
  });

  it.each(["ja", "en"] as const)(
    "%s: 作品の節に ikili.pro と nostr-no-su を載せる",
    (locale) => {
      const text = buildTextSite(locale, [], site);
      expect(text).toContain("\nikili.pro\n  ");
      expect(text).toContain("\nnostr-no-su\n  ");
    },
  );

  it("最新記事は日付の新しい順に 5 件まで、日付とタイトルと記事の絶対 URL を載せる", () => {
    const lines = buildTextSite("ja", posts, site).split("\n");
    expect(lines.filter((line) => POST_LINE.test(line))).toEqual([
      "2026-06-01  記事 post-aaaaaaaaaa6",
      "2026-05-01  記事 post-aaaaaaaaaa5",
      "2026-04-01  記事 post-aaaaaaaaaa4",
      "2026-03-01  記事 post-aaaaaaaaaa3",
      "2026-02-01  記事 post-aaaaaaaaaa2",
    ]);
    const index = lines.indexOf("2026-06-01  記事 post-aaaaaaaaaa6");
    expect(lines[index + 1]).toBe(
      "  https://example.com/blog/post-aaaaaaaaaa6/",
    );
  });

  it.each([
    ["ja", "まだ記事はありません。"],
    ["en", "No posts yet."],
  ] as const)("%s: 記事が 0 件のときは %s と書く", (locale, message) => {
    expect(buildTextSite(locale, [], site)).toContain(`\n${message}\n`);
    expect(buildTextSite(locale, posts, site)).not.toContain(message);
  });

  it("記事の日付は日本時間の日付で書く", () => {
    const text = buildTextSite(
      "ja",
      [post("post-aaaaaaaaaa1", "2026-01-01T20:00:00Z")],
      site,
    );
    expect(text).toContain("\n2026-01-02  ");
  });

  it("スポンサー付きの記事はタイトルの前に【PR】を付ける", () => {
    const text = buildTextSite(
      "ja",
      [post("post-aaaaaaaaaa1", "2026-01-01", "紹介", { name: "ACME" })],
      site,
    );
    expect(text).toContain("\n2026-01-01  【PR】紹介\n");
  });

  it("表示幅に収まらないタイトルは ... で切る", () => {
    const lines = buildTextSite("ja", longTitlePosts, site)
      .split("\n")
      .filter((line) => POST_LINE.test(line));
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(line.endsWith("..."), line).toBe(true);
      expect(displayWidth(line), line).toBeLessThanOrEqual(80);
      expect(line, line).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
      expect(line, line).not.toContain("�");
    }
  });

  it("記事の節に RSS の絶対 URL を載せる", () => {
    expect(buildTextSite("ja", posts, site)).toContain(
      "\nRSS: https://example.com/rss.xml\n",
    );
  });

  it("記事が 0 件でも RSS の絶対 URL を載せる", () => {
    expect(buildTextSite("en", [], site)).toContain(
      "\nRSS: https://example.com/rss.xml\n",
    );
  });

  it.each([
    ["ja", "Twitter(自称X)"],
    ["en", "Twitter (self-proclaimed X)"],
  ] as const)(
    "%s: リンクを YouTube、%s、GitHub、Nostr、Zenn の順に載せる",
    (locale, twitter) => {
      const text = buildTextSite(locale, [], site);
      const lines = text.split("\n");
      const start = lines.indexOf(HEADINGS[locale][3]);
      const end = lines.indexOf(HEADINGS[locale][4]);
      const labels = lines
        .slice(start + 1, end)
        .filter((line) => line.includes(" - ") && !line.startsWith(" "))
        .map((line) => line.split(" - ")[0]);
      expect(labels).toEqual(["YouTube", twitter, "GitHub", "Nostr", "Zenn"]);
      expect(text).toContain("\n  https://zenn.dev/linatsukusu\n");
      expect(text).toContain("\n  nostr:npub1");
    },
  );

  it.each([
    [
      "ja",
      "お仕事のご相談やコラボのお誘いなどはこちらから。",
      "フォーム: https://example.com/ja/contact/",
    ],
    [
      "en",
      "For work inquiries, collaborations and more,",
      "use the form: https://example.com/en/contact/",
    ],
  ] as const)(
    "%s: お問い合わせの節の末尾に、誘いの行と、言語のお問い合わせのページの絶対 URL の行を載せる",
    (locale, lead, form) => {
      const lines = buildTextSite(locale, [], site).split("\n");
      expect(lines.slice(-3, -1)).toEqual([lead, form]);
    },
  );

  it.each(["ja", "en"] as const)(
    "%s: 全ての行の表示幅が 80 以下である",
    (locale) => {
      const text = buildTextSite(locale, [...posts, ...longTitlePosts], site);
      for (const line of text.split("\n")) {
        expect(displayWidth(line), line).toBeLessThanOrEqual(80);
      }
    },
  );

  it("末尾は改行 1 つで終わる", () => {
    expect(buildTextSite("ja", [], site)).toMatch(/[^\n]\n$/);
  });

  it("site が無いと例外を投げる", () => {
    expect(() => buildTextSite("ja", [], undefined)).toThrow(
      "astro.config.mjs",
    );
  });
});

describe("displayWidth", () => {
  it.each([
    ["abc", 3],
    ["", 0],
    ["リナ", 4],
    ["創好", 4],
    ["（）", 4],
    ["。、", 4],
    ["한글", 4],
    ["🧪", 2],
    ["✨", 2],
    ["🚀", 2],
    ["a漢b", 4],
  ] as const)("%s の表示幅は %i", (text, width) => {
    expect(displayWidth(text)).toBe(width);
  });
});
