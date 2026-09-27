import { ansiArt } from "virtual:lina-ansi-art";
import type { APIRoute } from "astro";

/**
 * `/ansi/color.txt`: the standing illustration as half blocks with 24-bit color escape
 * sequences, at most 80 columns wide. Prerendered like the pages, so `astro build` writes it to
 * `dist/client/` and Workers Static Assets serves it as `text/plain` without starting the Worker.
 */
export const GET: APIRoute = () => new Response(ansiArt);
