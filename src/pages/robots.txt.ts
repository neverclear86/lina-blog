import type { APIRoute } from "astro";
import { buildRobotsTxt } from "../sitemap";

/**
 * `/robots.txt`. Prerendered like the pages, so `astro build` writes it to `dist/client/` and
 * Workers Static Assets serves it as `text/plain` without starting the Worker.
 */
export const GET: APIRoute = ({ site }) => new Response(buildRobotsTxt(site));
