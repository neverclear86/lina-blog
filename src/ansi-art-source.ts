/**
 * The illustration that the text art of `/ansi/color.txt` and `/ansi/plain.txt` is drawn from,
 * and how it is decoded. `astro.config.mjs` calls `decodeAnsiArtSource()` when it builds the
 * text art, in Node, because the endpoints are prerendered in workerd, which cannot load sharp.
 */
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { ANSI_ART_MAX_COLUMNS, type RgbaImage } from "./ansi-art.ts";

/** Illustration that the text art is drawn from: the fourth pose of the top page's Hero. */
export const ANSI_ART_SOURCE = new URL(
  "./assets/main-visual.webp",
  import.meta.url,
);

/**
 * Decodes `ANSI_ART_SOURCE` to raw RGBA pixels, resized to `ANSI_ART_MAX_COLUMNS` pixels wide
 * with the aspect ratio kept, so every line of the art fits in 80 columns. The illustration is
 * centred in a transparent frame, so the figure is narrower than the lines and is indented by
 * the transparent pixels at the left.
 */
export async function decodeAnsiArtSource(): Promise<RgbaImage> {
  const { data, info } = await sharp(fileURLToPath(ANSI_ART_SOURCE))
    .resize({ width: ANSI_ART_MAX_COLUMNS })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
}
