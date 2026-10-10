import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "../i18n/ui";

/** Reads a file under `src/`. */
function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
}

/** Returns the `.astro` files under a directory of `src/`, as paths relative to `src/`. */
function astroFiles(dir: string): string[] {
  return readdirSync(new URL(`../${dir}`, import.meta.url), {
    recursive: true,
    encoding: "utf8",
  })
    .filter((name) => name.endsWith(".astro"))
    .map((name) => `${dir}/${name}`);
}

/** Returns the body of the rule whose selector is exactly `selector` in a CSS text. */
function ruleBody(css: string, selector: string): string | undefined {
  const rules = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)];
  const rule = rules.find((r) => r[1].replace(/\s+/g, " ").trim() === selector);
  return rule?.[2].replace(/\s+/g, " ").trim();
}

const skipLink = source("components/SkipLink.astro");
const skipStyle = skipLink.slice(
  skipLink.indexOf("<style>") + "<style>".length,
);
const pages = [...astroFiles("pages"), ...astroFiles("dev")];

describe("スキップリンク", () => {
  it("Layout の body の最初の子で、SiteHeader より前にある", () => {
    const layout = source("layouts/Layout.astro");
    const body = layout.slice(layout.indexOf("<body>"));
    expect(body).toMatch(
      /<body>\s*(\{\/\*[\s\S]*?\*\/\}\s*)?<SkipLink lang=\{lang\} \/>\s*<SiteHeader/,
    );
  });

  it("main の id へのリンクで、.btn .btn-acc で描き、文言は nav.skip から取る", () => {
    expect(skipLink).toContain('href="#main"');
    expect(skipLink).toMatch(/"skip-link", "btn", "btn-acc"/);
    expect(skipLink).toContain('translate(lang, "nav.skip")');
  });

  it("フォーカスが無いときは 1px の箱に切り抜き、display: none も hidden も使わない", () => {
    const hidden = ruleBody(skipStyle, ".skip-link:not(:focus, .is-focus)");
    expect(hidden).toContain("width: 1px");
    expect(hidden).toContain("height: 1px");
    expect(hidden).toContain("clip-path: inset(50%)");
    expect(skipStyle).not.toContain("display: none");
    const template = skipLink.slice(
      skipLink.indexOf("\n---\n", 4),
      skipLink.indexOf("<style>"),
    );
    expect(template).not.toMatch(/\bhidden\b/);
  });

  it("フォーカスがあるときは左上の 8px と 16px に固定し、ヘッダーの z-index より上に出す", () => {
    const shown = ruleBody(skipStyle, ".skip-link:is(:focus, .is-focus)");
    expect(shown).toContain("position: fixed");
    expect(shown).toContain("top: 8px");
    expect(shown).toContain("left: 16px");
    const z = (css: string) => Number(css.match(/z-index: (\d+)/)?.[1]);
    const header = source("components/SiteHeader.astro");
    expect(z(shown ?? "")).toBeGreaterThan(
      z(header.slice(header.indexOf(".site-header {"))),
    );
  });

  it("日本語は「本文へ移動」、英語は「Skip to main content」", () => {
    expect(translate("ja", "nav.skip")).toBe("本文へ移動");
    expect(translate("en", "nav.skip")).toBe("Skip to main content");
  });
});

describe("main のランドマーク", () => {
  const withMain = [...pages, "components/BlogIndex.astro"].filter((file) =>
    /^\s*<main\b/m.test(source(file)),
  );

  it('main を持つファイルの main は id="main" と tabindex="-1" を持ち、1 ファイルに 1 つだけ', () => {
    expect(withMain.length).toBeGreaterThan(0);
    for (const file of withMain) {
      const tags = source(file).match(/<main\b[^>]*>/g) ?? [];
      expect(tags, file).toHaveLength(1);
      expect(tags[0], file).toContain('id="main"');
      expect(tags[0], file).toContain('tabindex="-1"');
    }
  });

  it("Layout を使うページは、main を持つか BlogIndex を置く", () => {
    const layoutPages = pages.filter((file) =>
      source(file).includes("<Layout"),
    );
    expect(layoutPages.length).toBeGreaterThan(0);
    for (const file of layoutPages) {
      const text = source(file);
      expect(
        /^\s*<main\b/m.test(text) || text.includes("<BlogIndex"),
        file,
      ).toBe(true);
    }
  });

  it("main を持つのはページと BlogIndex だけで、ほかの部品は持たない", () => {
    const others = astroFiles("components").filter((file) =>
      /^\s*<main\b/m.test(source(file)),
    );
    expect(others).toEqual(["components/BlogIndex.astro"]);
  });

  it("フォーカスした main には輪を描かず、#main へ飛ぶとヘッダーの下 72px で止まる", () => {
    const css = source("styles/global.css").replace(/\/\*[\s\S]*?\*\//g, "");
    expect(ruleBody(css, 'main[tabindex="-1"]:focus')).toBe("outline: none;");
    expect(ruleBody(css, "html")).toBe("scroll-padding: 72px 0 8px;");
  });
});
