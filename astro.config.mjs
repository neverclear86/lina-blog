// @ts-check
import { existsSync, readFileSync } from "node:fs";
import cloudflare from "@astrojs/cloudflare";
import { defineConfig, fontProviders } from "astro/config";
import { DEFAULT_LOCALE, LOCALES } from "./src/i18n/locales.ts";

/** Same pattern Astro uses to read a page's `export const prerender`. */
const PRERENDER_EXPORT = /^\s*export\s+const\s+prerender\s*=\s*(true|false);?/m;

/**
 * Prerenders every page that does not export `prerender` itself.
 *
 * `output: 'server'` makes Astro always build the Worker, which the Hono app in
 * `src/fetch.ts` needs even when every page is static. In that mode Astro defaults
 * pages to on-demand rendering, so this integration restores prerendering as the
 * default. A page opts out with `export const prerender = false`.
 * @returns {import('astro').AstroIntegration}
 */
function prerenderByDefault() {
  /** @type {URL} */
  let root;
  return {
    name: "prerender-by-default",
    hooks: {
      "astro:config:setup": ({ config }) => {
        root = config.root;
      },
      "astro:route:setup": ({ route }) => {
        // Routes whose component is not a file in this project (injected by Astro or
        // integrations) keep their own setting.
        const file = new URL(route.component, root);
        if (!existsSync(file)) return;
        const source = readFileSync(file, "utf8");
        if (!PRERENDER_EXPORT.test(source)) {
          route.prerender = true;
        }
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  // Origin of absolute URLs, such as the links in /llms.txt and /rss.xml.
  site: "https://ikili.pro",
  output: "server",
  adapter: cloudflare({
    // The default `cloudflare-binding` uses Cloudflare Images, which can incur charges.
    imageService: "compile",
  }),
  integrations: [prerenderByDefault()],
  // Sessions are not used; this also keeps the adapter from provisioning a KV namespace.
  session: false,
  // Every locale, including the default, has a URL prefix (`/ja/`, `/en/`). Pages outside
  // `src/pages/[lang]/`, such as `/blog/`, have none; see the i18n() note in `src/fetch.ts`.
  i18n: {
    locales: [...LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    routing: { prefixDefaultLocale: true },
  },
  // Fonts are downloaded from Google Fonts during `astro build` and served from /_astro/fonts/,
  // so pages never request a font CDN. Google splits Zen Maru Gothic's Japanese glyphs into
  // numbered unicode-range chunks without a subset name, which are always kept; `subsets` only
  // drops the named Latin Extended, Greek and Cyrillic chunks. Browsers download only the chunks
  // whose characters a page uses. The design's Zen Maru Gothic 700 is loaded as 900.
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Zen Maru Gothic",
      cssVariable: "--font-body",
      weights: [500, 900],
      styles: ["normal"],
      subsets: ["latin"],
      display: "swap",
      fallbacks: [
        "Hiragino Maru Gothic ProN",
        "Hiragino Sans",
        "Yu Gothic",
        "sans-serif",
      ],
      // The generated size-adjust is measured on Latin glyphs and does not fit full-width ones.
      optimizedFallbacks: false,
    },
    {
      provider: fontProviders.google(),
      name: "Saira Condensed",
      cssVariable: "--font-display",
      weights: [600, 800],
      styles: ["normal"],
      subsets: ["latin"],
      display: "swap",
      fallbacks: ["sans-serif"],
    },
    {
      provider: fontProviders.google(),
      name: "JetBrains Mono",
      cssVariable: "--font-mono",
      weights: [400, 500],
      styles: ["normal"],
      subsets: ["latin"],
      display: "swap",
      fallbacks: ["monospace"],
    },
  ],
});
