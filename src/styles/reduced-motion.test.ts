import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type CssRule,
  cssOfAstro,
  hasCondition,
  parseCss,
  valueIn,
} from "../test/css-source";

const SRC = new URL("../", import.meta.url);

const REDUCE = "@media (prefers-reduced-motion: reduce)";

/**
 * Returns the rules of a file under `src/`: a `.css` file as a whole, an `.astro` file by the
 * contents of its `<style>` elements.
 */
function rulesOf(path: string, text: string): CssRule[] {
  return parseCss(path.endsWith(".css") ? text : cssOfAstro(text));
}

/**
 * Returns whether `rule` moves: outside `REDUCE`, it sets `transition` or a `transition-*`
 * property to a value other than `none`.
 */
function isMoving(rule: CssRule): boolean {
  return (
    !hasCondition(rule, REDUCE) &&
    rule.declarations.some(
      (d) =>
        (d.property === "transition" || d.property.startsWith("transition-")) &&
        d.value !== "none",
    )
  );
}

/**
 * Returns whether `rule` stops a transition: it is in `REDUCE` and in no other at-rule, and
 * its `transition` ends up `none`.
 */
function isStopping(rule: CssRule): boolean {
  return (
    rule.conditions.length === 1 &&
    hasCondition(rule, REDUCE) &&
    valueIn(rule, "transition") === "none"
  );
}

/**
 * Returns the selectors of the moving rules in `rules` that no stopping rule has among its
 * selectors after the moving rule in the source, in source order.
 */
function unstopped(rules: CssRule[]): string[] {
  return rules.flatMap((rule, at) =>
    isMoving(rule)
      ? rule.selectors.filter(
          (selector) =>
            !rules.some(
              (stop, i) =>
                i > at && isStopping(stop) && stop.selectors.includes(selector),
            ),
        )
      : [],
  );
}

describe("transition と prefers-reduced-motion", () => {
  it("src で reduce の外の transition を none 以外にする規則は、どれも同じソースの後ろの reduce で transition: none になる", () => {
    const files = readdirSync(SRC, {
      recursive: true,
      encoding: "utf8",
    }).filter((path) => path.endsWith(".astro") || path.endsWith(".css"));
    expect(files).toContain("styles/window.css");
    expect(files).toContain("layouts/Layout.astro");
    const sources = files.map((path) => ({
      path,
      rules: rulesOf(path, readFileSync(new URL(path, SRC), "utf8")),
    }));
    expect(sources.flatMap(({ rules }) => rules.filter(isMoving))).not.toEqual(
      [],
    );
    expect(
      sources.flatMap(({ path, rules }) =>
        unstopped(rules).map((selector) => `src/${path}: ${selector}`),
      ),
    ).toEqual([]);
  });

  const un = (css: string) => unstopped(parseCss(css));

  it("後ろの reduce の transition: none に止められる規則は挙げない", () => {
    expect(
      un(`
        .a, .b::before { transition: color 1s; }
        @media (prefers-reduced-motion: reduce) { .b::before, .a { transition: none; } }
      `),
    ).toEqual([]);
  });

  it("止める規則が無い規則のセレクタを挙げ、止められるセレクタは挙げない", () => {
    expect(
      un(`
        .a, .b { transition: color 1s; }
        @media (prefers-reduced-motion: reduce) { .a { transition: none; } }
      `),
    ).toEqual([".b"]);
  });

  it("止める規則が動かす規則より前にあると挙げる", () => {
    expect(
      un(`
        @media (prefers-reduced-motion: reduce) { .a { transition: none; } }
        .a { transition: color 1s; }
      `),
    ).toEqual([".a"]);
  });

  it("reduce の外の transition: none と、reduce の中の none でない transition は止めない", () => {
    expect(
      un(`
        .a, .b, .c { transition: color 1s; }
        .a { transition: none; }
        @media (min-width: 768px) { .c { transition: none; } }
        @media (prefers-reduced-motion: reduce) { .b { transition: color 0s; } }
      `),
    ).toEqual([".a", ".b", ".c"]);
  });

  it("他の at-rule の中に入れ子になった reduce は止めると見なさない", () => {
    expect(
      un(`
        .a { transition: color 1s; }
        @media (min-width: 768px) {
          @media (prefers-reduced-motion: reduce) { .a { transition: none; } }
        }
      `),
    ).toEqual([".a"]);
  });

  it("transition-* の宣言も動かす規則とし、none の宣言と reduce の中の宣言は動かす規則としない", () => {
    expect(
      un(`
        .a { transition-duration: 1s; }
        .b { transition-property: color; }
        .c { transition: none; }
        .d { transition-property: none; }
        @media (prefers-reduced-motion: reduce) { .e { transition: color 1s; } }
      `),
    ).toEqual([".a", ".b"]);
  });

  it("他の @media の中の規則も動かす規則とする", () => {
    const css = (stop: string) => `
      @media (min-width: 768px) { .a { transition: color 1s; } }
      ${stop}
    `;
    expect(
      un(
        css(
          "@media (prefers-reduced-motion: reduce) { .a { transition: none; } }",
        ),
      ),
    ).toEqual([]);
    expect(un(css(""))).toEqual([".a"]);
  });
});
