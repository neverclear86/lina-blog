/**
 * Draws OGP images, in Node.
 *
 * Satori lays out an element tree and turns it into an SVG whose text is outlines, so no font
 * has to be installed to rasterize it, and sharp rasterizes the SVG into a PNG. This module
 * imports sharp, which cannot be loaded in workerd, so import it only from code that runs in
 * Node, such as the build, and never from anything in `src/pages/`, which is prerendered in
 * workerd.
 *
 * The images are built from the elements of plan A (`design/Main.dc.html` and
 * `design/AArticle.dc.html`) in its dark theme only: the ink ground with the 48px grid, the
 * orange slanted band with its hatch strip, the category chip, the caption in JetBrains Mono and
 * the title in Zen Kaku Gothic New. The image of a sponsored post also has an ivory "PR" chip
 * and, under the title, a row with the label and the name of the sponsor. The logo is
 * `src/assets/name-logo/t3_full_for-dark.svg`, the brand kit's file as it is. An image has no
 * avatar.
 */

import { readFileSync } from "node:fs";
import satori from "satori";
import sharp from "sharp";
import type { Locale } from "./i18n/locales";
import { translate } from "./i18n/ui";
import type { OgFont } from "./og-font";

/** The element tree that Satori draws: `{ type, props }` objects, as in `React.createElement`. */
export type OgElement = Parameters<typeof satori>[0];

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

/**
 * Colors of the images: the values of `--bg`, `--grid`, `--text`, `--muted`, `--keyword` and
 * `--ink` in the dark theme of `src/styles/tokens.css`. Satori cannot read CSS variables, so
 * `og-image.test.ts` checks every value against that file.
 */
export const OG_COLORS = {
  bg: "#17181b",
  grid: "rgba(236, 234, 229, 0.045)",
  text: "#eceae5",
  muted: "#a3a3a0",
  keyword: "#e8731a",
  ink: "#17181b",
} as const;

/** What an image says. */
export interface OgImageInput {
  /** The title of the page. It is cut after three lines, with an ellipsis. */
  title: string;
  /**
   * The language of the page. It sets the locale of the title, the path in the caption and the
   * label of the sponsor.
   */
  lang: Locale;
  /** The category of a post, shown as a chip. Without it, the image has no chip. */
  category?: string;
  /**
   * The name of the sponsor of a post. A sponsored post gets a "PR" chip and, under the title,
   * a row with the label and this name, which is cut after one line with an ellipsis. Without
   * it, or when it is empty, the image has neither.
   */
  sponsor?: string;
}

/** The logo as a data URI, which Satori draws as an image. */
const LOGO_URI = `data:image/svg+xml;base64,${readFileSync(
  new URL("./assets/name-logo/t3_full_for-dark.svg", import.meta.url),
).toString("base64")}`;

/** The width of the title box in pixels. The title ends left of the band and its hatch strip. */
const TITLE_WIDTH = 760;

/** The most lines of a title. Satori cuts a longer title and ends its last line with "…". */
const TITLE_LINES = 3;

/** The locale that Satori breaks and shapes the title in, for each language of the site. */
const LOCALE_TAGS: Record<Locale, string> = { ja: "ja-JP", en: "en-US" };

type Style = Record<string, string | number>;

const box = (
  style: Style,
  children?: OgElement | OgElement[] | string,
  props: Record<string, string> = {},
): OgElement => ({ type: "div", props: { style, children, ...props } });

/** A stripe of the band, slanted by 22 degrees and reaching beyond the top and bottom edges. */
const stripe = (right: number, width: number, paint: Style): OgElement =>
  box({
    position: "absolute",
    top: -200,
    right,
    width,
    height: 1000,
    transform: "rotate(22deg)",
    ...paint,
  });

/**
 * Draws an element tree into a 1200x630 PNG.
 *
 * @param element The root of the tree. Satori lays it out with flexbox, so every element that has
 *   more than one child needs `display: flex`.
 * @param fonts The fonts the tree names in `fontFamily`, such as the result of `loadOgFonts`.
 * @returns The bytes of a PNG that is 1200 pixels wide and 630 pixels high.
 * @throws Error from Satori, such as `No fonts are loaded.` when `fonts` is empty.
 */
export async function renderOgPng(
  element: OgElement,
  fonts: readonly OgFont[],
): Promise<Buffer> {
  const svg = await satori(element, {
    width: OG_IMAGE_WIDTH,
    height: OG_IMAGE_HEIGHT,
    fonts: [...fonts],
  });
  return sharp(Buffer.from(svg)).png().toBuffer();
}

/**
 * Builds the element tree of an OGP image: a 1200x630 page that Satori can draw.
 *
 * @param input The title, language, category and sponsor of the page.
 * @returns The element tree, to pass to {@link renderOgPng} with the fonts of `loadOgFonts`.
 */
export function ogImageElement({
  title,
  lang,
  category,
  sponsor,
}: OgImageInput): OgElement {
  const { keyword } = OG_COLORS;
  const chip = (text: string, backgroundColor: string) =>
    box(
      {
        display: "block",
        maxWidth: 400,
        padding: "4px 12px",
        marginRight: 16,
        overflow: "hidden",
        whiteSpace: "nowrap",
        backgroundColor,
        color: OG_COLORS.ink,
        fontWeight: 700,
        letterSpacing: "0.1em",
      },
      text,
    );
  const titleBox = box(
    {
      display: "block",
      width: TITLE_WIDTH,
      fontSize: 64,
      fontWeight: 900,
      lineHeight: 1.3,
      lineClamp: TITLE_LINES,
      wordBreak: "break-word",
    },
    title,
    { lang: LOCALE_TAGS[lang] },
  );
  const sponsorRow = box(
    { display: "flex", alignItems: "center", fontSize: 26 },
    [
      box(
        {
          display: "flex",
          flexShrink: 0,
          marginRight: 16,
          color: OG_COLORS.muted,
        },
        translate(lang, "og.sponsor.label"),
      ),
      box({ display: "block", fontWeight: 900, lineClamp: 1 }, sponsor),
    ],
  );
  return box(
    {
      display: "flex",
      position: "relative",
      width: OG_IMAGE_WIDTH,
      height: OG_IMAGE_HEIGHT,
      overflow: "hidden",
      backgroundColor: OG_COLORS.bg,
      backgroundImage: `linear-gradient(${OG_COLORS.grid} 1px, transparent 1px), linear-gradient(90deg, ${OG_COLORS.grid} 1px, transparent 1px)`,
      backgroundSize: "48px 48px",
      fontFamily: "Zen Kaku Gothic New",
      color: OG_COLORS.text,
    },
    [
      stripe(190, 28, {
        backgroundImage: `repeating-linear-gradient(to bottom, ${keyword} 0px, ${keyword} 5px, transparent 5px, transparent 15px)`,
        opacity: 0.7,
      }),
      stripe(40, 120, { backgroundColor: keyword }),
      box(
        {
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          width: TITLE_WIDTH + 128,
          height: "100%",
          padding: "56px 64px",
        },
        [
          box(
            {
              display: "flex",
              alignItems: "center",
              fontFamily: "JetBrains Mono",
              fontSize: 22,
              color: OG_COLORS.muted,
            },
            [
              ...(category ? [chip(category, keyword)] : []),
              ...(sponsor ? [chip("PR", OG_COLORS.text)] : []),
              box({ display: "flex" }, `ikili.pro/${lang}/`),
            ],
          ),
          sponsor
            ? box({ display: "flex", flexDirection: "column", gap: 20 }, [
                titleBox,
                sponsorRow,
              ])
            : titleBox,
          { type: "img", props: { src: LOGO_URI, width: 420, height: 52 } },
        ],
      ),
    ],
  );
}

/**
 * Draws an OGP image: the 1200x630 PNG of {@link ogImageElement}.
 *
 * @param input The title, language, category and sponsor of the page.
 * @param fonts The fonts of `loadOgFonts`, which the tree names in `fontFamily`.
 * @returns The bytes of the PNG.
 * @throws Error from {@link renderOgPng}.
 */
export function renderOgImage(
  input: OgImageInput,
  fonts: readonly OgFont[],
): Promise<Buffer> {
  return renderOgPng(ogImageElement(input), fonts);
}
