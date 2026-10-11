/**
 * Links that leave the site: which `href`s do, the attributes that open them in a new tab, the
 * text that tells assistive technology about it, and the `site` that components judge them by.
 */
import type { Locale } from "./i18n/locales";
import { translate } from "./i18n/ui";

/** Attributes to put on an `<a>`, which an Astro element takes with `{...attrs}`. */
export interface ExternalLinkAttrs {
  /** `"_blank"` for a link that leaves the site; absent otherwise. */
  target?: "_blank";
  /** The `rel` of the link; absent when there is none. */
  rel?: string;
}

/**
 * Returns whether following `href` leaves the site: it is an `http:` or `https:` URL whose host
 * differs from the host of `site`. `href` is resolved against `site` the way a browser resolves
 * the `href` of a link, so a relative path, a `#` anchor and an absolute URL on the host of `site`
 * stay on the site. A URL of another scheme, such as `mailto:`, and a URL that cannot be parsed
 * do not leave the site.
 */
export function isExternalLink(href: string, site: URL): boolean {
  let url: URL;
  try {
    url = new URL(href, site);
  } catch {
    return false;
  }
  return (
    (url.protocol === "http:" || url.protocol === "https:") &&
    url.hostname !== site.hostname
  );
}

/**
 * Returns the attributes of the link to `href` on a page of `site`. A link that leaves the site
 * gets `target="_blank"` and a `rel` made of `rel`, if given, plus `noopener` unless it has it.
 * The values of `rel` keep their order and are joined by single spaces. Any other link gets
 * `rel` as it is, or no attributes when `rel` is omitted.
 */
export function externalLinkAttrs(
  href: string,
  site: URL,
  rel?: string,
): ExternalLinkAttrs {
  if (!isExternalLink(href, site)) {
    return rel === undefined ? {} : { rel };
  }
  const values = (rel ?? "").split(/\s+/).filter((value) => value !== "");
  if (!values.some((value) => value.toLowerCase() === "noopener")) {
    values.push("noopener");
  }
  return { target: "_blank", rel: values.join(" ") };
}

/**
 * Returns the text that follows the name of a link that leaves the site, to tell that it is
 * another site and opens in a new tab. It starts with the separator of `lang` that the name
 * needs before it, so the text can be put right after the name.
 */
export function externalNote(lang: Locale): string {
  return (
    translate(lang, "link.externalSeparator") + translate(lang, "link.external")
  );
}

/**
 * Returns `label` followed by `externalNote(lang)`, for the `aria-label` of a link that leaves
 * the site and has no text of its own to put the note in.
 */
export function externalLabel(lang: Locale, label: string): string {
  return label + externalNote(lang);
}

/**
 * Returns `site`, which a component passes to `isExternalLink` and `externalLinkAttrs`:
 * `Astro.site` is the `URL | undefined` that `astro.config.mjs` sets.
 *
 * @throws When `site` is undefined, because `astro.config.mjs` does not set it.
 */
export function requireSite(site: URL | undefined): URL {
  if (site === undefined) {
    throw new Error(
      "`site` in astro.config.mjs is required to tell the links that leave the site.",
    );
  }
  return site;
}
