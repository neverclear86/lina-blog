/**
 * Link targets of the site: the navigation and the language switch of the site header
 * (`SiteHeader.astro`), and the contact page.
 */
import { LOCALES, type Locale } from "../i18n/locales";
import { localizedPath } from "../i18n/paths";

/** A section of the top page that the header links to, used as the fragment of the link. */
export type HomeSection =
  | "top"
  | "about"
  | "latest"
  | "blog"
  | "works"
  | "contact";

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
 * `/ja/works/`. No other page has a current item, including the top page.
 */
export function navLinks(lang: Locale, pathname: string): NavLink[] {
  const isTop = pathname === `/${lang}/` || pathname === `/${lang}`;
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
