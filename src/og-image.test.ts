import opentype from "opentype.js";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import type { OgFont } from "./og-font";
import { type OgElement, renderOgPng } from "./og-image";

/**
 * Builds a font in which every character of `chars` is a solid square, so that text leaves
 * visible ink in a test without downloading a font.
 */
function squareFont(chars: string): OgFont {
  const square = new opentype.Path();
  square.moveTo(100, 0);
  square.lineTo(100, 700);
  square.lineTo(700, 700);
  square.lineTo(700, 0);
  square.close();
  const glyphs = [
    new opentype.Glyph({
      name: ".notdef",
      unicode: 0,
      advanceWidth: 800,
      path: new opentype.Path(),
    }),
    ...[...new Set(chars)].map(
      (char) =>
        new opentype.Glyph({
          name: `u${char.codePointAt(0)}`,
          unicode: char.codePointAt(0),
          advanceWidth: 800,
          path: square,
        }),
    ),
  ];
  const font = new opentype.Font({
    familyName: "Square",
    styleName: "Regular",
    unitsPerEm: 1000,
    ascender: 800,
    descender: -200,
    glyphs,
  });
  return {
    name: "Square",
    weight: 400,
    style: "normal",
    data: font.toArrayBuffer(),
  };
}

/** A white page that has black text in the font of {@link squareFont}. */
function page(text: string): OgElement {
  return {
    type: "div",
    props: {
      style: {
        display: "flex",
        width: "100%",
        height: "100%",
        background: "#ffffff",
        color: "#000000",
        fontFamily: "Square",
        fontSize: 100,
      },
      children: text,
    },
  };
}

describe("renderOgPng", () => {
  it("1200x630 の PNG を返す", async () => {
    const png = await renderOgPng(page("題"), [squareFont("題")]);
    const meta = await sharp(png).metadata();
    expect(meta.format).toBe("png");
    expect([meta.width, meta.height]).toEqual([1200, 630]);
    expect([meta.isPalette, meta.hasAlpha]).toEqual([false, true]);
  });

  it("要素木の背景と文字を、渡したフォントで描く", async () => {
    const png = await renderOgPng(page("題"), [squareFont("題")]);
    const { data, info } = await sharp(png)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const red = (x: number, y: number) =>
      data[(y * info.width + x) * info.channels];
    // The background is white at the bottom right corner; the square of the character is black
    // near the top left corner, where the text starts.
    expect(red(info.width - 1, info.height - 1)).toBe(255);
    expect(red(50, 50)).toBe(0);
  });
});
