import { getCollection } from "astro:content";
import rss from "@astrojs/rss";
import type { APIContext } from "astro";
import { FEED_PATH, FEED_TITLE, toRssItems } from "../blog-rss";

/**
 * `/rss.xml`: RSS 2.0 feed of every blog post, newest first, with each post's full HTML in
 * `content:encoded`. The page is prerendered, so Workers Static Assets serves the file.
 *
 * If this throws during `astro build`, Astro logs the error and writes an empty `rss.xml`
 * without failing the build.
 */
export async function GET(context: APIContext) {
  if (!context.site) {
    throw new Error(
      "`site` in astro.config.mjs is required to build /rss.xml.",
    );
  }
  const items = toRssItems(await getCollection("blog"));
  const selfUrl = new URL(FEED_PATH, context.site);
  return rss({
    title: FEED_TITLE,
    description: "創好リナのブログ",
    site: context.site,
    xmlns: { atom: "http://www.w3.org/2005/Atom" },
    customData: `<language>ja</language><atom:link href="${selfUrl}" rel="self" type="application/rss+xml"/>`,
    items,
  });
}
