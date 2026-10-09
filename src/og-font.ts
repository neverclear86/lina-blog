/**
 * Reads the fonts for the text on OGP images, in Node.
 *
 * The files that the Fonts API (`fonts` in `astro.config.mjs`) downloads are WOFF2 and split
 * into numbered unicode-range chunks, which image renderers such as Satori cannot read. This
 * module asks the same Google Fonts CSS API without a browser `User-Agent`, which answers with
 * one unsplit TrueType file per weight.
 */

/** A weight that Satori accepts for a font. */
export type OgFontWeight = 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900;

/** A family and weight of the fonts that OGP images are drawn with. */
export interface OgFontFace {
  family: string;
  weight: OgFontWeight;
}

/**
 * Fonts of OGP images: the headings of the site (Zen Kaku Gothic New 900, which also has the
 * Latin glyphs) and the labels (JetBrains Mono 400 and 700). Each is a family and weight that
 * `fonts` in `astro.config.mjs` loads for the site.
 */
export const OG_FONT_FACES: readonly OgFontFace[] = [
  { family: "Zen Kaku Gothic New", weight: 900 },
  { family: "JetBrains Mono", weight: 400 },
  { family: "JetBrains Mono", weight: 700 },
];

/** A font file with the family and weight that a renderer registers it under. */
export interface OgFont {
  name: string;
  weight: OgFontWeight;
  style: "normal";
  data: ArrayBuffer;
}

/** Google Fonts CSS API request for one weight of a family. */
const cssUrl = ({ family, weight }: OgFontFace): string =>
  `https://fonts.googleapis.com/css2?family=${family.replaceAll(" ", "+")}:wght@${weight}`;

/**
 * Finds the URL of the first TrueType file in the `src` of a Google Fonts stylesheet.
 *
 * @param css The body of a Google Fonts CSS API response.
 * @returns The URL of the first `url(...) format('truetype')`, or `null` when there is none,
 *   such as in a stylesheet for browsers that lists only WOFF2 files.
 */
export function truetypeUrlFromCss(css: string): string | null {
  return (
    css.match(/url\(([^)\s]+)\)\s*format\(['"]truetype['"]\)/)?.[1] ?? null
  );
}

async function loadFace(
  face: OgFontFace,
  fetchImpl: typeof fetch,
): Promise<OgFont> {
  const url = cssUrl(face);
  const cssResponse = await fetchImpl(url);
  if (!cssResponse.ok) {
    throw new Error(`Google Fonts answered ${cssResponse.status} for ${url}`);
  }
  const fontUrl = truetypeUrlFromCss(await cssResponse.text());
  if (fontUrl === null) {
    throw new Error(`Google Fonts listed no TrueType file for ${url}`);
  }
  const fontResponse = await fetchImpl(fontUrl);
  if (!fontResponse.ok) {
    throw new Error(
      `Google Fonts answered ${fontResponse.status} for ${fontUrl}`,
    );
  }
  return {
    name: face.family,
    weight: face.weight,
    style: "normal",
    data: await fontResponse.arrayBuffer(),
  };
}

/**
 * Downloads every font of {@link OG_FONT_FACES} from Google Fonts as one TrueType file each.
 * Every call downloads them again.
 *
 * @param fetchImpl The `fetch` to use; tests pass a stub.
 * @returns The fonts in the order of {@link OG_FONT_FACES}, named and weighted as in the site.
 * @throws Error when a stylesheet or a font answers with a non-2xx status, or when a stylesheet
 *   lists no TrueType file.
 */
export function loadOgFonts(
  fetchImpl: typeof fetch = fetch,
): Promise<OgFont[]> {
  return Promise.all(OG_FONT_FACES.map((face) => loadFace(face, fetchImpl)));
}
