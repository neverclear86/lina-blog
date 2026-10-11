/**
 * How far the reader is in a post and which `h2` of it they are in, for the line under the site
 * header, the bar under the table of contents and the current item of the table of contents.
 */
import { currentSectionIndex } from "./site-nav";

/**
 * Distance in px from the end of the reading range (see `readingProgress`) within which the
 * reader counts as having read the body: the scroll position is a whole number on many
 * displays and the end of the range is not.
 */
export const END_TOLERANCE = 1;

/**
 * Positions in px that decide how far the reader is in a post. `bodyTop` and `bodyBottom` are
 * the distances from the top of the page to the top and the bottom of the body, `headerBottom`
 * the distance from the top of the viewport to the bottom of the site header, `viewportHeight`
 * the height of the viewport and `maxScroll` how far the page scrolls (its height less
 * `viewportHeight`).
 */
export interface ReadingGeometry {
  bodyTop: number;
  bodyBottom: number;
  headerBottom: number;
  viewportHeight: number;
  maxScroll: number;
}

/**
 * Returns how far the reader has scrolled through the body of a post, from 0 to 1. It is 0 until
 * the top of the body reaches the bottom of the site header, and 1 once the bottom of the body
 * is less than `END_TOLERANCE` below the middle of the viewport; in between it grows in step
 * with `scrollY`, the scroll position in px. The end is kept within the page: when the body is
 * too short to bring its bottom up to the middle of the viewport, the end is the scroll
 * position at the bottom of the page, and so it is when the bottom of the body passes the middle
 * of the viewport before its top reaches the bottom of the site header. When the start is then
 * not before the end, the value stays 0 until the bottom of the page and jumps to 1 there. A
 * page that does not scroll (`maxScroll` of 0 or less) gives 1, as does a scroll past the end;
 * a negative scroll gives 0 on a page that scrolls.
 */
export function readingProgress(
  scrollY: number,
  geometry: ReadingGeometry,
): number {
  const { bodyTop, bodyBottom, headerBottom, viewportHeight, maxScroll } =
    geometry;
  if (maxScroll <= 0) return 1;
  const start = bodyTop - headerBottom;
  const reach = Math.min(bodyBottom - viewportHeight / 2, maxScroll);
  // A body whose bottom passes the middle before its top reaches the header ends at the bottom.
  const end = reach <= start ? maxScroll : reach;
  if (end - scrollY < END_TOLERANCE) return 1;
  if (end <= start) return 0;
  return Math.min(1, Math.max(0, (scrollY - start) / (end - start)));
}

/**
 * Returns the index of the `h2` that the reader is in. `tops` has, for each `h2` in order, the
 * distance from the top of the viewport to its top, or `null` when the page has no such heading.
 * It is the index that `currentSectionIndex` picks: the last heading whose top is above
 * `SECTION_LINE`, or the first while none is. Once the page is scrolled (`scrollY` above 0) and
 * the body is read to its end (`progress` is 1), it is the last heading, which a short last
 * section may never bring up to the line. It is -1 when there is no heading.
 */
export function currentHeadingIndex(
  tops: readonly (number | null)[],
  scrollY: number,
  progress: number,
): number {
  if (tops.length === 0) return -1;
  if (scrollY > 0 && progress >= 1) return tops.length - 1;
  return currentSectionIndex(tops);
}
