import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = new URL("../", import.meta.url);

/** Hex colors (`#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa`) and CSS color functions. */
const COLOR = new RegExp(
  [
    String.raw`#(?:[0-9a-f]{8}|[0-9a-f]{6}|[0-9a-f]{3,4})\b`,
    String.raw`\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(`,
  ].join("|"),
  "gi",
);

const COMMENT = /\/\*[\s\S]*?\*\//g;

/**
 * Returns the parts of a source file under `src/` where CSS colors can be written.
 *
 * A `.css` file is returned whole without its comments. In an `.astro` file only the contents of
 * `<style>` elements and the values of the `style`, `fill`, `stroke`, `stop-color` and `color`
 * attributes count: `#` in the rest of the markup (such as `href="#about"`) is not a color, and the
 * frontmatter passes values to code, not to CSS.
 */
function colorSources(path: string, text: string): string[] {
  if (path.endsWith(".css")) {
    return [text.replace(COMMENT, "")];
  }
  const styles = [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)].map(
    (match) => match[1].replace(COMMENT, ""),
  );
  const attributes = [
    ...text.matchAll(
      /\s(?:style|fill|stroke|stop-color|color)=(?:"([^"]*)"|'([^']*)'|\{([^}]*)\})/g,
    ),
  ].map((match) => match[1] ?? match[2] ?? match[3]);
  return [...styles, ...attributes];
}

/** Returns the color values written directly in `path`, in the order they appear. */
function hardcodedColors(path: string, text: string): string[] {
  return colorSources(path, text).flatMap((source) =>
    [...source.matchAll(COLOR)].map((match) => match[0]),
  );
}

describe("色の直書き", () => {
  it("src の .astro と tokens.css 以外の .css に色の直書きが無い", () => {
    const files = readdirSync(SRC, { recursive: true, encoding: "utf8" })
      .filter((path) => path.endsWith(".astro") || path.endsWith(".css"))
      .filter((path) => path !== "styles/tokens.css");
    expect(files).toContain("layouts/Layout.astro");
    const found = files.flatMap((path) =>
      hardcodedColors(path, readFileSync(new URL(path, SRC), "utf8")).map(
        (color) => `src/${path}: ${color}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it("<style> と色の属性の中の 16 進と色の関数を拾う", () => {
    const astro = [
      '<svg fill="#fff" stroke="rgb(0 0 0)"><circle style="color: #E8731A80" /></svg>',
      '<linearGradient><stop stop-color="#abcd" /></linearGradient>',
      "<g color='hwb(0 0% 0%)' style={{ color: \"lab(50 0 0)\" }} />",
      "<style>",
      "a { color: #232427; background: hsl(0 0% 100%); border-color: oklch(0.5 0.1 30); }",
      "b { outline-color: lch(50 0 0); caret-color: oklab(0.5 0 0); fill: color(srgb 1 0 0); }",
      "</style>",
    ].join("\n");
    expect(hardcodedColors("a.astro", astro)).toEqual([
      "#232427",
      "hsl(",
      "oklch(",
      "lch(",
      "oklab(",
      "color(",
      "#fff",
      "rgb(",
      "#E8731A80",
      "#abcd",
      "hwb(",
      "lab(",
    ]);
    expect(
      hardcodedColors("a.css", "a { color: rgba(0, 0, 0, 0.5); }"),
    ).toEqual(["rgba("]);
  });

  it("フロントマター、アンカー、コメント、var() は拾わない", () => {
    const astro = [
      "---",
      'const FAVICON_BACKGROUND = "#ECEAE5";',
      "---",
      '<a href="#about" style={pixelWidth}>about</a>',
      "<style>",
      "/* was #232427 */",
      "#main { color: var(--fg); background: color-mix(in srgb, var(--bg) 50%, transparent); }",
      "</style>",
    ].join("\n");
    expect(hardcodedColors("a.astro", astro)).toEqual([]);
    expect(
      hardcodedColors("a.css", "/* #fff */ a { color: var(--fg); }"),
    ).toEqual([]);
  });
});
