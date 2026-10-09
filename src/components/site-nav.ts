/** Link targets of the site header (`SiteHeader.astro`): its navigation and language switch. */
import { LOCALES, type Locale } from "../i18n/locales";
import { localizedPath } from "../i18n/paths";
import type { UiKey } from "../i18n/ui";

/** A section of the top page that the header links to, used as the fragment of the link. */
export type HomeSection = "top" | "about" | "works" | "latest" | "contact";

/** Path of the blog, which has no locale prefix. */
const BLOG_PATH = "/blog/";

/** Returns the link to `section` of the top page of `lang`, such as `/ja/#about`. */
export function homeSectionPath(lang: Locale, section: HomeSection): string {
  return `/${lang}/#${section}`;
}

export interface NavLink {
  /** Key of the item's text in `src/i18n/ui.ts`. */
  key: UiKey;
  href: string;
  /** Whether the page at `pathname` is this item's page, for `aria-current="page"`. */
  current: boolean;
}

/**
 * Returns the items of the main navigation in order. `nav.top`, `nav.about`, `nav.works` and
 * `nav.latest` link to their sections of the top page of `lang`, and `nav.blog` links to
 * `/blog/`, which has no locale prefix. `nav.top` is current on the top page of `lang` (`/ja/`,
 * or `/ja` without the trailing slash), `nav.works` on the pages under `/<lang>/works/` and
 * `nav.blog` on `/blog/` and the pages under it; the other items are never current.
 */
export function navLinks(lang: Locale, pathname: string): NavLink[] {
  const isTop = pathname === `/${lang}/` || pathname === `/${lang}`;
  const isWork = pathname.startsWith(`/${lang}/works/`);
  const isBlog = pathname.startsWith(BLOG_PATH);
  return [
    { key: "nav.top", href: homeSectionPath(lang, "top"), current: isTop },
    { key: "nav.about", href: homeSectionPath(lang, "about"), current: false },
    { key: "nav.works", href: homeSectionPath(lang, "works"), current: isWork },
    {
      key: "nav.latest",
      href: homeSectionPath(lang, "latest"),
      current: false,
    },
    { key: "nav.blog", href: BLOG_PATH, current: isBlog },
  ];
}

export interface LanguageLink {
  locale: Locale;
  href: string;
  /** Whether `locale` is the language of the page, for `aria-current="page"`. */
  current: boolean;
}

/**
 * Returns a link for each locale in `LOCALES`, in that order. The link of `lang` points to
 * `pathname` itself and is current; the others point to the same page in their locale
 * (`localizedPath`), which is their top page when `pathname` has no locale prefix.
 */
export function languageLinks(lang: Locale, pathname: string): LanguageLink[] {
  return LOCALES.map((locale) => ({
    locale,
    href: locale === lang ? pathname : localizedPath(pathname, locale),
    current: locale === lang,
  }));
}
