import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cssOfAstro, parseCss, rulesFor, valueIn } from "../test/css-source";

const SRC = new URL("../", import.meta.url);

/** Returns the paths under `src/` of the `.astro` and `.css` files. */
function styleFiles(): string[] {
  return readdirSync(SRC, { recursive: true, encoding: "utf8" })
    .filter((path) => /\.(astro|css)$/.test(path))
    .sort();
}

/** Reads a file under `src/` without its CSS comments. */
function source(path: string): string {
  return readFileSync(new URL(path, SRC), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
}

/** Returns the rules of a `.css` file, or of the `<style>` elements of an `.astro` file. */
function rulesOf(path: string) {
  const text = source(path);
  return parseCss(path.endsWith(".css") ? text : cssOfAstro(text));
}

/** Returns whether a rule of `path` for `selector` sets `property` to a value with `--header-h`. */
function readsHeight(path: string, selector: string, property: string) {
  return rulesFor(rulesOf(path), selector).some((rule) =>
    valueIn(rule, property)?.includes("var(--header-h)"),
  );
}

/** Returns the paths of the style files whose text, without comments, matches `pattern`. */
function filesWith(pattern: RegExp): string[] {
  return styleFiles().filter((path) => pattern.test(source(path)));
}

describe("--header-h と --ease-out", () => {
  it("--header-h と --ease-out は global.css の html の規則にだけ定義がある", () => {
    for (const name of ["--header-h", "--ease-out"]) {
      expect(
        styleFiles().filter((path) =>
          rulesOf(path).some((rule) => valueIn(rule, name) !== undefined),
        ),
      ).toEqual(["styles/global.css"]);
      expect(
        rulesFor(rulesOf("styles/global.css"), "html").filter(
          (rule) => valueIn(rule, name) !== undefined,
        ),
      ).toHaveLength(1);
    }
  });

  it("イージングの cubic-bezier(0.2, 0.8, 0.2, 1) とヘッダーの高さの 61px は global.css の定義の外に書かない", () => {
    const curve = /cubic-bezier\(\s*0?\.2,\s*0?\.8,\s*0?\.2,\s*1\s*\)/;
    expect(filesWith(curve)).toEqual(["styles/global.css"]);
    expect(filesWith(/(?<![\w.-])61px\b/)).toEqual(["styles/global.css"]);
  });

  it("scroll-padding、目次の top、開いたメニューの inset と max-height は --header-h から決める", () => {
    const menu = "components/site/SiteHeader.astro";
    expect(readsHeight("styles/global.css", "html", "scroll-padding")).toBe(
      true,
    );
    expect(readsHeight("pages/blog/[slug].astro", ".toc-side", "top")).toBe(
      true,
    );
    expect(readsHeight(menu, ".menu-panel", "inset")).toBe(true);
    expect(readsHeight(menu, ".menu-panel", "max-height")).toBe(true);
  });
});
