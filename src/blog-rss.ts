/**
 * Feed items for `/rss.xml`, built from blog posts. `src/pages/rss.xml.ts` passes the posts of
 * the `blog` collection, and `src/layouts/Layout.astro` links the feed from every page. The
 * text version of the site (`src/text-site.ts`) also titles its latest posts with
 * `rssItemTitle` and links the feed by `FEED_PATH`.
 */
import type { RSSFeedItem } from "@astrojs/rss";
import type { BlogFrontmatter } from "./blog-schema";

/** Name of the feed: the channel title and the title of `<link rel="alternate">`. */
export const FEED_TITLE = "ikili.pro";

/** Site-relative path of the feed. */
export const FEED_PATH = "/rss.xml";

/** Put in front of the title of a sponsored post where it is listed away from its page. */
const PR_LABEL = "【PR】";

/** A blog post as `getCollection("blog")` returns it, reduced to what the feed reads. */
export interface RssSourcePost {
  data: BlogFrontmatter;
  rendered?: { html: string };
}

/**
 * Title of a post where it is listed away from its page: its feed item and its line in the text
 * version of the site. A post with `sponsor` gets `【PR】` in front of its title, so readers see
 * that it is sponsored before they open it.
 */
export function rssItemTitle(
  data: Pick<BlogFrontmatter, "title" | "sponsor">,
): string {
  return data.sponsor ? `${PR_LABEL}${data.title}` : data.title;
}

/**
 * Feed items for the posts, newest first.
 *
 * `link` is the site-relative URL of the post page, which `@astrojs/rss` resolves against
 * `site`. `content` is the post's full HTML from the site's Markdown pipeline
 * (`rendered.html`); a post without `rendered` has no `content`.
 */
export function toRssItems(posts: readonly RssSourcePost[]): RSSFeedItem[] {
  return [...posts]
    .sort((a, b) => b.data.date.getTime() - a.data.date.getTime())
    .map(({ data, rendered }) => ({
      title: rssItemTitle(data),
      link: `/blog/${data.slug}/`,
      pubDate: data.date,
      description: data.description,
      content: rendered?.html,
    }));
}
