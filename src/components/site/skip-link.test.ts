import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translate } from "../../i18n/ui";
import { cssOfAstro, parseCss, rulesFor, valueIn } from "../../test/css-source";

/** Reads a file under `src/`. */
function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

/** Returns the `.astro` files under a directory of `src/`, as paths relative to `src/`. */
function astroFiles(dir: string): string[] {
  return readdirSync(new URL(`../../${dir}`, import.meta.url), {
    recursive: true,
    encoding: "utf8",
  })
    .filter((name) => name.endsWith(".astro"))
    .map((name) => `${dir}/${name}`);
}

const skipLink = source("components/site/SkipLink.astro");
const SKIP = parseCss(cssOfAstro(skipLink));
const pages = [...astroFiles("pages"), ...astroFiles("dev")];

describe("スキップリンク", () => {
  it("Layout の body の最初の子で、SiteHeader より前にある", () => {
    const layout = source("layouts/Layout.astro");
    const body = layout.slice(layout.indexOf("<body>"));
    expect(body).toMatch(
      /<body>\s*(\{\/\*[\s\S]*?\*\/\}\s*)?<SkipLink lang=\{lang\} \/>\s*<SiteHeader/,
    );
  });

  it("main の id へのリンクで、文言は nav.skip から取る", () => {
    expect(skipLink).toContain('href="#main"');
    expect(skipLink).toContain('translate(lang, "nav.skip")');
  });

  it("フォーカスが無いときは共通の .sr-only-focusable で切り抜いて隠し、display: none も hidden も使わない", () => {
    expect(skipLink).toMatch(/class:list=\{\[[^\]]*"sr-only-focusable"/);
    const [hidden] = rulesFor(
      parseCss(source("styles/global.css")),
      ".sr-only-focusable:not(:focus, .is-focus)",
    );
    expect(valueIn(hidden, "clip-path")).toBeDefined();
    expect(
      [...SKIP, hidden].some((rule) =>
        rule.declarations.some(
          (d) => d.property === "display" && d.value === "none",
        ),
      ),
    ).toBe(false);
    const template = skipLink.slice(
      skipLink.indexOf("\n---\n", 4),
      skipLink.indexOf("<style>"),
    );
    expect(template).not.toMatch(/\bhidden\b/);
  });

  it("フォーカスがあるときは、ヘッダーの z-index より上に出す", () => {
    const [shown] = rulesFor(SKIP, ".skip-link:is(:focus, .is-focus)");
    const headerRules = parseCss(
      cssOfAstro(source("components/site/SiteHeader.astro")),
    );
    const [site] = rulesFor(headerRules, ".site-header");
    expect(Number(valueIn(shown, "z-index"))).toBeGreaterThan(
      Number(valueIn(site, "z-index")),
    );
  });

  it("日本語は「本文へ移動」、英語は「Skip to main content」", () => {
    expect(translate("ja", "nav.skip")).toBe("本文へ移動");
    expect(translate("en", "nav.skip")).toBe("Skip to main content");
  });
});

describe("main のランドマーク", () => {
  const withMain = [...pages, "components/blog/BlogIndex.astro"].filter(
    (file) => /^\s*<main\b/m.test(source(file)),
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
    expect(others).toEqual(["components/blog/BlogIndex.astro"]);
  });

  it("フォーカスした main には輪を描かない", () => {
    const global = parseCss(source("styles/global.css"));
    const [main] = rulesFor(global, 'main[tabindex="-1"]:focus');
    expect(valueIn(main, "outline")).toBe("none");
  });
});
