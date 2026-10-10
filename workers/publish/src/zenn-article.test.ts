import { load } from "js-yaml";
import { describe, expect, it } from "vitest";
import {
  buildZennArticle,
  isZennTarget,
  type ZennArticleInput,
  zennArticlePath,
} from "./zenn-article";

const INPUT: ZennArticleInput = {
  frontmatter: {
    title: "記事の題",
    emoji: "📝",
    topics: ["astro", "cloudflare"],
  },
  body: "\n本文。\n",
  originalUrl: "https://ikili.pro/blog/hello-ikili-pro",
  published: true,
};

const LINK =
  "この記事は ikili.pro に掲載した記事の転載です。原典: [ikili.pro の記事](https://ikili.pro/blog/hello-ikili-pro)";

/** The frontmatter lines of a Zenn article file, without the `---` lines. */
function frontmatterSource(text: string): string {
  return /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? "";
}

/** The frontmatter of a Zenn article file, read back with `js-yaml`. */
function readFrontmatter(text: string): Record<string, unknown> {
  return load(frontmatterSource(text)) as Record<string, unknown>;
}

describe("buildZennArticle", () => {
  it("Zenn の frontmatter、本文、区切り、原典リンクの順に並べた全文を返す", () => {
    expect(buildZennArticle(INPUT)).toBe(
      [
        "---",
        'title: "記事の題"',
        'emoji: "📝"',
        'type: "tech"',
        'topics: ["astro", "cloudflare"]',
        "published: true",
        "---",
        "",
        "本文。",
        "",
        "---",
        "",
        `${LINK}`,
        "",
      ].join("\n"),
    );
  });

  it("topics が無い記事は topics を空の配列にする", () => {
    const text = buildZennArticle({
      ...INPUT,
      frontmatter: { title: "題", emoji: "📝" },
    });
    expect(text).toContain("\ntopics: []\n");
    expect(readFrontmatter(text).topics).toEqual([]);
  });

  it("published が false なら published: false を書く", () => {
    const text = buildZennArticle({ ...INPUT, published: false });
    expect(text).toContain("\npublished: false\n");
    expect(readFrontmatter(text).published).toBe(false);
  });

  it("本文の先頭の空行と末尾の空白を取り、末尾の改行を 1 つにする", () => {
    const text = buildZennArticle({
      ...INPUT,
      body: "\n\n  字下げ\n\n本文。  \n\n\n",
    });
    expect(text).toContain("---\n\n  字下げ\n\n本文。\n\n---\n\n");
    expect(text.endsWith(`${LINK}\n`)).toBe(true);
    expect(text).toBe(
      buildZennArticle({ ...INPUT, body: "  字下げ\n\n本文。" }),
    );
  });

  it("本文が空なら区切りを置かず、frontmatter の次に原典リンクを置く", () => {
    expect(buildZennArticle({ ...INPUT, body: "\n\n" })).toBe(
      [
        "---",
        'title: "記事の題"',
        'emoji: "📝"',
        'type: "tech"',
        'topics: ["astro", "cloudflare"]',
        "published: true",
        "---",
        "",
        `${LINK}`,
        "",
      ].join("\n"),
    );
  });

  const controls = String.fromCodePoint(0x7f, 0x85, 0x2028, 0x2029);
  it.each([
    ["YAML の記号", 'a: b # c "d" \\e'],
    ["改行", "一行目\n二行目\t字下げ"],
    ["C1 制御文字と行・段落の区切り", `前${controls}後`],
    ["ZWJ の絵文字", "👨‍👩‍👧‍👦 の家族"],
  ])("%s title は js-yaml で読み戻すと同じ値になる", (_name, title) => {
    const text = buildZennArticle({
      ...INPUT,
      frontmatter: { ...INPUT.frontmatter, title, topics: [title] },
    });
    // Whatever the reader accepts, no control character or separator is left raw.
    expect(frontmatterSource(text).replaceAll("\n", "")).not.toMatch(
      /[\p{Cc}\p{Zl}\p{Zp}]/u,
    );
    const read = readFrontmatter(text);
    expect(read.title).toBe(title);
    expect(read.topics).toEqual([title]);
    expect(read.emoji).toBe("📝");
    expect(read.type).toBe("tech");
  });
});

describe("isZennTarget", () => {
  it.each([
    [["技術"], true],
    [["制作記", "技術"], true],
    [["日記", "制作記"], false],
    [[], false],
  ])("タグ %j は %s", (tags, expected) => {
    expect(isZennTarget(tags)).toBe(expected);
  });
});

describe("zennArticlePath", () => {
  it("articles/<slug>.md を返す", () => {
    expect(zennArticlePath("hello-ikili-pro")).toBe(
      "articles/hello-ikili-pro.md",
    );
  });
});
