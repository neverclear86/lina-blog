/**
 * Turns raw RGBA pixels into text art for terminals: each character cell stands for two pixels
 * stacked vertically, drawn with half-block characters. No image decoding happens here; callers
 * decode and resize the image first, so the functions stay pure and unit-testable.
 */

/** Raw pixels of an image: `data` holds 4 bytes (R, G, B, A) per pixel, row by row. */
export type RgbaImage = {
  width: number;
  height: number;
  data: Uint8Array;
};

/**
 * The widest image, in pixels, that the functions accept. One pixel becomes one column, so
 * the output fits an 80-column terminal.
 */
export const ANSI_ART_MAX_COLUMNS = 80;

/** Pixels with alpha below this value are transparent; the rest are drawn with their RGB. */
const ALPHA_THRESHOLD = 128;

const ESC = "\x1b";
const RESET = `${ESC}[0m`;

type Rgb = readonly [number, number, number];

/** One character cell: the upper and lower pixel, or `null` where the pixel is transparent. */
type Cell = { top: Rgb | null; bottom: Rgb | null };

/** Returns the pixel's color, or `null` if it is transparent or below the last row. */
function pixelAt(image: RgbaImage, x: number, y: number): Rgb | null {
  if (y >= image.height) {
    return null;
  }
  const offset = (y * image.width + x) * 4;
  if (image.data[offset + 3] < ALPHA_THRESHOLD) {
    return null;
  }
  return [image.data[offset], image.data[offset + 1], image.data[offset + 2]];
}

/**
 * Validates the image and splits it into rows of cells, two pixel rows per cell row. When the
 * height is odd, the lower half of the last row is transparent.
 */
function toCells(image: RgbaImage): Cell[][] {
  if (image.width > ANSI_ART_MAX_COLUMNS) {
    throw new RangeError(
      `Image is ${image.width} pixels wide; the maximum is ${ANSI_ART_MAX_COLUMNS}`,
    );
  }
  const expected = image.width * image.height * 4;
  if (image.data.length !== expected) {
    throw new RangeError(
      `Image data holds ${image.data.length} bytes; expected ${expected}`,
    );
  }
  const rows: Cell[][] = [];
  for (let y = 0; y < image.height; y += 2) {
    const row: Cell[] = [];
    for (let x = 0; x < image.width; x++) {
      row.push({ top: pixelAt(image, x, y), bottom: pixelAt(image, x, y + 1) });
    }
    rows.push(row);
  }
  return rows;
}

function ansiCell(cell: Cell): string {
  const { top, bottom } = cell;
  if (top && bottom) {
    return `${ESC}[38;2;${top.join(";")};48;2;${bottom.join(";")}m▀`;
  }
  if (top) {
    return `${ESC}[38;2;${top.join(";")};49m▀`;
  }
  if (bottom) {
    return `${ESC}[38;2;${bottom.join(";")};49m▄`;
  }
  return `${RESET} `;
}

function plainCell(cell: Cell): string {
  const { top, bottom } = cell;
  if (top && bottom) {
    return "█";
  }
  if (top) {
    return "▀";
  }
  if (bottom) {
    return "▄";
  }
  return " ";
}

/**
 * Renders the image with 24-bit color SGR sequences and half blocks. `▀` takes the upper
 * pixel as its foreground and the lower pixel as its background; where only the lower pixel
 * is opaque, `▄` takes it as the foreground. Transparent halves keep the terminal's default
 * background. Every line ends with `ESC[0m` and a newline, so no color leaks into the next
 * line or into text printed after the art.
 *
 * @throws {RangeError} If the image is wider than `ANSI_ART_MAX_COLUMNS` or `data` does not
 *   hold `width * height * 4` bytes.
 */
export function renderAnsiArt(image: RgbaImage): string {
  return toCells(image)
    .map((row) => `${row.map(ansiCell).join("")}${RESET}\n`)
    .join("");
}

/**
 * Renders the image's silhouette without escape sequences, for output that is not read by a
 * color terminal: `█` where both pixels are opaque, `▀` or `▄` where only one is, and a space
 * where both are transparent. Every line ends with a newline.
 *
 * @throws {RangeError} On the same images as `renderAnsiArt`.
 */
export function renderPlainArt(image: RgbaImage): string {
  return toCells(image)
    .map((row) => `${row.map(plainCell).join("")}\n`)
    .join("");
}
