/** Links of the account window of the hero (`HeroAccount.astro`). */
import { FEED_PATH } from "../../blog-rss";
import {
  type ExternalLinkAttrs,
  externalLabel,
  externalLinkAttrs,
  isExternalLink,
} from "../../external-link";
import type { Locale } from "../../i18n/locales";
import { PROFILE_LINKS, type ProfileLink } from "../../profile-links";

/** Which icon a link shows: the service of a profile, or the feed. */
export type AccountLinkId = ProfileLink["id"] | "rss";

/** A link square of the account window. */
export interface AccountLink extends ExternalLinkAttrs {
  id: AccountLinkId;
  /**
   * Name of the link, which is its `aria-label`: the squares show an icon only. The name of a
   * link that leaves the site ends with the note of `externalLabel`.
   */
  label: string;
  href: string;
}

/**
 * Returns the links in order: the profiles of `PROFILE_LINKS`, then RSS. A profile leaves the
 * site, so it gets `target="_blank"`, `rel="me noopener"` and a `label` that ends with the note
 * that says it opens in a new tab (`externalLabel`). RSS is on the site and gets none of them.
 *
 * @param site Astro's `site`, which decides which links leave the site.
 */
export function accountLinks(lang: Locale, site: URL): AccountLink[] {
  const link = (
    id: AccountLinkId,
    name: string,
    href: string,
    rel?: string,
  ): AccountLink => ({
    id,
    label: isExternalLink(href, site) ? externalLabel(lang, name) : name,
    href,
    ...externalLinkAttrs(href, site, rel),
  });
  return [
    ...PROFILE_LINKS.map((profile) =>
      link(profile.id, profile.label[lang], profile.url, "me"),
    ),
    link("rss", "RSS", FEED_PATH),
  ];
}
