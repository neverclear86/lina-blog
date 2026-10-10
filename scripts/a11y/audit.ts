/**
 * Pure helpers of the accessibility audit `bun run a11y` (`scripts/a11y/run.ts`): the routes to
 * audit and the status each must answer, which axe results fail the audit, and the WCAG contrast
 * check that `run.ts` applies to the text that axe cannot decide.
 */

/** An sRGB color: red, green and blue, each 0-255. */
export type Rgb = readonly [number, number, number];

/** A box in page pixels: `[x, y, width, height]`. */
export type Rect = readonly [number, number, number, number];

/** An RGBA screenshot as `sharp` returns it: 4 bytes per pixel, rows from the top. */
export type Pixels = { data: Uint8Array; width: number; height: number };

/** The path of a page that does not exist; the server answers it with `404.html`. */
export const NOT_FOUND_PATH = "/not-found-page-for-audit/";

/** Axe's impact levels that fail the audit, besides every `color-contrast` result. */
const FAILING_IMPACTS = new Set(["serious", "critical"]);

/**
 * Returns the URL paths of the pages in a build. `files` are the paths of the files under
 * `dist/client/`, relative to it and separated by `/`. `dir/index.html` gives `/dir/` and
 * `index.html` gives `/`; `404.html` gives `NOT_FOUND_PATH`. Other files are ignored. The result
 * is sorted.
 */
export function routesOf(files: string[]): string[] {
  const paths: string[] = [];
  for (const file of files) {
    if (file === "404.html") paths.push(NOT_FOUND_PATH);
    else if (file === "index.html") paths.push("/");
    else if (file.endsWith("/index.html"))
      paths.push(`/${file.slice(0, -"index.html".length)}`);
  }
  return paths.sort();
}

/**
 * Returns the HTTP status that the server must answer for `path`: 404 for `NOT_FOUND_PATH` and
 * 200 for the rest.
 */
export function expectedStatus(path: string): number {
  return path === NOT_FOUND_PATH ? 404 : 200;
}

/**
 * Returns whether an axe violation fails the audit: every `color-contrast` violation, and every
 * violation whose impact is `serious` or `critical`.
 */
export function isFailing(violation: {
  id: string;
  impact?: string | null;
}): boolean {
  return (
    violation.id === "color-contrast" ||
    FAILING_IMPACTS.has(violation.impact ?? "")
  );
}

/** Returns the relative luminance of a color (WCAG 2.x, 0 for black and 1 for white). */
function luminance([r, g, b]: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

/** Returns the WCAG contrast ratio of two colors, from 1 to 21, in either order. */
export function contrastRatio(a: Rgb, b: Rgb): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

/**
 * Returns the contrast ratio that text needs for WCAG AA: 3 for large text (24px or more, or
 * 18.66px or more at weight 700 or more) and 4.5 for all other text.
 */
export function requiredRatio(fontSizePx: number, fontWeight: number): number {
  const large = fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700);
  return large ? 3 : 4.5;
}

/**
 * Returns the lowest contrast ratio of text of color `fg` and opacity `alpha` (its color alpha
 * times the opacity of its ancestors) against the pixels inside `rects`, where each pixel is
 * the background and `fg` is laid over it with `alpha`. Parts of a rect outside the image are
 * not measured. Returns `undefined` when no pixel was measured.
 */
export function worstRatio(
  image: Pixels,
  rects: readonly Rect[],
  fg: Rgb,
  alpha: number,
): number | undefined {
  let worst: number | undefined;
  for (const [x, y, w, h] of rects) {
    const x0 = Math.max(0, Math.floor(x));
    const x1 = Math.min(image.width, Math.ceil(x + w));
    const y0 = Math.max(0, Math.floor(y));
    const y1 = Math.min(image.height, Math.ceil(y + h));
    for (let py = y0; py < y1; py++) {
      for (let px = x0; px < x1; px++) {
        const i = (py * image.width + px) * 4;
        const back: Rgb = [image.data[i], image.data[i + 1], image.data[i + 2]];
        const ink: Rgb = [
          fg[0] * alpha + back[0] * (1 - alpha),
          fg[1] * alpha + back[1] * (1 - alpha),
          fg[2] * alpha + back[2] * (1 - alpha),
        ];
        const ratio = contrastRatio(ink, back);
        if (worst === undefined || ratio < worst) worst = ratio;
      }
    }
  }
  return worst;
}
