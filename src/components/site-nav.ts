/**
 * Link targets of the site: the navigation and the language switch of the site header
 * (`SiteHeader.astro`), the contact page, and which section the reader is in, on the top page
 * and in a post.
 */
import { LOCALES, type Locale } from "../i18n/locales";
import { localizedPath } from "../i18n/paths";

/** A section of the top page that the header links to, used as the fragment of the link. */
export type HomeSection = "top" | "about" | "latest" | "blog" | "works";

/** Path of the blog, which has no locale prefix. */
const BLOG_PATH = "/blog/";

/** Whether `pathname` is the blog (`/blog` or `/blog/`) or a page under it. */
function isBlogPath(pathname: string): boolean {
  return pathname === "/blog" || pathname.startsWith(BLOG_PATH);
}

/** Returns the link to `section` of the top page of `lang`, such as `/ja/#about`. */
export function homeSectionPath(lang: Locale, section: HomeSection): string {
  return `/${lang}/#${section}`;
}

/** Returns the path of the contact page of `lang`, such as `/ja/contact/`. */
export function contactPagePath(lang: Locale): string {
  return `/${lang}/contact/`;
}

/**
 * Returns whether the page at `pathname` is the contact page of `lang` (`/ja/contact/`, or
 * `/ja/contact` without the trailing slash), for `aria-current="page"` of the contact button.
 */
export function isContactPage(lang: Locale, pathname: string): boolean {
  const path = contactPagePath(lang);
  return pathname === path || pathname === path.slice(0, -1);
}

/** Returns true when `pathname` is the top page of `lang`: `/ja/`, or `/ja` without the slash. */
export function isTopPath(lang: Locale, pathname: string): boolean {
  return pathname === `/${lang}/` || pathname === `/${lang}`;
}

/** Value of `aria-current` of the item of the page: "page" or "true". */
export type NavCurrent = "page" | "true";

export interface NavLink {
  /** Text of the item, such as `00 top`. It is the same in every language. */
  label: string;
  href: string;
  /** Value of `aria-current` for the page at `pathname`, or undefined when not current. */
  current: NavCurrent | undefined;
}

/**
 * Returns the items of the main navigation in order: `00 top`, `01 about`, `02 latest`,
 * `03 blog` and `04 works`.
 *
 * Each item links to its section of the top page of `lang`, such as `/ja/#about`, except `03 blog`
 * on a page other than the top page (`/ja/` or `/ja`), which links to `/blog/`.
 *
 * `03 blog` is current with "page" on `/blog/` itself and with "true" on the pages under it, such
 * as an article or a list of a tag. `04 works` is current with "true" on the pages under
 * `/ja/works/`. No other page has a current item from this function; on the top page the
 * header marks the section that the reader is in instead (`currentSectionIndex`).
 */
export function navLinks(lang: Locale, pathname: string): NavLink[] {
  const isTop = isTopPath(lang, pathname);
  const isBlogIndex = pathname === BLOG_PATH || pathname === "/blog";
  const isWork = pathname.startsWith(`/${lang}/works/`);
  const blogCurrent: NavCurrent | undefined = isBlogIndex
    ? "page"
    : isBlogPath(pathname)
      ? "true"
      : undefined;
  return [
    { label: "00 top", href: homeSectionPath(lang, "top"), current: undefined },
    {
      label: "01 about",
      href: homeSectionPath(lang, "about"),
      current: undefined,
    },
    {
      label: "02 latest",
      href: homeSectionPath(lang, "latest"),
      current: undefined,
    },
    {
      label: "03 blog",
      href: isTop ? homeSectionPath(lang, "blog") : BLOG_PATH,
      current: blogCurrent,
    },
    {
      label: "04 works",
      href: homeSectionPath(lang, "works"),
      current: isWork ? "true" : undefined,
    },
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
 * (`localizedPath`), which is their top page when `pathname` has no locale prefix. A page of
 * the blog (`/blog/` and the pages under it) is only in Japanese and has no counterpart, so
 * this returns the link of `lang` alone.
 */
export function languageLinks(lang: Locale, pathname: string): LanguageLink[] {
  const current: LanguageLink = { locale: lang, href: pathname, current: true };
  if (isBlogPath(pathname)) return [current];
  return LOCALES.map((locale) =>
    locale === lang
      ? current
      : { locale, href: localizedPath(pathname, locale), current: false },
  );
}

/**
 * Distance from the top of the viewport above which a section counts as the one the reader is
 * in. It is more than the 61px of the sticky header and the 72px below the top at which a link
 * to a section lands (`scroll-margin-top` in `global.css`), so the section of a clicked item
 * is the current one.
 */
export const SECTION_LINE = 160;

/**
 * Returns the index of the section that the reader is in. `tops` has, for each section in order,
 * the distance from the top of the viewport to its top, or `null` when the page has no such
 * section. The sections are the items of the navigation of the top page, or the `h2` of a post
 * (`currentHeadingIndex` in `./reading-progress`). The section is the one whose top is nearest
 * to `line` among those above it, whatever the order of the sections in the page; of two with
 * the same top, the later one. It is 0 when no section is above `line`.
 */
export function currentSectionIndex(
  tops: readonly (number | null)[],
  line: number = SECTION_LINE,
): number {
  let current = 0;
  let nearest = Number.NEGATIVE_INFINITY;
  tops.forEach((top, index) => {
    if (top !== null && top < line && top >= nearest) {
      current = index;
      nearest = top;
    }
  });
  return current;
}
