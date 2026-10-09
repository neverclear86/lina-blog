import { getCollection } from "astro:content";
import { ogImagePages } from "../../og-pages";

/**
 * `/og/images.json`: the OGP images to draw (`ogImagePages`) for the top pages and every blog
 * post. `ogImages()` in `astro.config.mjs` reads this file when the build is done, draws the
 * images and deletes it, so it is not in the published `dist/client/`.
 *
 * If this throws during `astro build`, Astro logs the error and writes an empty file without
 * failing the build, and `ogImages()` then fails it because it cannot parse the empty list.
 */
export async function GET() {
  return Response.json(ogImagePages(await getCollection("blog")));
}
