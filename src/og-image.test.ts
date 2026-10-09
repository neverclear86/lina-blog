import { readFileSync } from "node:fs";
import opentype from "opentype.js";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { OG_FONT_FACES, type OgFont } from "./og-font";
import {
  OG_COLORS,
  type OgElement,
  type OgImageInput,
  ogImageElement,
  renderOgImage,
  renderOgPng,
} from "./og-image";

/**
 * Builds a font in which every character of `chars` is a solid square, so that text leaves
 * visible ink in a test without downloading a font. The characters of `lowChars` are squares
 * that are only 200 units high, so that they can be told apart from the others.
 */
function squareFont(chars: string, lowChars = ""): OgFont {
  const squareOf = (height: number) => {
    const square = new opentype.Path();
    square.moveTo(100, 0);
    square.lineTo(100, height);
    square.lineTo(700, height);
    square.lineTo(700, 0);
    square.close();
    return square;
  };
  const square = squareOf(700);
  const low = squareOf(200);
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
    ...[...new Set(lowChars)].map(
      (char) =>
        new opentype.Glyph({
          name: `u${char.codePointAt(0)}`,
          unicode: char.codePointAt(0),
          advanceWidth: 800,
          path: low,
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
const page = (text: string): OgElement => ({
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
});

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

/** The value of each custom property in the first rule of `css` whose selector is `selector`. */
function tokens(css: string, selector: string): Record<string, string> {
  const rule = css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("}")
    .find((chunk) => chunk.split("{")[0].trim() === selector);
  if (rule === undefined)
    throw new Error(`tokens.css has no rule for ${selector}`);
  return Object.fromEntries(
    [...rule.matchAll(/(--[\w-]+):\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2].trim(),
    ]),
  );
}

/** Fonts that draw the characters of `chars` as squares under the families of the site. */
const squareFonts = (chars: string): OgFont[] =>
  OG_FONT_FACES.map((face) => ({
    ...squareFont(chars, "…"),
    name: face.family,
    weight: face.weight,
  }));

/** The red channel of every pixel of a PNG, as `red(x, y)`. */
async function redOf(png: Buffer) {
  const { data, info } = await sharp(png)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return (x: number, y: number) => data[(y * info.width + x) * info.channels];
}

const IS_INK = 128;

describe("OG_COLORS", () => {
  it("色は tokens.css のダークの値と一致する", () => {
    const css = readFileSync(
      new URL("./styles/tokens.css", import.meta.url),
      "utf8",
    );
    const light = tokens(css, ":root");
    const dark = { ...light, ...tokens(css, ':root[data-theme="dark"]') };
    expect(OG_COLORS).toEqual({
      bg: dark["--bg"],
      grid: dark["--grid"],
      text: dark["--text"],
      muted: dark["--muted"],
      keyword: dark["--keyword"],
      ink: dark["--ink"],
    });
  });
});

describe("ogImageElement", () => {
  const input: OgImageInput = { title: "題", lang: "ja", category: "制作記" };

  it("言語のロケールと、言語の付いたパスを持つ", () => {
    expect(JSON.stringify(ogImageElement(input))).toContain('"lang":"ja-JP"');
    expect(JSON.stringify(ogImageElement(input))).toContain("ikili.pro/ja/");
    const en = JSON.stringify(ogImageElement({ ...input, lang: "en" }));
    expect(en).toContain('"lang":"en-US"');
    expect(en).toContain("ikili.pro/en/");
  });

  it("カテゴリが無いときはチップを置かない", () => {
    const chip = JSON.stringify(ogImageElement(input));
    const top = JSON.stringify(ogImageElement({ title: "題", lang: "ja" }));
    expect(chip).toContain("制作記");
    expect(top).not.toContain("制作記");
  });
});

describe("renderOgImage", () => {
  const render = (input: OgImageInput, chars = input.title) =>
    renderOgImage(
      input,
      squareFonts(`${chars}${input.category ?? ""}ikili.pro/jaen`),
    ).then(redOf);

  it("地を ink で塗って 48px の格子を引き、右に斜めのオレンジの帯とハッチを描く", async () => {
    const png = await renderOgImage(
      { title: "題", lang: "ja" },
      squareFonts("題ikili.pro/jaen"),
    );
    const { data, info } = await sharp(png)
      .raw()
      .toBuffer({ resolveWithObject: true });
    const rgb = (x: number, y: number) => [
      ...data.subarray(
        (y * info.width + x) * info.channels,
        (y * info.width + x) * info.channels + 3,
      ),
    ];
    expect(rgb(20, 20)).toEqual([0x17, 0x18, 0x1b]);
    expect(rgb(48, 20)[0]).toBeGreaterThan(0x17);
    expect(rgb(1100, 300)).toEqual([0xe8, 0x73, 0x1a]);
    expect(rgb(950, 600)).toEqual([0xe8, 0x73, 0x1a]);
    // The hatch strip is the keyword color at 0.7 over the ground, left of the band.
    const hatched = [...Array(110).keys()].some(
      (dx) => rgb(900 + dx, 320).join() === [0xaa, 0x58, 0x1a].join(),
    );
    expect(hatched).toBe(true);
  });

  it("左下にロゴを描く", async () => {
    const red = await render({ title: "題", lang: "ja" });
    const inked = [...Array(420).keys()].some((dx) =>
      [...Array(40).keys()].some((dy) => red(64 + dx, 535 + dy) > IS_INK),
    );
    expect(inked).toBe(true);
  });

  it("カテゴリのチップは左上のオレンジの箱になる", async () => {
    const withChip = await render({
      title: "題",
      lang: "ja",
      category: "制作記",
    });
    const without = await render({ title: "題", lang: "ja" });
    expect([withChip(65, 76), without(65, 76)]).toEqual([0xe8, 0x17]);
  });

  /** The rows of the title area that have ink, as runs of `[top, bottom]`. */
  const lines = (red: (x: number, y: number) => number) => {
    const runs: [number, number][] = [];
    for (let y = 110; y < 520; y++) {
      const inked = [...Array(760).keys()].some(
        (dx) => red(64 + dx, y) > IS_INK,
      );
      if (inked && runs.at(-1)?.[1] === y - 1) runs[runs.length - 1][1] = y;
      else if (inked) runs.push([y, y]);
    }
    return runs;
  };
  /** Whether any pixel right of the title box, in the caption and title rows, has ink. */
  const overflows = (red: (x: number, y: number) => number) =>
    [...Array(60).keys()].some((dx) =>
      [...Array(520).keys()].some((y) => red(830 + dx, y) > IS_INK),
    );

  it.each([
    ["長い日本語の題", "あ".repeat(100), "ja"],
    ["区切りの無い長い英字の題", "A".repeat(120), "en"],
    ["空白で区切った長い英語の題", "Aaaa ".repeat(40), "en"],
  ] as const)(
    "%s は 3 行に収まり、枠からはみ出さない",
    async (_, title, lang) => {
      const red = await render({ title, lang });
      expect(lines(red)).toHaveLength(3);
      expect(overflows(red)).toBe(false);
    },
  );

  it("長いカテゴリは 400px の幅で切り、枠からはみ出さない", async () => {
    const red = await render({
      title: "題",
      lang: "ja",
      category: "あ".repeat(80),
    });
    expect(overflows(red)).toBe(false);
  });

  it("3 行を超える題は 3 行目の末尾を省略記号にし、収まる題は省略しない", async () => {
    const lastGlyphIsLow = async (title: string) => {
      const red = await renderOgImage(
        { title, lang: "ja" },
        squareFonts(`${title}ikili.pro/jaen`),
      ).then(redOf);
      const [top, bottom] = lines(red).at(-1) ?? [0, 0];
      const right = (y: number) =>
        [...Array(760).keys()]
          .filter((dx) => red(64 + dx, y) > IS_INK)
          .at(-1) ?? 0;
      return right(bottom) > right(top);
    };
    expect(await lastGlyphIsLow("あ".repeat(100))).toBe(true);
    expect(await lastGlyphIsLow("あ".repeat(30))).toBe(false);
  });
});
