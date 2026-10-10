// @ts-check
import { existsSync, readFileSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import cloudflare from "@astrojs/cloudflare";
import { satteri } from "@astrojs/markdown-satteri";
import sitemap from "@astrojs/sitemap";
import { defineConfig, envField, fontProviders } from "astro/config";
import { renderAnsiArt, renderPlainArt } from "./src/ansi-art.ts";
import { decodeAnsiArtSource } from "./src/ansi-art-source.ts";
import { devPages } from "./src/dev/dev-pages.ts";
import { DEFAULT_LOCALE, LOCALES } from "./src/i18n/locales.ts";
import { tableFocusable, taskItemLabel } from "./src/markdown/a11y.ts";
import { codeFilename } from "./src/markdown/code-filename.ts";
import { highlightCodeBlocks } from "./src/markdown/highlight.ts";
import { tableAlignToClass } from "./src/markdown/table-align.ts";
import { youtubeEmbed } from "./src/markdown/youtube.ts";
import { loadOgFonts } from "./src/og-font.ts";
import { renderOgImage } from "./src/og-image.ts";
import { OG_IMAGES_LIST_PATH } from "./src/og-pages.ts";
import { isSitemapPage, withXDefault } from "./src/sitemap.ts";

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
        // Routes whose component is not a file in this project, such as the ones Astro
        // injects, keep their own setting.
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

/** Virtual module with the text art of the Hero's fourth pose, built by `linaAnsiArt()`. */
const ANSI_ART_MODULE = "virtual:lina-ansi-art";

/**
 * Builds the text art of the Hero's fourth pose (`ANSI_ART_SOURCE` in `src/ansi-art-source.ts`)
 * for terminals as the virtual module `virtual:lina-ansi-art`, which exports `ansiArt` (24-bit
 * color) and `plainArt` (no escape sequences).
 *
 * The endpoints in `src/pages/ansi/` are prerendered in workerd, which cannot load sharp, so
 * the illustration is decoded and resized here, in Node, and the endpoints only return the
 * strings. The image is resized to `ANSI_ART_MAX_COLUMNS` pixels wide, so every line of the
 * art fits in 80 columns.
 * @returns {import('vite').Plugin}
 */
function linaAnsiArt() {
  const resolvedId = `\0${ANSI_ART_MODULE}`;
  return {
    name: "lina-ansi-art",
    resolveId(id) {
      if (id === ANSI_ART_MODULE) return resolvedId;
    },
    async load(id) {
      if (id !== resolvedId) return;
      const image = await decodeAnsiArtSource();
      return [
        `export const ansiArt = ${JSON.stringify(renderAnsiArt(image))};`,
        `export const plainArt = ${JSON.stringify(renderPlainArt(image))};`,
      ].join("\n");
    },
  };
}

/**
 * Writes the OGP images to `dist/client/og/` when the build is done.
 *
 * The images are drawn here, in Node, because sharp cannot be loaded in workerd, where the pages
 * are prerendered. `astro:content` cannot be imported in this file, so the endpoint
 * `src/pages/og/images.json.ts`, which is prerendered with the pages, lists the images
 * (`ogImagePages` in `src/og-pages.ts`) in `dist/client/og/images.json`. This hook draws each
 * image of the list with the fonts of `loadOgFonts`, writes it to its path in `dist/client/` and
 * deletes the list, so Workers Static Assets does not serve it. A missing or empty list, or a
 * font that cannot be downloaded, fails the build.
 * @returns {import('astro').AstroIntegration}
 */
function ogImages() {
  return {
    name: "og-images",
    hooks: {
      "astro:build:done": async ({ dir, logger }) => {
        const list = fileURLToPath(new URL(`.${OG_IMAGES_LIST_PATH}`, dir));
        /** @type {import('./src/og-pages.ts').OgImagePage[]} */
        const pages = JSON.parse(await readFile(list, "utf8"));
        const fonts = await loadOgFonts();
        for (const { path, input } of pages) {
          const file = fileURLToPath(new URL(`.${path}`, dir));
          await mkdir(dirname(file), { recursive: true });
          await writeFile(file, await renderOgImage(input, fonts));
        }
        await rm(list);
        logger.info(`Wrote ${pages.length} OGP images.`);
      },
    },
  };
}

// https://astro.build/config
export default defineConfig({
  // Origin of absolute URLs, such as the links in /llms.txt and /rss.xml, the sitemap, the
  // Sitemap line of /robots.txt and the canonical and hreflang links in the `<head>` of every page.
  site: "https://ikili.pro",
  markdown: {
    // Sätteri is Astro's default processor. It is set explicitly to add the plugins in
    // src/markdown/.
    processor: satteri({
      mdastPlugins: [codeFilename],
      hastPlugins: [
        tableAlignToClass,
        taskItemLabel,
        tableFocusable,
        youtubeEmbed,
        highlightCodeBlocks,
      ],
    }),
    // Code blocks are highlighted by highlightCodeBlocks (src/markdown/highlight.ts). Astro's own
    // Shiki would run before it and add inline styles.
    syntaxHighlight: false,
  },
  output: "server",
  adapter: cloudflare({
    // The default `cloudflare-binding` uses Cloudflare Images, which can incur charges.
    imageService: "compile",
  }),
  integrations: [
    prerenderByDefault(),
    devPages(),
    // `@astrojs/sitemap` writes /sitemap-index.xml at build time, linking each page to the same
    // page in the other locales; `src/sitemap.ts` filters the pages and adds `x-default`.
    sitemap({
      filter: isSitemapPage,
      serialize: withXDefault,
      i18n: {
        defaultLocale: DEFAULT_LOCALE,
        locales: Object.fromEntries(LOCALES.map((locale) => [locale, locale])),
      },
    }),
    ogImages(),
  ],
  vite: { plugins: [linaAnsiArt()] },
  // Sessions are not used; this also keeps the adapter from provisioning a KV namespace.
  session: false,
  // Turnstile site key of the contact form, public and read at build time because the page is
  // prerendered; set it in the environment or `.env`. The default is Cloudflare's test site key,
  // whose widget always passes with a dummy token that a production secret key rejects.
  env: {
    schema: {
      TURNSTILE_SITE_KEY: envField.string({
        context: "client",
        access: "public",
        default: "1x00000000000000000000AA",
      }),
    },
  },
  // Every locale, including the default, has a URL prefix (`/ja/`, `/en/`). Pages outside
  // `src/pages/[lang]/`, such as `/blog/`, have none; see the i18n() note in `src/fetch.ts`.
  i18n: {
    locales: [...LOCALES],
    defaultLocale: DEFAULT_LOCALE,
    routing: { prefixDefaultLocale: true },
  },
  // Fonts are downloaded from Google Fonts during `astro build` and served from /_astro/fonts/,
  // so pages never request a font CDN. Google splits Zen Kaku Gothic New's Japanese glyphs into
  // numbered unicode-range chunks without a subset name, which are always kept; `subsets` only
  // drops the named Latin Extended, Greek and Cyrillic chunks. Browsers download only the chunks
  // whose characters a page uses. The design's Zen Kaku Gothic New 500 is not loaded and is
  // written as 400. Google serves JetBrains Mono as one variable file for every weight, so it is
  // loaded as the range 400-800. Its variable is `--font-mono-latin`: `src/layouts/Layout.astro`
  // builds `--font-mono` from it and `--font-body`, because Astro renames each loaded family
  // with a hash and a fallback here cannot name the loaded Zen Kaku Gothic New.
  fonts: [
    {
      provider: fontProviders.google(),
      name: "Zen Kaku Gothic New",
      cssVariable: "--font-body",
      weights: [400, 700, 900],
      styles: ["normal"],
      subsets: ["latin"],
      display: "swap",
      fallbacks: ["Hiragino Sans", "Noto Sans CJK JP", "sans-serif"],
      // The generated size-adjust is measured on Latin glyphs and does not fit full-width ones.
      optimizedFallbacks: false,
    },
    {
      provider: fontProviders.google(),
      name: "JetBrains Mono",
      cssVariable: "--font-mono-latin",
      weights: ["400 800"],
      styles: ["normal"],
      subsets: ["latin"],
      display: "swap",
      fallbacks: ["ui-monospace"],
    },
  ],
});
