/** Which files of the brand kit the face icons use, for a size and a face. */

/** The face the mark is drawn on: "default" for `--bg`, "inverse" for `--text`. */
export type FaceTone = "default" | "inverse";

/** A mark file of the kit (`icon-<color>.svg`), in the regular or the small version. */
export type MarkFile = `${"icon" | "icon-small"}-${"dark" | "ivory"}`;

/** An avatar file of the kit, in the regular or the small version. */
export type AvatarFile =
  `${"avatar" | "avatar-small"}-${"dark-on-ivory" | "ivory-on-ink"}-square`;

/**
 * Smallest side, in CSS pixels, of the square a mark is drawn in with the regular version. The
 * mark is 14.5/16 of the square tall and the icon guidelines set 40px for its height, so the
 * square needs 40 / (14.5 / 16) = 44.1px.
 */
const MARK_REGULAR_MIN = 45;

/**
 * Smallest side of the square a mark is drawn in at all. The guidelines set 24px for the height
 * of the small version, so the square needs 24 / (14.5 / 16) = 26.5px.
 */
const MARK_SMALL_MIN = 27;

/** Smallest side of an avatar with the regular version; the guidelines switch below 40px. */
const AVATAR_REGULAR_MIN = 40;

/**
 * Returns the files of the mark for a square of `size` CSS pixels, one for each theme: the
 * regular version from 45px, the small one from 27px up to 44px. With the "default" tone the
 * light theme gets the dark mark and the dark theme the ivory one; "inverse" swaps them. Throws
 * a RangeError below 27px, where the guidelines use no face.
 */
export function markFiles(
  size: number,
  tone: FaceTone = "default",
): { light: MarkFile; dark: MarkFile } {
  if (!(size >= MARK_SMALL_MIN)) {
    throw new RangeError(
      `The mark needs a square of at least ${MARK_SMALL_MIN}px, got ${size}px`,
    );
  }
  const version = size >= MARK_REGULAR_MIN ? "icon" : "icon-small";
  return tone === "inverse"
    ? { light: `${version}-ivory`, dark: `${version}-dark` }
    : { light: `${version}-dark`, dark: `${version}-ivory` };
}

/**
 * Returns the files of the avatar for a square of `size` CSS pixels, one for each theme: the
 * regular version from 40px and the small one below. The face is dark on ivory in the light
 * theme and ivory on ink in the dark theme.
 */
export function avatarFiles(size: number): {
  light: AvatarFile;
  dark: AvatarFile;
} {
  const version = size >= AVATAR_REGULAR_MIN ? "avatar" : "avatar-small";
  return {
    light: `${version}-dark-on-ivory-square`,
    dark: `${version}-ivory-on-ink-square`,
  };
}
