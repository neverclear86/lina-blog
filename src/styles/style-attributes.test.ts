import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = new URL("../", import.meta.url);

/**
 * A `style` attribute on an element, and `define:vars`, which Astro renders as `style`
 * attributes. The Content Security Policy allows no inline `style` attribute.
 */
const INLINE_STYLE = /\sstyle=|\sdefine:vars\b/g;

/**
 * Returns the `style` attributes and `define:vars` written in the source of an `.astro` file,
 * as `<line>: <match>` in the order they appear. The whole file counts, frontmatter and
 * comments included.
 */
function inlineStyles(text: string): string[] {
  return [...text.matchAll(INLINE_STYLE)].map(
    (match) =>
      `${text.slice(0, match.index).split("\n").length}: ${match[0].trim()}`,
  );
}

describe("インラインの style 属性", () => {
  it("src の .astro に style 属性と define:vars が無い", () => {
    const files = readdirSync(SRC, {
      recursive: true,
      encoding: "utf8",
    }).filter((path) => path.endsWith(".astro"));
    expect(files).toContain("layouts/Layout.astro");
    const found = files.flatMap((path) =>
      inlineStyles(readFileSync(new URL(path, SRC), "utf8")).map(
        (hit) => `src/${path}:${hit}`,
      ),
    );
    expect(found).toEqual([]);
  });

  it("文字列、式、改行の後の style 属性と define:vars を拾う", () => {
    const astro = [
      '<p style="color: var(--fg)">a</p>',
      "<span style={{ width }} />",
      "<img",
      "  style={css}",
      "/>",
      "<style define:vars={{ w }}>",
    ].join("\n");
    expect(inlineStyles(astro)).toEqual([
      "1: style=",
      "2: style=",
      "4: style=",
      "6: define:vars",
    ]);
  });

  it("<style> 要素と style を含む別の属性は拾わない", () => {
    const astro = [
      "<style>",
      "a { color: var(--fg); }",
      "</style>",
      '<style is:global lang="css"></style>',
      '<div data-style="x" class="style-a"></div>',
    ].join("\n");
    expect(inlineStyles(astro)).toEqual([]);
  });
});
