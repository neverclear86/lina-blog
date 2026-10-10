import { describe, expect, it } from "vitest";
import {
  articleBody,
  DATE_LINE_MESSAGE,
  insertFrontmatterDate,
  parseArticleMarkdown,
} from "./article-markdown";

const SLUG = "hello-ikili-pro";

const FRONTMATTER = [
  "title: 記事の題",
  `slug: ${SLUG}`,
  "emoji: 📝",
  "tags:",
  "  - 技術",
  "description: 記事の説明",
].join("\n");

// The `---` line in the body is a thematic break; it must not close the frontmatter.
const BODY = "\n本文の段落。\n\n---\n\n次の段落。\n";

/** Markdown of an article with `frontmatter` between `---` lines, followed by `body`. */
function article(frontmatter: string, body = BODY): string {
  return `---\n${frontmatter}\n---\n${body}`;
}

describe("parseArticleMarkdown", () => {
  it("正しい markdown から検証済みの frontmatter と本文を返す", () => {
    expect(parseArticleMarkdown(article(FRONTMATTER), SLUG)).toEqual({
      ok: true,
      frontmatter: {
        title: "記事の題",
        slug: SLUG,
        emoji: "📝",
        tags: ["技術"],
        description: "記事の説明",
      },
      body: BODY,
    });
  });

  it("\\r を含む markdown を invalid_markdown で拒む", () => {
    const markdown = article(FRONTMATTER).replaceAll("\n", "\r\n");
    expect(parseArticleMarkdown(markdown, SLUG)).toMatchObject({
      ok: false,
      code: "invalid_markdown",
    });
  });

  it("BOM を含む markdown を invalid_markdown で拒む", () => {
    const markdown = `\u{FEFF}${article(FRONTMATTER)}`;
    expect(parseArticleMarkdown(markdown, SLUG)).toMatchObject({
      ok: false,
      code: "invalid_markdown",
    });
  });

  it.each([
    ["frontmatter が無い", BODY, "between --- lines"],
    ["閉じの --- が無い", `---\n${FRONTMATTER}\n\n本文\n`, "between --- lines"],
    [
      "閉じの前に +++ で始まる行がある",
      article(FRONTMATTER.replace("記事の説明", '"記事の\n+++ 説明"')),
      "between --- lines",
    ],
    [
      "閉じの前に ---- で始まる行がある",
      article(FRONTMATTER.replace("記事の説明", "'記事の\n---- 説明'")),
      "between --- lines",
    ],
    ["YAML として読めない", article("title: ["), "not valid YAML"],
    ["frontmatter が空の", "---\n---\n本文\n", "YAML mapping"],
    ["frontmatter が null の", "---\n~\n---\n本文\n", "YAML mapping"],
  ])("%s markdown を invalid_frontmatter で拒む", (_, markdown, part) => {
    expect(parseArticleMarkdown(markdown, SLUG)).toMatchObject({
      ok: false,
      code: "invalid_frontmatter",
      message: expect.stringContaining(part),
    });
  });

  it("date が有る frontmatter を invalid_frontmatter で拒む", () => {
    const markdown = article(`${FRONTMATTER}\ndate: 2026-09-01`);
    expect(parseArticleMarkdown(markdown, SLUG)).toMatchObject({
      ok: false,
      code: "invalid_frontmatter",
    });
  });

  it("空の date が有る frontmatter を invalid_frontmatter で拒む", () => {
    const markdown = article(`${FRONTMATTER}\ndate:`);
    expect(parseArticleMarkdown(markdown, SLUG)).toMatchObject({
      ok: false,
      code: "invalid_frontmatter",
    });
  });

  it.each([
    ["... の行で終わる", `${FRONTMATTER}\n...`],
    ["マッピングを字下げした", FRONTMATTER.replaceAll(/^/gm, "  ")],
    [
      "フロー形式のマッピングで書いた",
      `{ title: 記事の題, slug: ${SLUG}, emoji: 📝, tags: [技術], description: 記事の説明 }`,
    ],
  ])(
    "%s frontmatter を、末尾に date の行を足すと読めないので invalid_frontmatter で拒む",
    (_, frontmatter) => {
      expect(parseArticleMarkdown(article(frontmatter), SLUG)).toEqual({
        ok: false,
        code: "invalid_frontmatter",
        message: DATE_LINE_MESSAGE,
      });
    },
  );

  it("スキーマに合わない frontmatter を invalid_frontmatter で拒む", () => {
    const markdown = article(FRONTMATTER.replace("技術", "雑記"));
    expect(parseArticleMarkdown(markdown, SLUG)).toMatchObject({
      ok: false,
      code: "invalid_frontmatter",
    });
  });

  it("frontmatter の slug がパスと違えば slug_mismatch で拒む", () => {
    expect(
      parseArticleMarkdown(article(FRONTMATTER), "other-slug-0001"),
    ).toMatchObject({ ok: false, code: "slug_mismatch" });
  });
});

describe("insertFrontmatterDate", () => {
  it("date の行を frontmatter の閉じの --- の直前に挿入し、ほかの行を変えない", () => {
    expect(
      insertFrontmatterDate(article(FRONTMATTER), "2026-09-28T12:34:56Z"),
    ).toBe(`---\n${FRONTMATTER}\ndate: 2026-09-28T12:34:56Z\n---\n${BODY}`);
  });

  it("date の行を足すと YAML として読めなくなる frontmatter には null を返す", () => {
    expect(
      insertFrontmatterDate(
        article(`${FRONTMATTER}\n...`),
        "2026-09-28T12:34:56Z",
      ),
    ).toBeNull();
  });

  it("frontmatter で始まらない markdown には null を返す", () => {
    expect(insertFrontmatterDate(BODY, "2026-09-28T12:34:56Z")).toBeNull();
  });
});

describe("articleBody", () => {
  it("frontmatter の閉じの --- の後を返し、本文の --- で区切らない", () => {
    expect(articleBody(article(FRONTMATTER))).toBe(BODY);
  });

  it("frontmatter が無ければそのまま返す", () => {
    expect(articleBody(BODY)).toBe(BODY);
  });
});
