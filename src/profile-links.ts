/**
 * Links to the profiles on other services, shared by `/llms.txt` (`src/llms.ts`) and the text
 * version of the site (`src/text-site.ts`).
 */
import type { Locale } from "./i18n/locales";

/** A profile on another service. */
export interface ProfileLink {
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

/**
 * Profiles on other services, in the order of the design's icon row (without RSS). X is
 * written "Twitter(自称X)" in Japanese and "Twitter (self-proclaimed X)" in English everywhere
 * except in its icon. The Nostr npub is provisional.
 */
export const PROFILE_LINKS: readonly ProfileLink[] = [
  {
    label: { ja: "YouTube", en: "YouTube" },
    url: "https://www.youtube.com/@LinaTsukusu",
    note: { ja: "動画と配信", en: "Videos and streams" },
  },
  {
    label: { ja: "Twitter(自称X)", en: "Twitter (self-proclaimed X)" },
    url: "https://x.com/TsukusuLina",
    note: { ja: "近況", en: "Updates" },
  },
  {
    label: { ja: "GitHub", en: "GitHub" },
    url: "https://github.com/neverclear86",
    note: { ja: "ソースコード", en: "Source code" },
  },
  {
    label: { ja: "Nostr", en: "Nostr" },
    url: "https://nostter.app/npub1es86m387vusxe66jjp200eqkn3lcxsxudeg2g50zz0yjx5ggvt8sgctaxz",
    note: { ja: "近況", en: "Updates" },
    shortForm:
      "nostr:npub1es86m387vusxe66jjp200eqkn3lcxsxudeg2g50zz0yjx5ggvt8sgctaxz",
  },
  {
    label: { ja: "Zenn", en: "Zenn" },
    url: "https://zenn.dev/linatsukusu",
    note: { ja: "技術記事", en: "Tech articles" },
  },
];
