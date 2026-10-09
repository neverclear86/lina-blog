import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("./ArticleToc.astro", import.meta.url),
  "utf8",
);

/** The `<style>` of the component without its CSS comments. */
const style = source
  .slice(source.indexOf("<style>"), source.indexOf("</style>"))
  .replace(/\/\*[\s\S]*?\*\//g, "");

const reduceAt = style.indexOf("@media (prefers-reduced-motion: reduce)");

/** The `<style>` before `@media (prefers-reduced-motion: reduce)`, which applies always. */
const always = style.slice(0, reduceAt);

/** The `<style>` from `@media (prefers-reduced-motion: reduce)` on. */
const reduced = style.slice(reduceAt);

/** Returns the declarations of the one rule with `selector` in `css`, or fails. */
function declarations(css: string, selector: string): string {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .map((match) => ({
      selector: match[1].replace(/\s+/g, " ").trim(),
      body: match[2].replace(/\s+/g, " ").trim(),
    }))
    .filter(
      (rule) =>
        rule.selector.replace(/\s/g, "") === selector.replace(/\s/g, ""),
    );
  if (rules.length !== 1) {
    throw new Error(`${rules.length} rules for ${selector}, expected 1`);
  }
  return rules[0].body;
}

describe("ArticleToc の窓の今の項目", () => {
  it("文字は --text の 700 で、四角は --keyword で 1.4 倍になる", () => {
    const text = declarations(
      always,
      ".panel .toc a[aria-current], .panel .toc a[aria-current]:is(:hover, :focus-visible)",
    );
    expect(text).toContain("color: var(--text);");
    expect(text).toContain("font-weight: 700;");
    const square = declarations(always, ".panel .toc a[aria-current]::before");
    expect(square).toContain("background: var(--keyword);");
    expect(square).toContain("transform: scale(1.4);");
  });

  it("色と四角に 0.2s の transition があり、reduce で止める", () => {
    expect(declarations(always, ".panel .toc a")).toContain(
      "transition: color 0.2s;",
    );
    expect(declarations(always, ".panel .toc a::before")).toContain(
      "transition: background-color 0.2s, transform 0.2s;",
    );
    expect(reduceAt).toBeGreaterThan(-1);
    expect(declarations(reduced, ".panel .toc a, .panel .toc a::before")).toBe(
      "transition: none;",
    );
  });
});
