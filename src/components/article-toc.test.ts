import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cssOfAstro,
  hasCondition,
  parseCss,
  rulesFor,
  valueIn,
} from "../test/css-source";

const RULES = parseCss(
  cssOfAstro(
    readFileSync(new URL("./ArticleToc.astro", import.meta.url), "utf8"),
  ),
);

const REDUCE = "@media (prefers-reduced-motion: reduce)";

/** A color written as one token, such as `var(--text)`. */
const TOKEN = /^var\(--[\w-]+\)$/;

describe("ArticleToc の窓の今の項目", () => {
  it("文字と四角の色はトークンで指し、ホバーとフォーカスでも文字の色を保つ", () => {
    const [text] = rulesFor(RULES, ".panel .toc a[aria-current]");
    expect(valueIn(text, "color")).toMatch(TOKEN);
    expect(text.selectors).toContain(
      ".panel .toc a[aria-current]:is(:hover, :focus-visible)",
    );
    const [square] = rulesFor(RULES, ".panel .toc a[aria-current]::before");
    expect(valueIn(square, "background")).toMatch(TOKEN);

    // The other hover and focus colors have the same specificity, so the kept color comes last.
    const others = RULES.filter(
      (rule) =>
        rule !== text &&
        valueIn(rule, "color") !== undefined &&
        rule.selectors.some((selector) =>
          selector.includes(":is(:hover, :focus-visible)"),
        ),
    );
    expect(others.length).toBeGreaterThan(0);
    for (const other of others) {
      expect(RULES.indexOf(other), other.selectors.join()).toBeLessThan(
        RULES.indexOf(text),
      );
    }
  });

  it("transition のある規則のセレクタは、それより後ろの reduce の中でそれぞれ transition: none になる", () => {
    const moving = RULES.filter(
      (rule) =>
        !hasCondition(rule, REDUCE) &&
        valueIn(rule, "transition") !== undefined,
    );
    expect(moving.length).toBeGreaterThan(0);
    for (const rule of moving) {
      for (const selector of rule.selectors) {
        const stops = rulesFor(RULES, selector).filter(
          (r) =>
            hasCondition(r, REDUCE) &&
            RULES.indexOf(r) > RULES.indexOf(rule) &&
            valueIn(r, "transition") === "none",
        );
        expect(stops, selector).toHaveLength(1);
      }
    }
  });
});
