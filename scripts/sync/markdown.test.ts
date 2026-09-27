// Imported without a dependency of its own, to use the version that astro reads frontmatter with.
import { parseFrontmatter } from "@astrojs/internal-helpers/frontmatter";
import { describe, expect, it } from "vitest";
import { blogSchema } from "../../src/blog-schema";
import { contentHash } from "../../workers/publish/src/content-hash";
import { buildMarkdown, hashMarkdown } from "./markdown";
import type { ArticleFrontmatter } from "./vault";

const BOM = String.fromCharCode(0xfeff);
const CR = "\r";

const FULL: ArticleFrontmatter = {
  title: 'a"b\\c: d # e - f\r\ng\th',
  slug: "123456789012",
  emoji: String.fromCodePoint(0x1f469, 0x200d, 0x1f4bb),
  tags: ["技術", "日記"],
  description: "yes null ~ \x7f \x85 [ { & * | > % @",
  sponsor: { name: "true", url: "https://example.com/" },
  topics: ["- x"],
};

const MIN: ArticleFrontmatter = {
  title: "t",
  slug: "hello-world-0001",
  emoji: "📝",
  tags: ["技術"],
  description: "d",
};

const BODY = "\n# 見出し\n\n本文\n";

const articleSchema = blogSchema.omit({ date: true });

/** Reads the frontmatter of `markdown` as Astro's content collection does. */
function readFrontmatter(markdown: string): Record<string, unknown> {
  return parseFrontmatter(markdown).frontmatter;
}

describe("buildMarkdown", () => {
  it("frontmatter をキーの決まった順に書き、本文を続ける", () => {
    expect(buildMarkdown(MIN, BODY)).toBe(
      '---\ntitle: "t"\nslug: "hello-world-0001"\nemoji: "📝"\ntags: ["技術"]\ndescription: "d"\n---\n\n# 見出し\n\n本文\n',
    );
  });

  it("キーの順序が入力の順序に依らない", () => {
    const reversed = Object.fromEntries(
      Object.entries(FULL).reverse(),
    ) as ArticleFrontmatter;
    const md = buildMarkdown(reversed, BODY);
    expect(md).toBe(buildMarkdown(FULL, BODY));
    expect(Object.keys(readFrontmatter(md))).toEqual([
      "title",
      "slug",
      "emoji",
      "tags",
      "description",
      "sponsor",
      "topics",
    ]);
  });

  it("sponsor を name、url の順に書く", () => {
    const md = buildMarkdown(
      {
        ...MIN,
        sponsor: { url: "https://example.com/", name: "n" },
        topics: ["x"],
      },
      BODY,
    );
    expect(md).toContain(
      '\nsponsor:\n  name: "n"\n  url: "https://example.com/"\ntopics:',
    );
  });

  it("値の無い任意の項目を書かない", () => {
    for (const frontmatter of [
      MIN,
      { ...MIN, sponsor: undefined, topics: undefined },
    ]) {
      const md = buildMarkdown(frontmatter, BODY);
      expect(md).not.toContain("\nsponsor:");
      expect(md).not.toContain("\ntopics:");
    }
    const md = buildMarkdown(
      { ...MIN, sponsor: { name: "n", url: undefined } },
      BODY,
    );
    expect(md).not.toContain("  url:");
    expect(readFrontmatter(md)).toEqual({ ...MIN, sponsor: { name: "n" } });
  });

  it.each([
    ["FULL", FULL],
    ["MIN", MIN],
  ])("%s の frontmatter を YAML として読むと入力に戻る", (_, frontmatter) => {
    const md = buildMarkdown(frontmatter, BODY);
    const parsed = parseFrontmatter(md);
    expect(parsed.frontmatter).toEqual(frontmatter);
    expect(articleSchema.parse(parsed.frontmatter)).toEqual(frontmatter);
    expect(parsed.content).toBe(`\n${BODY}`);
  });

  it.each([
    ["CRLF", BODY.replaceAll("\n", "\r\n")],
    ["CR", BODY.replaceAll("\n", CR)],
    ["BOM", `${BOM}${BODY}`],
    ["末尾の改行が無い", BODY.slice(0, -1)],
    ["末尾の改行が 3 つ", `${BODY}\n\n`],
  ])("本文の %s を正規化する", (_, body) => {
    const expected = buildMarkdown(MIN, BODY);
    const md = buildMarkdown(MIN, body);
    expect(md).toBe(expected);
    expect(hashMarkdown(md)).toBe(hashMarkdown(expected));
  });

  it("本文と frontmatter の NFD を NFC にする", () => {
    const nfd = "ガ".normalize("NFD");
    const md = buildMarkdown({ ...MIN, title: nfd }, nfd);
    const nfc = buildMarkdown({ ...MIN, title: "ガ" }, "ガ");
    expect(md).toBe(nfc);
    expect(hashMarkdown(md)).toBe(hashMarkdown(nfc));
  });

  it("空の本文は frontmatter の後ろに何も足さない", () => {
    expect(buildMarkdown(MIN, "\n\n")).toMatch(/"d"\n---\n$/);
  });

  it("空の topics を topics: [] と書き、読むと空の配列に戻る", () => {
    const md = buildMarkdown({ ...MIN, topics: [] }, BODY);
    expect(md).toContain("\ntopics: []\n");
    expect(readFrontmatter(md)).toEqual({ ...MIN, topics: [] });
  });

  it("制御文字の後ろの結合文字を合成せず、YAML として読むと NFC の値に戻る", () => {
    const title = [
      "a\n",
      String.fromCharCode(0x0303, 0x0327),
      "\x1e",
      String.fromCharCode(0x0301),
      "\t",
      String.fromCodePoint(0x1d165),
    ].join("");
    const md = buildMarkdown({ ...MIN, title }, BODY);
    expect(md.normalize("NFC")).toBe(md);
    expect(readFrontmatter(md).title).toBe(title.normalize("NFC"));
  });

  it("値と本文の CR と BOM を出力に残さない", () => {
    const md = buildMarkdown(
      {
        ...MIN,
        title: `${BOM}ti${BOM}t\r\nle${CR}x`,
        topics: [`${BOM}a${BOM}b`],
      },
      `${BOM}x${BOM}y\r\na${CR}b\r\n`,
    );
    expect(md).not.toContain(BOM);
    expect(md).not.toContain(CR);
    expect(md.endsWith("\nxy\na\nb\n")).toBe(true);
    const frontmatter = readFrontmatter(md);
    expect(frontmatter.title).toBe("tit\r\nle\rx");
    expect(frontmatter.topics).toEqual(["ab"]);
  });
});

describe("hashMarkdown", () => {
  it("公開用 Worker の contentHash と同じ値を返す", async () => {
    const md = buildMarkdown(FULL, BODY);
    expect(hashMarkdown(md)).toBe(await contentHash(md));
    expect(hashMarkdown("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });
});
