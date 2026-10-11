/** Links and variants of the site footer (`SiteFooter.astro`). */
import { FEED_PATH } from "../blog-rss";
import {
  type ExternalLinkAttrs,
  externalLinkAttrs,
  isExternalLink,
} from "../external-link";
import type { Locale } from "../i18n/locales";
import type { UiKey } from "../i18n/ui";
import { PROFILE_LINKS } from "../profile-links";
import { contactPagePath, homeSectionPath } from "./site-nav";

/**
 * Which footer a page shows: "full" has the name logo, the site and links columns and the band
 * with the copyright; "compact" has only the face mark and the copyright, as the design draws
 * the footer of an article.
 */
export type FooterVariant = "full" | "compact";

/** A link of the site column. */
export interface FooterSiteLink {
  /** Key of the link's text in `src/i18n/ui.ts`. */
  key: UiKey;
  href: string;
}

/**
 * Returns the links of the site column in order: the top page of `lang`, then its profile
 * section, the blog (`/blog/`, which has no locale prefix) and the contact page
 * (`contactPagePath`).
 */
export function footerSiteLinks(lang: Locale): FooterSiteLink[] {
  return [
    { key: "nav.top", href: `/${lang}/` },
    { key: "nav.about", href: homeSectionPath(lang, "about") },
    { key: "nav.blog", href: "/blog/" },
    { key: "nav.contact", href: contactPagePath(lang) },
  ];
}

/** A link of the links column. */
export interface FooterProfileLink extends ExternalLinkAttrs {
  label: string;
  href: string;
  /** Whether the link leaves the site, so that its name is followed by `ExternalNote`. */
  external: boolean;
}

/**
 * Returns the links of the links column in order: the profiles of `PROFILE_LINKS`, then RSS. A
 * profile leaves the site, so it is `external` and gets `target="_blank"` and `rel="me noopener"`.
 * RSS is on the site and gets none of them.
 *
 * @param site Astro's `site`, which decides which links leave the site.
 */
export function footerProfileLinks(
  lang: Locale,
  site: URL,
): FooterProfileLink[] {
  const link = (label: string, href: string, rel?: string) => ({
    label,
    href,
    external: isExternalLink(href, site),
    ...externalLinkAttrs(href, site, rel),
  });
  return [
    ...PROFILE_LINKS.map((profile) =>
      link(profile.label[lang], profile.url, "me"),
    ),
    link("RSS", FEED_PATH),
  ];
}
