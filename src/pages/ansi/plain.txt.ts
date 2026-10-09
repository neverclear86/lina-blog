import { plainArt } from "virtual:lina-ansi-art";
import type { APIRoute } from "astro";

/**
 * `/ansi/plain.txt`: the silhouette of the avatar `main-visual` without escape sequences, for
 * output that does not read color. Prerendered to `dist/client/` like `/ansi/color.txt`.
 */
export const GET: APIRoute = () => new Response(plainArt);
