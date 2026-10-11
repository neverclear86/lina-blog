import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cssOfAstro,
  hasCondition,
  parseCss,
  rulesFor,
  valueIn,
} from "../test/css-source";

/** Returns a file under `src/` as text. */
function read(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

const HEAD = read("components/ArticleHead.astro");
const PAGE = read("pages/blog/[slug].astro");
const HEAD_RULES = parseCss(cssOfAstro(HEAD));
const PAGE_RULES = parseCss(cssOfAstro(PAGE));

describe("ArticleHead のマークアップ", () => {
  it("PageHead の中に、パンくず、チップ、h1、dl をこの順に置く", () => {
    const order = [
      "<PageHead>",
      "<Breadcrumb ",
      '<ul class="chips">',
      '<h1 class="title">',
      '<dl class="meta">',
      "</PageHead>",
    ].map((text) => HEAD.indexOf(text));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });
});

describe("ArticleHead の規則", () => {
  it.each([
    "@media (max-width: 767px)",
    "@media (min-width: 900px) and (max-width: 1279px)",
  ])(
    "%s の h1 の右の余白は、class を 2 度書いた規則が持ち、PageHead の .inner h1 に勝つ",
    (condition) => {
      const rules = rulesFor(HEAD_RULES, ".title.title").filter((rule) =>
        hasCondition(rule, condition),
      );
      expect(rules).toHaveLength(1);
      expect(valueIn(rules[0], "padding-right")).toBeDefined();
    },
  );

  it("h1 は全幅で語の途中でも折り返し、.title は右の余白を持たない", () => {
    const rules = rulesFor(HEAD_RULES, ".title").map((rule) => [
      rule.conditions.length,
      valueIn(rule, "overflow-wrap"),
      valueIn(rule, "padding-right"),
    ]);
    expect(rules).toEqual([[0, "anywhere", undefined]]);
  });

  it("帯と方眼は PageHead だけが描き、ArticleHead は擬似要素と背景を持たない", () => {
    for (const rule of HEAD_RULES) {
      for (const selector of rule.selectors) {
        expect(selector).not.toMatch(/::(?:before|after)|\.gridbg/);
      }
      expect(valueIn(rule, "background-size")).toBeUndefined();
    }
  });
});

describe("記事のページ", () => {
  it("ArticleHead を置き、頭のマークアップと規則を持たない", () => {
    expect(PAGE).toContain("<ArticleHead");
    expect(PAGE).not.toMatch(/class="(?:head|head-inner|chips|crumbs|meta)\b/);
    for (const rule of PAGE_RULES) {
      for (const selector of rule.selectors) {
        expect(selector).not.toMatch(
          /\.(?:head|head-inner|chips|crumbs|meta|cell|author|file)\b|^h1\b/,
        );
      }
    }
  });
});
