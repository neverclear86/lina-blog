/**
 * How far the reader is in a post and which `h2` of it they are in, for the line under the site
 * header, the bar under the table of contents and the current item of the table of contents.
 */
import { currentSectionIndex } from "./site-nav";

/**
 * Distance in px from the end of the body within which the reader counts as having read it all:
 * the scroll position is a whole number on many displays and the end of the body is not.
 */
export const END_TOLERANCE = 1;

/**
 * Returns how far the reader has scrolled through the body of a post, from 0 at the top of the
 * page to 1 when the bottom of the body is less than `END_TOLERANCE` below the bottom of the
 * viewport. `scrollY` is the scroll position, `bodyBottom` the distance from the top of the page
 * to the bottom of the body and `viewportHeight` the height of the viewport, in px. A body that
 * fits in the viewport, and a scroll past its bottom, give 1; a negative scroll gives 0.
 */
export function readingProgress(
  scrollY: number,
  bodyBottom: number,
  viewportHeight: number,
): number {
  const scrollable = bodyBottom - viewportHeight;
  if (scrollable <= 0 || scrollable - scrollY < END_TOLERANCE) return 1;
  return Math.min(1, Math.max(0, scrollY / scrollable));
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
