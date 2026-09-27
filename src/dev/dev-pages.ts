/**
 * Pages for checking how components and rendered Markdown look, left out of the production build.
 *
 * `devPages()` adds them with `injectRoute` in `astro dev`, and in `astro build` only when the
 * environment variable `LINA_DEV_PAGES` is `1`, so that `.claude/scripts/screenshot.mjs`, which
 * serves `dist/`, can capture them. `astro.config.mjs` registers the integration.
 */
import type { AstroIntegration } from "astro";

const DEV_PAGES_ENV = "LINA_DEV_PAGES";

const DEV_PAGES = [
  {
    pattern: "/dev/components",
    entrypoint: new URL("./components.astro", import.meta.url),
  },
  {
    pattern: "/dev/markdown",
    entrypoint: new URL("./markdown.astro", import.meta.url),
  },
];

/**
 * Returns whether the dev pages are added: always in `astro dev` (`command` is `"dev"`), and in
 * the other commands only when `LINA_DEV_PAGES` in `env` is `"1"`.
 */
export function devPagesEnabled(
  command: string,
  env: Readonly<Record<string, string | undefined>>,
): boolean {
  return command === "dev" || env[DEV_PAGES_ENV] === "1";
}

/**
 * Astro integration that injects the dev pages (`/dev/components/` from
 * `src/dev/components.astro` and `/dev/markdown/` from `src/dev/markdown.astro`) when
 * `devPagesEnabled` allows it. `prerenderByDefault` in `astro.config.mjs` prerenders them like
 * other pages. `env` is `process.env` unless a test passes another one.
 */
export function devPages(
  env: Readonly<Record<string, string | undefined>> = process.env,
): AstroIntegration {
  return {
    name: "dev-pages",
    hooks: {
      "astro:config:setup": ({ command, injectRoute }) => {
        if (!devPagesEnabled(command, env)) return;
        for (const page of DEV_PAGES) {
          injectRoute(page);
        }
      },
    },
  };
}
