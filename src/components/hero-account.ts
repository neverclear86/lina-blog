/** Links of the account window of the hero (`HeroAccount.astro`). */
import { FEED_PATH } from "../blog-rss";
import type { Locale } from "../i18n/locales";
import { PROFILE_LINKS, type ProfileLink } from "../profile-links";

/** Which icon a link shows: the service of a profile, or the feed. */
export type AccountLinkId = ProfileLink["id"] | "rss";

/** A link square of the account window. */
export interface AccountLink {
  id: AccountLinkId;
  /** Name of the link, which is its `aria-label`: the squares show an icon only. */
  label: string;
  href: string;
  /** `rel` of the link; "me" for the profiles. */
  rel?: string;
}

/** Returns the links in order: the profiles of `PROFILE_LINKS`, then RSS. */
export function accountLinks(lang: Locale): AccountLink[] {
  return [
    ...PROFILE_LINKS.map((link) => ({
      id: link.id,
      label: link.label[lang],
      href: link.url,
      rel: "me",
    })),
    { id: "rss", label: "RSS", href: FEED_PATH },
  ];
}
