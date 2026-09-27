/**
 * What `astro build` tells crawlers: the filter and the `x-default` link of the sitemap that
 * `@astrojs/sitemap` writes (`astro.config.mjs`), and the `/robots.txt` text that points to it.
 *
 * `src/pages/robots.txt.ts` imports this module when the page is prerendered, so it must not
 * import `src/dev/dev-pages.ts`, whose top level resolves a file URL that fails there.
 */
import type { SitemapItem } from "@astrojs/sitemap";

/** Path of the sitemap index that `@astrojs/sitemap` writes with its default file name. */
const SITEMAP_INDEX_PATH = "/sitemap-index.xml";

/**
 * Returns whether the sitemap lists `url`, an absolute URL of a built page. It keeps paths
 * that end with `/` and leaves out the dev pages under `/dev/` (`src/dev/dev-pages.ts`) and
 * text responses such as `/llms.txt` and `/rss.xml`, whose paths end with a file name.
 */
export function isSitemapPage(url: string): boolean {
  const { pathname } = new URL(url);
  return pathname.endsWith("/") && !pathname.startsWith("/dev/");
}

/**
 * Adds `/` as the `x-default` alternate to an entry that links the same page in other
 * locales. `/` picks the locale for the visitor (`src/api.ts`). An entry without `links`,
 * a page in one locale only, is returned as is.
 */
export function withXDefault(item: SitemapItem): SitemapItem {
  if (item.links === undefined) return item;
  return {
    ...item,
    links: [
      ...item.links,
      { lang: "x-default", url: new URL("/", item.url).href },
    ],
  };
}

/**
 * Returns the `/robots.txt` text: one group that allows every crawler, AI crawlers such as
 * GPTBot and ClaudeBot included, and the absolute URL of the sitemap index under `site`,
 * ending with one newline.
 *
 * @param site Astro's `site`, the origin of the sitemap URL.
 * @throws When `site` is undefined, because `astro.config.mjs` does not set it.
 */
export function buildRobotsTxt(site: URL | undefined): string {
  if (site === undefined) {
    throw new Error(
      "robots.txt needs `site` in astro.config.mjs for the sitemap URL",
    );
  }
  return `User-agent: *\nAllow: /\n\nSitemap: ${new URL(SITEMAP_INDEX_PATH, site).href}\n`;
}
