import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { cssOfAstro, parseCss, rulesFor, valueIn } from "../test/css-source";

const SRC = new URL("../", import.meta.url);

/** Returns a file under `src/` as text. */
function read(path: string): string {
  return readFileSync(new URL(path, SRC), "utf8");
}

/** Returns the index of the `)` that closes the `(` at `open` in `text`. */
function closingParen(text: string, open: number): number {
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "(") depth++;
    else if (text[i] === ")" && --depth === 0) return i;
  }
  return text.length;
}

/** Returns `selector` with every `:global(...)` group removed, however deeply it nests. */
function withoutGlobal(selector: string): string {
  let rest = selector;
  for (
    let at = rest.indexOf(":global(");
    at >= 0;
    at = rest.indexOf(":global(")
  ) {
    rest =
      rest.slice(0, at) +
      rest.slice(closingParen(rest, at + ":global".length) + 1);
  }
  return rest;
}

/** `:root` or `html` as an element of a selector, not as part of a name such as `.html-x`. */
const ROOT_OR_HTML = /(^|[\s,>+~(])(:root|html)(?![\w-])/;

/**
 * Returns the selectors of the `<style>` elements of an `.astro` source that name `:root` or
 * `html` outside `:global()`.
 */
function unwrappedRoots(source: string): string[] {
  return parseCss(cssOfAstro(source))
    .flatMap((rule) => rule.selectors)
    .filter((selector) => ROOT_OR_HTML.test(withoutGlobal(selector)));
}

/**
 * Returns the selectors of the `<style>` elements of an `.astro` source with a `:global(...)`
 * group that starts with `:root` or `html` and holds more than that compound selector, such as
 * `:global(:root .a)`. Combinators inside parentheses or brackets, as in `html:has(.a .b)`,
 * stay inside the compound selector.
 */
function overWrappedRoots(source: string): string[] {
  return parseCss(cssOfAstro(source))
    .flatMap((rule) => rule.selectors)
    .filter((selector) => {
      for (
        let at = selector.indexOf(":global(");
        at >= 0;
        at = selector.indexOf(":global(", at + 1)
      ) {
        const open = at + ":global".length;
        const inner = selector.slice(open + 1, closingParen(selector, open));
        if (!/^(:root|html)(?![\w-])/.test(inner)) continue;
        let flat = inner;
        for (let prev = ""; prev !== flat; ) {
          prev = flat;
          flat = flat.replace(/\([^()]*\)|\[[^\]]*\]/g, "");
        }
        if (/[\s>+~]/.test(flat)) return true;
      }
      return false;
    });
}

/** Returns the `.astro` files under `src/` as `[path, source]`. */
function astroFiles(): [string, string][] {
  const paths = readdirSync(SRC, { recursive: true, encoding: "utf8" }).filter(
    (path) => path.endsWith(".astro"),
  );
  expect(paths).toContain("components/article/ArticleToc.astro");
  return paths.map((path) => [path, read(path)]);
}

/** Returns the last value `property` gets from the rules of `selector` in `global.css`. */
function finalValue(
  rules: ReturnType<typeof parseCss>,
  selector: string,
  property: string,
): string | undefined {
  return rulesFor(rules, selector)
    .map((rule) => valueIn(rule, property))
    .findLast((value) => value !== undefined);
}

const GLOBAL = parseCss(read("styles/global.css"));

describe(":root と html の :global()", () => {
  it("src の .astro のどの <style> も、:root と html を :global() で包んで書く", () => {
    const found = astroFiles().flatMap(([path, source]) =>
      unwrappedRoots(source).map((selector) => `src/${path}: ${selector}`),
    );
    expect(found).toEqual([]);
  });

  it("包まない :root と html を拾い、包んだものと名前の一部は拾わない", () => {
    const style = (...selectors: string[]) =>
      `<style>${selectors.map((selector) => `${selector} { color: red; }`).join("\n")}</style>`;
    expect(
      unwrappedRoots(
        style(
          ':root[data-theme="dark"] .a',
          ".a :root",
          "html:has(.b) .a",
          "html",
          ".a:not(:root)",
        ),
      ),
    ).toHaveLength(5);
    expect(
      unwrappedRoots(
        style(
          ':global(:root[data-theme="dark"]) .a',
          ":global(:root:not(.x)) .a",
          ":global(html:has(#menu:popover-open))",
          ".html-note",
          ".a[data-kind=html]",
          ".rooted",
          ":global(:root:has(.hero)) .brand :global(.cur)",
        ),
      ),
    ).toEqual([]);
  });

  it("src の .astro の :global() は、:root と html を包むときにその複合セレクタだけを包む", () => {
    const found = astroFiles().flatMap(([path, source]) =>
      overWrappedRoots(source).map((selector) => `src/${path}: ${selector}`),
    );
    expect(found).toEqual([]);
  });

  it("複合セレクタの外まで包んだ :root と html を拾い、複合セレクタだけを包んだものは拾わない", () => {
    const style = (...selectors: string[]) =>
      `<style>${selectors.map((selector) => `${selector} { color: red; }`).join("\n")}</style>`;
    expect(
      overWrappedRoots(
        style(
          ':global(:root[data-theme="dark"] .a)',
          ":global(html .a)",
          ":global(html > .a)",
          ':global(:root:not([data-theme="dark"]) .b:is(:hover, .c))',
        ),
      ),
    ).toHaveLength(4);
    expect(
      overWrappedRoots(
        style(
          ':global(:root[data-theme="dark"]) .a',
          ":global(:root:has(.hero .x)) .a",
          ":global(html:has(#menu:popover-open))",
          ":global(.a .b)",
        ),
      ),
    ).toEqual([]);
  });
});

describe("ページの枠", () => {
  it("Layout.astro は <style> を持たない", () => {
    expect(read("layouts/Layout.astro")).not.toMatch(/<style[\s>]/);
  });

  it.each([
    ["html", "margin", "0"],
    ["html", "width", "100%"],
    ["body", "margin", "0"],
    ["body", "width", "100%"],
    ["html", "height", "100%"],
    ["body", "display", "flex"],
    ["body", "flex-direction", "column"],
    ["body", "min-height", "100%"],
    [".site-content", "flex-grow", "1"],
    ["html", "--font-mono", "var(--font-mono-latin), var(--font-body)"],
    ["html", "font-family", "var(--font-body)"],
    ["html", "font-synthesis-weight", "none"],
  ])("global.css は %s の %s を %s にする", (selector, property, value) => {
    expect(finalValue(GLOBAL, selector, property)).toBe(value);
  });
});
