import { getCollection } from "astro:content";
import type { APIRoute, GetStaticPaths } from "astro";
import { LOCALES, type Locale } from "../../i18n/locales";
import { buildTextSite } from "../../text-site";

export const getStaticPaths = (() =>
  LOCALES.map((lang) => ({ params: { lang } }))) satisfies GetStaticPaths;

/**
 * `/text/ja.txt` and `/text/en.txt`, the text version of the site for command-line clients.
 * Prerendered like the pages, so `astro build` writes them to `dist/client/text/`. The locale
 * comes from `params`, because a prerendered endpoint gets no `props` from `getStaticPaths`.
 */
export const GET: APIRoute = async ({ params, site }) =>
  new Response(
    buildTextSite(params.lang as Locale, await getCollection("blog"), site),
  );
