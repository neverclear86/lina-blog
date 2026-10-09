/**
 * Paths of the same page in each locale: for the language switch of the site header, and as the
 * absolute URLs of the canonical and hreflang links and of the OGP image that the layout puts in
 * `<head>`.
 */
import { DEFAULT_LOCALE, LOCALES, type Locale } from "./locales";

/** Returns whether `segment` is one of the locale codes in `LOCALES`. */
function isLocale(segment: string): segment is Locale {
  return (LOCALES as readonly string[]).includes(segment);
}

/**
 * Returns the path of the page at `pathname` in `locale`.
 *
 * A path that starts with a locale prefix, such as `/ja/about/`, keeps everything after
 * the prefix (`/en/about/`), since every page under `src/pages/[lang]/` exists in each
 * locale. A path without a locale prefix, such as `/blog/...` or `/`, has no counterpart
 * in other locales, so this returns the top page of `locale` (`/en/`).
 */
export function localizedPath(pathname: string, locale: Locale): string {
  const [, first = "", ...rest] = pathname.split("/");
  if (!isLocale(first)) {
    return `/${locale}/`;
  }
  return ["", locale, ...rest].join("/");
}

/** A `<link rel="alternate" hreflang>` of a page. */
export interface AlternateLink {
  /**
   * Value of the `hreflang` attribute: a locale code, or `x-default` for the page that picks the
   * language.
   */
  hreflang: Locale | "x-default";
  /** Absolute URL of the page in that language. */
  href: string;
}

/**
 * Returns `path` as an absolute URL under `site`, such as the canonical URL of a page or the URL
 * of its OGP image.
 *
 * @throws When `site` is undefined, because `astro.config.mjs` does not set it.
 */
export function absoluteUrl(path: string, site: URL | undefined): string {
  if (site === undefined) {
    throw new Error(
      "canonical and hreflang links and OGP image URLs need `site` in astro.config.mjs for absolute URLs",
    );
  }
  return new URL(path, site).href;
}

/**
 * Returns the canonical URL of the page at `pathname`: the page itself as an absolute URL under
 * `site`, such as `https://ikili.pro/ja/works/ikili-pro/`.
 *
 * @param pathname Path of the page, `Astro.url.pathname` in the layout.
 * @param site Astro's `site`, the origin of the absolute URLs.
 * @throws When `site` is undefined, because `astro.config.mjs` does not set it.
 */
export function canonicalUrl(pathname: string, site: URL | undefined): string {
  return absoluteUrl(pathname, site);
}

/**
 * Returns the hreflang alternates of the page at `pathname`, as absolute URLs under `site`.
 *
 * A page with a locale prefix, such as `/ja/about/`, exists in every locale, so this returns the
 * page in each locale of `LOCALES` in that order, including the page itself, and then
 * `x-default` pointing to `/`, which sends visitors to the top page of their language. A page
 * without a locale prefix, such as `/blog/...`, is only in `DEFAULT_LOCALE` and has no
 * counterpart, so this returns the page itself with `DEFAULT_LOCALE` alone.
 *
 * @param pathname Path of the page, `Astro.url.pathname` in the layout.
 * @param site Astro's `site`, the origin of the absolute URLs.
 * @throws When `site` is undefined, because `astro.config.mjs` does not set it.
 */
export function alternateLinks(
  pathname: string,
  site: URL | undefined,
): AlternateLink[] {
  const [, first = ""] = pathname.split("/");
  if (!isLocale(first)) {
    return [{ hreflang: DEFAULT_LOCALE, href: absoluteUrl(pathname, site) }];
  }
  return [
    ...LOCALES.map((locale) => ({
      hreflang: locale,
      href: absoluteUrl(localizedPath(pathname, locale), site),
    })),
    { hreflang: "x-default", href: absoluteUrl("/", site) },
  ];
}
