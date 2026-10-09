/**
 * Draws OGP images, in Node.
 *
 * Satori lays out an element tree and turns it into an SVG whose text is outlines, so no font
 * has to be installed to rasterize it, and sharp rasterizes the SVG into a PNG. This module
 * imports sharp, which cannot be loaded in workerd, so import it only from code that runs in
 * Node, such as the build, and never from anything in `src/pages/`, which is prerendered in
 * workerd.
 */

import satori from "satori";
import sharp from "sharp";
import type { OgFont } from "./og-font";

/** The element tree that Satori draws: `{ type, props }` objects, as in `React.createElement`. */
export type OgElement = Parameters<typeof satori>[0];

const OG_IMAGE_WIDTH = 1200;
const OG_IMAGE_HEIGHT = 630;

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
