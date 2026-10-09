import sharp from "sharp";

/**
 * A rectangle in pixels. `left` and `top` are the offsets of its top left corner from the top
 * left corner of the image.
 */
export type Box = { left: number; top: number; width: number; height: number };

/**
 * How an avatar is made from the original. `name` is the file stem of the original
 * (`<name>.png`) and of the output (`src/assets/<name>.webp`). `width` and `height` are the size
 * of the output. `fit: "contain"` shrinks the crop until it fits in `width` × `height`, keeps
 * its ratio and centres it on transparent pixels. `fit: "fill"` shrinks the crop to `width` ×
 * (`height` - `padTop`), which differs from the crop's ratio by at most 0.2%, and then adds
 * `padTop` transparent rows above it.
 */
export type AvatarSpec = {
  name: string;
  width: number;
  height: number;
  fit: "contain" | "fill";
  padTop: number;
};

/**
 * The nine avatars of v2.1. The four poses are centred in frames of the same ratio, 851:1500,
 * so the feet and the centre stay still when Hero switches between them. The three views have
 * the sizes of the `viewBox` of the annotation lines in the design (459 × 1100, 316 × 1100 and
 * 597 × 1100). The side and the back view are shrunk to a height of 1074 and get 26 transparent
 * rows above, so that the bottom of each crop is at the bottom of the image.
 */
export const AVATARS: readonly AvatarSpec[] = [
  { name: "rohan", width: 1356, height: 2390, fit: "contain", padTop: 0 },
  {
    name: "lgtm-fullbody",
    width: 1356,
    height: 2390,
    fit: "contain",
    padTop: 0,
  },
  {
    name: "happy-fullbody",
    width: 1356,
    height: 2390,
    fit: "contain",
    padTop: 0,
  },
  { name: "main-visual", width: 1356, height: 2390, fit: "contain", padTop: 0 },
  { name: "threeview-front", width: 459, height: 1100, fit: "fill", padTop: 0 },
  { name: "threeview-side", width: 316, height: 1100, fit: "fill", padTop: 26 },
  { name: "threeview-back", width: 597, height: 1100, fit: "fill", padTop: 26 },
  { name: "lgtm-bastup", width: 748, height: 600, fit: "fill", padTop: 0 },
  { name: "hate", width: 145, height: 192, fit: "fill", padTop: 0 },
];

/**
 * The smallest rectangle that holds every pixel whose alpha is above 0, or `null` when the
 * image is fully transparent. `alpha` is the alpha channel, one byte per pixel in row order.
 */
export function alphaBounds(
  alpha: Uint8Array,
  width: number,
  height: number,
): Box | null {
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (alpha[y * width + x] === 0) continue;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      bottom = y;
    }
  }
  if (right < 0) return null;
  return { left, top, width: right - left + 1, height: bottom - top + 1 };
}

const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

/**
 * Makes one avatar from the original PNG at `source`: crops it to the bounds of its non-transparent
 * pixels (`alphaBounds`), shrinks it as `spec` says and returns the lossless WebP. Throws when
 * the original is fully transparent.
 */
export async function buildAvatar(
  source: string,
  spec: AvatarSpec,
): Promise<Buffer> {
  const { data, info } = await sharp(source)
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  const box = alphaBounds(data, info.width, info.height);
  if (box === null) throw new Error(`${source} is fully transparent`);
  let image = sharp(source).extract(box);
  if (spec.fit === "contain") {
    image = image.resize({
      width: spec.width,
      height: spec.height,
      fit: "contain",
      background: TRANSPARENT,
    });
  } else {
    image = image.resize({
      width: spec.width,
      height: spec.height - spec.padTop,
      fit: "fill",
    });
    if (spec.padTop > 0) {
      image = image.extend({ top: spec.padTop, background: TRANSPARENT });
    }
  }
  return image.webp({ lossless: true, effort: 6 }).toBuffer();
}
