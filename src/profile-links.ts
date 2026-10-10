/**
 * Links to the profiles on other services, shared by `/llms.txt` (`src/llms.ts`), the text
 * version of the site (`src/text-site.ts`), the large window and the video list of the Latest
 * section (`src/components/LatestVideoFeature.astro`, `src/components/LatestVideoList.astro`),
 * the account window of the hero (`src/components/hero-account.ts`) and the links column of the
 * site footer (`src/components/footer-links.ts`).
 */
import type { Locale } from "./i18n/locales";

/** A profile on another service. */
export interface ProfileLink {
  /** Service of the profile, which picks its icon in the account window of the hero. */
  id: "youtube" | "twitter" | "github" | "nostr" | "zenn";
  /** Name of the service in each locale. */
  label: Record<Locale, string>;
  /** URL of the profile. */
  url: string;
  /** What the profile is for, in each locale. */
  note: Record<Locale, string>;
  /**
   * Shorter form of the profile that the text version prints instead of `url`, for a URL
   * that does not fit in its 80 columns.
   */
  shortForm?: string;
}

/** The channel page on YouTube, also linked from the Latest section of the home page. */
export const YOUTUBE_URL = "https://www.youtube.com/@LinaTsukusu";

/**
 * The public key of the Nostr account in bech32, which the Nostr profile below and the links to
 * the posts on Nostr (`nostrArticleUrl` in `src/nostr-address.ts`) are built from. It is
 * provisional, as the profile is.
 */
export const NOSTR_NPUB =
  "npub1es86m387vusxe66jjp200eqkn3lcxsxudeg2g50zz0yjx5ggvt8sgctaxz";

/**
 * Profiles on other services, in the order of the design's icon row (without RSS). X is
 * written "Twitter(自称X)" in Japanese and "Twitter (self-proclaimed X)" in English everywhere
 * except in its icon. The Nostr npub is provisional.
 */
export const PROFILE_LINKS: readonly ProfileLink[] = [
  {
    id: "youtube",
    label: { ja: "YouTube", en: "YouTube" },
    url: YOUTUBE_URL,
    note: { ja: "動画と配信", en: "Videos and streams" },
  },
  {
    id: "twitter",
    label: { ja: "Twitter(自称X)", en: "Twitter (self-proclaimed X)" },
    url: "https://x.com/TsukusuLina",
    note: { ja: "近況", en: "Updates" },
  },
  {
    id: "github",
    label: { ja: "GitHub", en: "GitHub" },
    url: "https://github.com/neverclear86",
    note: { ja: "ソースコード", en: "Source code" },
  },
  {
    id: "nostr",
    label: { ja: "Nostr", en: "Nostr" },
    url: `https://nostter.app/${NOSTR_NPUB}`,
    note: { ja: "近況", en: "Updates" },
    shortForm: `nostr:${NOSTR_NPUB}`,
  },
  {
    id: "zenn",
    label: { ja: "Zenn", en: "Zenn" },
    url: "https://zenn.dev/linatsukusu",
    note: { ja: "技術記事", en: "Tech articles" },
  },
];
