import { readdirSync, readFileSync } from "node:fs";
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
const source = (path: string) => readFileSync(new URL(path, SRC), "utf8");

const GLOBAL = parseCss(source("styles/global.css"));

/** The CSS of a file under `src/`: its `<style>` elements for `.astro`, the whole file otherwise. */
const cssOf = (path: string) =>
  path.endsWith(".astro") ? cssOfAstro(source(path)) : source(path);

/** The containers that put `page-width` on themselves: `[file under src/, class]`. */
const CONTAINERS: [string, string][] = [
  ["components/SiteHeader.astro", "bar"],
  ["components/SiteFooter.astro", "main"],
  ["components/SiteFooter.astro", "band"],
  ["components/SiteFooter.astro", "solo"],
  ["components/Hero.astro", "hero-grid"],
  ["components/About.astro", "about"],
  ["components/LatestSection.astro", "inner"],
  ["components/ContactBand.astro", "inner"],
  ["components/PageHead.astro", "inner"],
  ["components/BlogIndex.astro", "list"],
  ["pages/blog/[slug].astro", "body"],
  ["pages/[lang]/contact/index.astro", "content"],
  ["pages/404.astro", "not-found"],
];

/** The properties that the rule of a container must leave to `.page-width`. */
const OWNED = [
  "box-sizing",
  "max-width",
  "margin",
  "margin-inline",
  "margin-left",
  "margin-right",
  "padding",
  "padding-inline",
  "padding-left",
  "padding-right",
];

/** The declarations of `OWNED` that a container may still make: `file class property: value`. */
const ALLOWED = [
  "components/Hero.astro hero-grid padding-inline: 0",
  "components/ContactBand.astro inner padding-right: 0",
  "components/ContactBand.astro inner padding-right: 16px",
];

/** Returns `[conditions, value]` of every rule of `rules` that declares `property`. */
const valuesOf = (rules: CssRule[], property: string) =>
  rules
    .map((rule) => [rule.conditions, valueIn(rule, property)] as const)
    .filter(([, value]) => value !== undefined);

/** Returns the declarations of a rule as `property: value`. */
const declarationsOf = (rules: CssRule[]) =>
  rules.flatMap((rule) =>
    rule.declarations.map((d) => `${d.property}: ${d.value}`),
  );

describe("ページの幅と左右の余白", () => {
  it("--page-gutter は :root で 16px、768px から 20px、900px から 64px になる", () => {
    const found = valuesOf(rulesFor(GLOBAL, ":root"), "--page-gutter");
    expect(found).toEqual([
      [[], "16px"],
      [["@media (min-width: 768px)"], "20px"],
      [["@media (min-width: 900px)"], "64px"],
    ]);
  });

  it(".page-width は余白を含めて最大 1440px にして中央に寄せ、左右の余白に --page-gutter を使う", () => {
    const rules = rulesFor(GLOBAL, ".page-width");
    expect(rules).toHaveLength(1);
    expect(rules[0].conditions).toEqual([]);
    expect(declarationsOf(rules)).toEqual([
      "box-sizing: border-box",
      "max-width: 1440px",
      "margin-inline: auto",
      "padding-inline: var(--page-gutter)",
    ]);
  });

  it.each(CONTAINERS)(
    "%s の .%s は page-width を付け、その規則は幅と左右の余白を宣言しない",
    (path, cls) => {
      expect(source(path)).toContain(`class="${cls} page-width"`);
      const owned = rulesFor(parseCss(cssOf(path)), `.${cls}`).flatMap((rule) =>
        rule.declarations
          .filter((d) => OWNED.includes(d.property))
          .map((d) => `${path} ${cls} ${d.property}: ${d.value}`),
      );
      expect(owned.filter((d) => !ALLOWED.includes(d))).toEqual([]);
    },
  );

  it("許す宣言は、Hero の 767px まで、ContactBand の 899px までと 359px までにだけある", () => {
    const hero = rulesFor(
      parseCss(cssOf("components/Hero.astro")),
      ".hero-grid",
    );
    expect(valuesOf(hero, "padding-inline")).toEqual([
      [["@media (max-width: 767px)"], "0"],
    ]);
    const band = rulesFor(
      parseCss(cssOf("components/ContactBand.astro")),
      ".inner",
    );
    expect(valuesOf(band, "padding-right")).toEqual([
      [["@media (max-width: 899px)"], "0"],
      [["@media (max-width: 359px)"], "16px"],
    ]);
  });

  it.each([
    ["components/SiteHeader.astro", ".menu-nav a", "0 var(--page-gutter)"],
    [
      "components/SiteHeader.astro",
      ".menu-languages",
      "8px calc(var(--page-gutter) - 12px)",
    ],
    [
      "components/SiteHeader.astro",
      ".menu-contact",
      "4px var(--page-gutter) 16px",
    ],
    ["components/Hero.astro", ".hero-left", "440px var(--page-gutter) 32px"],
  ])(
    "%s の %s は %s の左右に --page-gutter を使う",
    (path, selector, padding) => {
      const found = valuesOf(
        rulesFor(parseCss(cssOf(path)), selector),
        "padding",
      ).map(([, value]) => value);
      expect(found).toContain(padding);
    },
  );

  it("SiteHeader.astro は --gutter を宣言も参照もしない", () => {
    expect(source("components/SiteHeader.astro")).not.toMatch(/--gutter\b/);
  });

  it("global.css のほかに max-width: 1440px を宣言する CSS と <style> は無い", () => {
    const paths = readdirSync(SRC, {
      recursive: true,
      encoding: "utf8",
    }).filter(
      (path) =>
        (path.endsWith(".css") || path.endsWith(".astro")) &&
        path !== "styles/global.css",
    );
    expect(paths).toContain("components/Hero.astro");
    const found = paths.filter((path) =>
      parseCss(cssOf(path)).some((rule) =>
        rule.declarations.some(
          (d) => d.property === "max-width" && d.value === "1440px",
        ),
      ),
    );
    expect(found).toEqual([]);
  });
});
