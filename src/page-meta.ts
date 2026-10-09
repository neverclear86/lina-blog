/**
 * The description, the Open Graph tags and the Twitter card tags that the layout puts in the
 * `<head>` of every page.
 */
import type { Locale } from "./i18n/locales";
import { translate } from "./i18n/ui";

/**
 * Value of `og:locale` for each locale: the language with its region, as the Open Graph protocol
 * writes it.
 */
const OG_LOCALES: Record<Locale, string> = { ja: "ja_JP", en: "en_US" };

/** Width of the OGP images in pixels, which `og:image:width` says. */
const IMAGE_WIDTH = 1200;

/** Height of the OGP images in pixels, which `og:image:height` says. */
const IMAGE_HEIGHT = 630;

/** A `<meta property content>` tag of the Open Graph protocol (https://ogp.me/). */
export interface OpenGraphTag {
  /** Name of the property, such as `og:title`. */
  property: string;
  /** Value of the property. */
  content: string;
}

/** A page as `openGraphTags` describes it. */
interface OpenGraphPage {
  /** Language of the page, which gives `og:locale`. */
  lang: Locale;
  /** Title of the page, the text of its `<title>`. */
  title: string;
  /** Description of the page, as `pageDescription` returns it. */
  description: string;
  /** Canonical URL of the page, which `og:url` repeats. */
  url: string;
  /** Absolute URL of the OGP image of the page. The page has no image when it is omitted. */
  image?: string;
}

/** A `<meta name content>` tag of the Twitter card. */
export interface TwitterTag {
  /** Name of the tag, such as `twitter:card`. */
  name: string;
  /** Value of the tag. */
  content: string;
}

/**
 * Returns the description of a page: `description` when the page passes one, and otherwise the
 * description of the site in `lang` (`site.description` in `src/i18n/ui.ts`), which the top page
 * uses.
 *
 * @param lang Language of the page.
 * @param description The page's own description, such as the description of a work.
 */
export function pageDescription(
  lang: Locale,
  description: string | undefined,
): string {
  return description ?? translate(lang, "site.description");
}

/**
 * Returns the Open Graph tags of a page, in the order the layout writes them: `og:title`,
 * `og:description`, `og:url`, `og:type`, `og:site_name` and `og:locale`. Every page is a
 * `website` of the site `ikili.pro`, and `og:locale` is the language of the page with its region,
 * such as `ja_JP`. A page with an `image` has `og:image`, `og:image:width` (1200) and
 * `og:image:height` (630) after them, and a page without one has no image tags.
 */
export function openGraphTags(page: OpenGraphPage): OpenGraphTag[] {
  const tags = [
    { property: "og:title", content: page.title },
    { property: "og:description", content: page.description },
    { property: "og:url", content: page.url },
    { property: "og:type", content: "website" },
    { property: "og:site_name", content: "ikili.pro" },
    { property: "og:locale", content: OG_LOCALES[page.lang] },
  ];
  if (page.image !== undefined) {
    tags.push(
      { property: "og:image", content: page.image },
      { property: "og:image:width", content: String(IMAGE_WIDTH) },
      { property: "og:image:height", content: String(IMAGE_HEIGHT) },
    );
  }
  return tags;
}

/**
 * Returns the Twitter card tags of a page, in the order the layout writes them. `twitter:card` is
 * `summary_large_image` and `twitter:image` follows it when the page has an `image`; a page
 * without one has `twitter:card` as `summary` only.
 *
 * @param image Absolute URL of the OGP image of the page, as in `OpenGraphPage`.
 */
export function twitterTags(image: string | undefined): TwitterTag[] {
  if (image === undefined) {
    return [{ name: "twitter:card", content: "summary" }];
  }
  return [
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:image", content: image },
  ];
}
