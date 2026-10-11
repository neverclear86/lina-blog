import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type CssRule,
  cssOfAstro,
  parseCss,
  rulesFor,
  valueIn,
} from "../test/css-source";

const SRC = new URL("../", import.meta.url);

/** Returns a file under `src/` as text. */
function read(path: string): string {
  return readFileSync(new URL(path, SRC), "utf8");
}

/** Returns the one rule that has `selector` among its selectors, or fails. */
function only(rules: CssRule[], selector: string): CssRule {
  const found = rulesFor(rules, selector);
  expect(found, selector).toHaveLength(1);
  return found[0];
}

/** Returns the declarations of `rule` as `property: value` texts, in source order. */
function declarationsOf(rule: CssRule): string[] {
  return rule.declarations.map((d) => `${d.property}: ${d.value}`);
}

/** Returns the selectors of `rules` whose last part is a `<summary>` or a pseudo-element of it. */
function summarySelectors(rules: CssRule[]): string[] {
  return rules
    .flatMap((rule) => rule.selectors)
    .filter((selector) => /summary(:{1,2}[\w-]+)?$/.test(selector));
}

const WINDOW = parseCss(read("styles/window.css"));
const ARTICLE = parseCss(read("markdown/article.css"));
const TOC_SOURCE = read("components/ArticleToc.astro");
const TOC = parseCss(cssOfAstro(TOC_SOURCE));

const SUMMARY = ":where(details.win, .article-body details) > summary";
const MARKER = `${SUMMARY}::-webkit-details-marker`;
const CLOSED_MARK = `${SUMMARY}::after`;
const OPEN_MARK =
  ":where(details.win[open], .article-body details[open]) > summary::after";

describe("アコーディオンの summary", () => {
  it("window.css が 1 つだけ持ち、マーカーを消して、閉じているとき + 開いているとき − を出す", () => {
    const body = only(WINDOW, SUMMARY);
    expect(valueIn(body, "display")).toBe("block");
    expect(valueIn(body, "min-height")).toBe("48px");
    expect(valueIn(body, "list-style")).toBe("none");
    expect(declarationsOf(only(WINDOW, MARKER))).toEqual(["display: none"]);

    const closed = only(WINDOW, CLOSED_MARK);
    const open = only(WINDOW, OPEN_MARK);
    expect(valueIn(closed, "content")).toBe('"+" / ""');
    expect(declarationsOf(open)).toEqual(['content: "\\2212" / ""']);
    expect(WINDOW.indexOf(open)).toBeGreaterThan(WINDOW.indexOf(closed));
  });

  it("window.css の summary のセレクタはすべて :where() の中にあり、部品の規則が常に勝つ", () => {
    const selectors = summarySelectors(WINDOW);
    expect(selectors).toHaveLength(4);
    for (const selector of selectors) {
      expect(selector).toMatch(/^:where\(/);
    }
  });

  it("記事は summary の左右の張り出しだけを、目次は輪の位置だけを書き、見た目の写しを持たない", () => {
    expect(summarySelectors(ARTICLE)).toEqual([".article-body summary"]);
    expect(declarationsOf(only(ARTICLE, ".article-body summary"))).toEqual([
      "margin-inline: -16px",
    ]);
    expect(summarySelectors(TOC)).toEqual([".sheet summary:focus-visible"]);
    expect(declarationsOf(only(TOC, ".sheet summary:focus-visible"))).toEqual([
      "outline-offset: -4px",
    ]);
  });

  it("目次の <details> は .win を付けて、window.css の規則を受ける", () => {
    expect(TOC_SOURCE).toContain('<details class="win sheet">');
  });
});

describe("窓のタイトル行", () => {
  it("window.css の .win-title が 6 つの宣言を持つ", () => {
    expect(declarationsOf(only(WINDOW, ".win-title"))).toEqual([
      "margin: 0",
      "padding: 12px 20px",
      "border-bottom: 1px solid var(--line)",
      "font-family: var(--font-mono)",
      "font-size: 12px",
      "color: var(--muted)",
    ]);
  });

  it("お問い合わせの窓、404 の窓、目次の窓のタイトル行は win-title を付け、window-title の写しは残らない", () => {
    const marks = [
      ["components/ContactForm.astro", '<p class="win-title">'],
      ["pages/404.astro", '<p class="win-title">'],
      [
        "components/ArticleToc.astro",
        '<div class="win-title title" lang="en">',
      ],
    ];
    for (const [path, markup] of marks) {
      const source = read(path);
      expect(source, path).toContain(markup);
      expect(source, path).not.toContain("window-title");
    }
  });

  it("目次のタイトル行は余白の差だけを部品に書く", () => {
    expect(declarationsOf(only(TOC, ".title"))).toEqual([
      "margin-bottom: 8px",
      "padding: 0 0 10px",
    ]);
  });
});
