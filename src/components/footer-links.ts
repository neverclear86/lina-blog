/** Links and variants of the site footer (`SiteFooter.astro`). */
import { FEED_PATH } from "../blog-rss";
import type { Locale } from "../i18n/locales";
import type { UiKey } from "../i18n/ui";
import { PROFILE_LINKS } from "../profile-links";
import { homeSectionPath } from "./site-nav";

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
 * Returns the links of the site column in order: the top page of `lang`, then its profile,
 * works and contact sections, with the blog (`/blog/`, which has no locale prefix) third.
 */
export function footerSiteLinks(lang: Locale): FooterSiteLink[] {
  return [
    { key: "nav.top", href: `/${lang}/` },
    { key: "nav.about", href: homeSectionPath(lang, "about") },
    { key: "nav.blog", href: "/blog/" },
    { key: "nav.works", href: homeSectionPath(lang, "works") },
    { key: "nav.contact", href: homeSectionPath(lang, "contact") },
  ];
}

/** A link of the links column. */
export interface FooterProfileLink {
  label: string;
  href: string;
  /** `rel` of the link; "me" for the profiles. */
  rel?: string;
}

/** Returns the links of the links column in order: the profiles of `PROFILE_LINKS`, then RSS. */
export function footerProfileLinks(lang: Locale): FooterProfileLink[] {
  return [
    ...PROFILE_LINKS.map((link) => ({
      label: link.label[lang],
      href: link.url,
      rel: "me",
    })),
    { label: "RSS", href: FEED_PATH },
  ];
}
