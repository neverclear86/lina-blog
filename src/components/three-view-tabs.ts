/**
 * Which view of the avatar a key, a swipe or a tap selects in `AvatarThreeView.astro`, and the
 * gesture that tells a swipe from a tap.
 */

/**
 * Distance in px that a pointer has to move to the right, by more than this, to count as a swipe
 * back.
 */
export const SWIPE_DISTANCE = 40;

/** The parts of a `KeyboardEvent` that `viewAfterKey` reads. */
export interface KeyLike {
  key: string;
  altKey: boolean;
  ctrlKey: boolean;
  metaKey: boolean;
}

/** The parts of a `PointerEvent` that `createSwipe` reads. */
export interface PointerLike {
  isPrimary: boolean;
  button: number;
  clientX: number;
}

/**
 * Returns the index of the view that the key selects while the tab `current` of `count` tabs has
 * the focus: ArrowRight and ArrowLeft move to the next and the previous view and wrap around,
 * Home and End go to the first and the last. Returns `null` for any other key, and for every
 * key pressed with Alt, Ctrl or Meta.
 */
export function viewAfterKey(
  event: KeyLike,
  current: number,
  count: number,
): number | null {
  if (event.altKey || event.ctrlKey || event.metaKey) {
    return null;
  }
  switch (event.key) {
    case "ArrowRight":
      return (current + 1) % count;
    case "ArrowLeft":
      return (current + count - 1) % count;
    case "Home":
      return 0;
    case "End":
      return count - 1;
    default:
      return null;
  }
}

/**
 * Returns the index of the view after a gesture on the stage that moved the pointer `dx` px to the
 * right (negative: to the left). A move of more than `SWIPE_DISTANCE` to the right goes back to
 * the previous view; any other gesture, a move to the left or a tap, goes on to the next view.
 */
export function viewAfterSwipe(
  dx: number,
  current: number,
  count: number,
): number {
  return (current + (dx > SWIPE_DISTANCE ? count - 1 : 1)) % count;
}

/**
 * Returns the recorder of one pointer gesture. `down` remembers the `clientX` where the main
 * button of a mouse or the first finger went down, and forgets the start when any other pointer
 * goes down. `up` returns how far to the right the main pointer moved from the start, and forgets
 * the start; it returns `null` when no start is remembered or the released pointer is not the
 * main one. `cancel` forgets the start, for the `pointercancel` that comes when the browser takes
 * a touch over to scroll the page.
 */
export function createSwipe() {
  let startX: number | null = null;
  const isMain = (e: PointerLike) => e.isPrimary && e.button === 0;
  return {
    down(e: PointerLike): void {
      startX = isMain(e) ? e.clientX : null;
    },
    up(e: PointerLike): number | null {
      const start = startX;
      startX = null;
      return start !== null && isMain(e) ? e.clientX - start : null;
    },
    cancel(): void {
      startX = null;
    },
  };
}
