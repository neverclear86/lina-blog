/**
 * The rules of the pose switch in the hero (`src/components/HeroPoses.astro`): which pose comes
 * next, which class each image has, and the name of the button. The component calls them for the
 * first view at build time and its script on each click, so both give the same state.
 */

/** State of one pose: the class of its image. */
export type PoseClass = "pz-init" | "pz-in" | "pz-out" | "pz-off";

/**
 * Returns the index of the pose after `current` among `count` poses, going back to 0 after the
 * last one; 0 when `count` is not positive.
 */
export function nextPose(current: number, count: number): number {
  return count > 0 ? (current + 1) % count : 0;
}

/**
 * Returns the class of the image `index` when the pose `current` is shown and `previous` was
 * shown before it (`null` before the first switch). After a switch the pose on show wipes in
 * (`pz-in`) and the one that was shown wipes out (`pz-out`); before it the pose on show slides in
 * from the right as the page opens (`pz-init`). The others are hidden (`pz-off`).
 */
export function poseClass(
  index: number,
  current: number,
  previous: number | null,
): PoseClass {
  if (index === current) {
    return previous === null ? "pz-init" : "pz-in";
  }
  return index === previous ? "pz-out" : "pz-off";
}

/**
 * Fills `{n}` and `{total}` in the name of the switch button (`hero.poseButton`) with the number
 * of the pose on show, counted from 1, and the number of poses.
 */
export function poseLabel(template: string, n: number, total: number): string {
  return template
    .replaceAll("{n}", String(n))
    .replaceAll("{total}", String(total));
}
