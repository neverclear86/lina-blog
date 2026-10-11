import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type CssRule,
  cssOfAstro,
  hasCondition,
  parseCss,
  rulesFor,
} from "../test/css-source";

/** Reads a file under `src/`. */
function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

/** Returns the declarations of a rule as `{ property: value }`. */
function declared(rule: CssRule): Record<string, string> {
  return Object.fromEntries(
    rule.declarations.map((d) => [d.property, d.value]),
  );
}

/** The box that hides text from the eyes and leaves it to assistive technology. */
const HIDDEN = {
  position: "absolute",
  width: "1px",
  height: "1px",
  "min-height": "0",
  margin: "0",
  padding: "0",
  overflow: "hidden",
  border: "0",
  "clip-path": "inset(50%)",
  "white-space": "nowrap",
};

const GLOBAL = parseCss(source("styles/global.css"));

describe("視覚的に隠す CSS", () => {
  it(".sr-only と、フォーカスが無い間の .sr-only-focusable は、1px の切り抜いた箱の 1 つの規則を共有する", () => {
    const rules = rulesFor(GLOBAL, ".sr-only");
    expect(rules).toHaveLength(1);
    expect(rules[0].selectors).toEqual([
      ".sr-only",
      ".sr-only-focusable:not(:focus, .is-focus)",
    ]);
    expect(rules[0].conditions).toEqual([]);
    expect(declared(rules[0])).toEqual(HIDDEN);
  });

  it(".sr-only-narrow は 767px までだけ同じ箱にし、768px からは何も宣言しない", () => {
    const rules = rulesFor(GLOBAL, ".sr-only-narrow");
    expect(rules).toHaveLength(1);
    expect(hasCondition(rules[0], "@media (max-width: 767px)")).toBe(true);
    expect(declared(rules[0])).toEqual(HIDDEN);
  });

  it("global.css 以外の CSS と <style> は、切り抜いて隠す宣言（clip-path: inset(50%)）を持たない", () => {
    const files = readdirSync(new URL("../", import.meta.url), {
      recursive: true,
      encoding: "utf8",
    }).filter(
      (name) =>
        (name.endsWith(".css") || name.endsWith(".astro")) &&
        name !== "styles/global.css",
    );
    const copies = files.filter((name) => {
      const css = name.endsWith(".css")
        ? source(name)
        : cssOfAstro(source(name));
      return parseCss(css).some((rule) =>
        rule.declarations.some(
          (d) => d.property === "clip-path" && d.value === "inset(50%)",
        ),
      );
    });
    expect(files.length).toBeGreaterThan(0);
    expect(copies).toEqual([]);
  });

  it("隠す文は共通のクラスを付ける: SkipLink は .sr-only-focusable、コピーボタンの状態は .sr-only", () => {
    expect(source("components/site/SkipLink.astro")).toMatch(
      /class:list=\{\[[^\]]*"sr-only-focusable"/,
    );
    expect(source("components/article/ArticleBody.astro")).toContain(
      'status.className = "sr-only";',
    );
  });

  it("記事の頭の dt と ArticleEnd の続きの文は .sr-only-narrow で、部品に隠す規則は無い", () => {
    const head = source("components/article/ArticleHead.astro");
    const dts = head.match(/<dt\b[^>]*>/g) ?? [];
    expect(dts.length).toBeGreaterThan(0);
    for (const tag of dts) {
      expect(tag).toContain("sr-only-narrow");
    }
    expect(
      source("components/article/ArticleEnd.astro").match(
        /<span class="sr-only-narrow"/g,
      ),
    ).toHaveLength(3);
    const [dt] = rulesFor(parseCss(cssOfAstro(head)), ".meta dt");
    expect(declared(dt)).toEqual({ "white-space": "nowrap" });
  });
});
