import type { BlogFrontmatter } from "./blog-schema";
import { LOCALES, type Locale } from "./i18n/locales";
import { translate } from "./i18n/ui";
import type { OgImageInput } from "./og-image";

/**
 * The pages that have an OGP image: the paths of the images and what each one says.
 *
 * This module only imports the type of `OgImageInput`, never `src/og-image.ts` itself, because
 * that module imports sharp, which cannot be loaded in workerd where the pages are prerendered.
 */

/** Site-relative path of the list of the images, which the build reads and then deletes. */
export const OG_IMAGES_LIST_PATH = "/og/images.json";

/** An OGP image to draw: where to write it and what it says. */
export interface OgImagePage {
  /** Site-relative path of the image, such as `/og/ja.png`. */
  path: string;
  input: OgImageInput;
}

/** Returns the site-relative path of the image of the top page in `lang`: `/og/<lang>.png`. */
export function topOgImagePath(lang: Locale): string {
  return `/og/${lang}.png`;
}

/** Returns the site-relative path of the image of the post `slug`: `/og/blog/<slug>.png`. */
export function postOgImagePath(slug: string): string {
  return `/og/blog/${slug}.png`;
}

/** What the title of the top page's image puts between the two lines of the hero's heading. */
const TOP_TITLE_SEPARATOR: Record<Locale, string> = { ja: "", en: " " };

/**
 * Returns the images to draw: the top page in each locale, then each of `posts` in its order.
 *
 * The title of a top page is the heading of the hero in its language. A post's image is in
 * Japanese, the only language of the posts, and says the post's title, its first tag as the
 * category and, when it has one, the name of its sponsor.
 */
export function ogImagePages(
  posts: readonly {
    data: Pick<BlogFrontmatter, "title" | "slug" | "tags" | "sponsor">;
  }[],
): OgImagePage[] {
  const tops = LOCALES.map((lang) => ({
    path: topOgImagePath(lang),
    input: {
      title: [
        translate(lang, "hero.headingLead"),
        translate(lang, "hero.headingMark"),
      ].join(TOP_TITLE_SEPARATOR[lang]),
      lang,
    },
  }));
  const postPages = posts.map(({ data }) => ({
    path: postOgImagePath(data.slug),
    input: {
      title: data.title,
      lang: "ja" as const,
      category: data.tags[0],
      sponsor: data.sponsor?.name,
    },
  }));
  return [...tops, ...postPages];
}
