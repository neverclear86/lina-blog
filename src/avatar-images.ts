/**
 * The nine avatar images of v2.1 in `src/assets/`, with the alt text, the candidate widths and
 * the `sizes` that `Picture` of `astro:assets` needs to output them as AVIF and WebP.
 */
import type { ImageMetadata } from "astro";
import happyFullbody from "./assets/happy-fullbody.webp";
import hate from "./assets/hate.webp";
import lgtmBastup from "./assets/lgtm-bastup.webp";
import lgtmFullbody from "./assets/lgtm-fullbody.webp";
import mainVisual from "./assets/main-visual.webp";
import rohan from "./assets/rohan.webp";
import threeviewBack from "./assets/threeview-back.webp";
import threeviewFront from "./assets/threeview-front.webp";
import threeviewSide from "./assets/threeview-side.webp";
import type { Locale } from "./i18n/locales";
import { translate, type UiKey } from "./i18n/ui";

/** How a component outputs one avatar image with `Picture`. */
export interface AvatarImage {
  /** File stem of the image in `src/assets/` (`<name>.webp`). */
  name: string;
  src: ImageMetadata;
  /** Key of the alt text in `ui.ts`, or `null` for a decorative image whose `alt` is empty. */
  altKey: UiKey | null;
  /** Candidate widths in pixels: the display widths at 1x and 2x, none wider than the image. */
  widths: number[];
  /** The `sizes` attribute for the places the image is shown at. */
  sizes: string;
  /** True for the image in the first view of the page: no lazy loading, high fetch priority. */
  priority: boolean;
}

// Hero shows a pose 800px high on desktop, 540px high up to 900px wide and 1195px high on mobile.
// The frame is 851:1500, so the displayed widths are 454px, 306px and 678px.
const POSE_WIDTHS = [306, 454, 612, 678, 908, 1356];
const POSE_SIZES = "(max-width: 767px) 678px, (max-width: 900px) 306px, 454px";

/** One of the four poses; they differ only in the file and in `priority`. */
function pose(
  name: string,
  src: ImageMetadata,
  priority: boolean,
): AvatarImage {
  return {
    name,
    src,
    altKey: null,
    widths: POSE_WIDTHS,
    sizes: POSE_SIZES,
    priority,
  };
}

/**
 * The four poses of Hero in the order of the design. They are decorative, so `altKey` is `null`
 * and the button that switches them carries the name. Only the first belongs in the first view of
 * the page, so only the first has `priority`; the others stay lazy.
 */
export const HERO_POSES: readonly AvatarImage[] = [
  pose("rohan", rohan, true),
  pose("lgtm-fullbody", lgtmFullbody, false),
  pose("happy-fullbody", happyFullbody, false),
  pose("main-visual", mainVisual, false),
];

/** The three views of About. `sizes` splits at 1200px, where the design changes the height. */
export const THREE_VIEW = {
  front: {
    name: "threeview-front",
    src: threeviewFront,
    altKey: "avatar.frontAlt",
    widths: [184, 217, 368, 434],
    sizes: "(max-width: 1199px) 184px, 217px",
    priority: false,
  },
  side: {
    name: "threeview-side",
    src: threeviewSide,
    altKey: "avatar.sideAlt",
    widths: [126, 149, 252, 299],
    sizes: "(max-width: 1199px) 126px, 149px",
    priority: false,
  },
  back: {
    name: "threeview-back",
    src: threeviewBack,
    altKey: "avatar.backAlt",
    widths: [239, 282, 478, 564],
    sizes: "(max-width: 1199px) 239px, 282px",
    priority: false,
  },
} satisfies Record<string, AvatarImage>;

/** The thumbs-up in the contact band, shown 374px wide on desktop and 128px on mobile. */
export const THUMBS_UP_BAND: AvatarImage = {
  name: "lgtm-bastup",
  src: lgtmBastup,
  altKey: "avatar.thumbsUpAlt",
  widths: [128, 256, 340, 374, 680, 748],
  sizes: "(max-width: 899px) 128px, 374px",
  priority: false,
};

/**
 * The same image at the end of an article: 340px wide from 768px, and below 768px as wide as the
 * column of the article but not wider than 400px.
 */
export const THUMBS_UP_ARTICLE: AvatarImage = {
  ...THUMBS_UP_BAND,
  widths: [128, 256, 340, 374, 400, 680, 748],
  sizes: "(max-width: 767px) min(400px, calc(100vw - 32px)), 340px",
};

/** The thinking Lina in the note of an article, shown 72px wide on desktop and 52px on mobile. */
export const THINKING: AvatarImage = {
  name: "hate",
  src: hate,
  altKey: "avatar.thinkingAlt",
  widths: [52, 72, 104, 145],
  sizes: "(max-width: 767px) 52px, 72px",
  priority: false,
};

/** The nine images: the four poses, the three views, the thumbs-up and the thinking Lina. */
export const AVATAR_IMAGES: readonly AvatarImage[] = [
  ...HERO_POSES,
  THREE_VIEW.front,
  THREE_VIEW.side,
  THREE_VIEW.back,
  THUMBS_UP_BAND,
  THINKING,
];

/** Returns the `alt` of `avatar` in `locale`; empty for a decorative image. */
export function avatarAlt(avatar: AvatarImage, locale: Locale): string {
  return avatar.altKey === null ? "" : translate(locale, avatar.altKey);
}
