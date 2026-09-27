import { defineHastPlugin } from "satteri";

/** A YouTube video ID: 11 characters from the URL-safe Base64 alphabet. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/** Hosts whose `https://<host>/watch?v=<ID>` URLs link to a video. */
const WATCH_HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
]);

/**
 * Returns the video ID of a YouTube video URL, or `undefined` for any other string.
 *
 * The accepted forms are `https://youtu.be/<ID>` and `https://<host>/watch?v=<ID>` for the hosts
 * in `WATCH_HOSTS`. Other query parameters (`t`, `si`, `list`, ...) are ignored. Other schemes,
 * hosts and paths, strings that are not URLs, and IDs that do not match `VIDEO_ID` give
 * `undefined`.
 */
function youtubeVideoId(href: string): string | undefined {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return undefined;
  }
  if (url.protocol !== "https:") return undefined;
  const { hostname, pathname, searchParams } = url;
  let candidate: string | null = null;
  if (hostname === "youtu.be") {
    candidate = pathname.slice(1);
  } else if (WATCH_HOSTS.has(hostname) && pathname === "/watch") {
    candidate = searchParams.get("v");
  }
  return candidate !== null && VIDEO_ID.test(candidate) ? candidate : undefined;
}

/**
 * Hast plugin that turns a paragraph holding only a YouTube video URL into an embedded player.
 *
 * The paragraph must contain one link whose text is its own URL, as a bare URL or `<URL>`
 * produces, and `youtubeVideoId` must accept the URL. The player is an `iframe` of
 * `www.youtube-nocookie.com` with `loading="lazy"`, so the page gets no script and the player
 * loads only when it nears the viewport. Any other paragraph is left unchanged.
 */
export const youtubeEmbed = defineHastPlugin({
  name: "youtube-embed",
  element: {
    filter: ["p"],
    visit(node, ctx) {
      const [link, ...rest] = node.children;
      if (rest.length > 0 || link?.type !== "element") return;
      const href = link.properties?.href;
      const [text, ...more] = link.children;
      if (
        typeof href !== "string" ||
        more.length > 0 ||
        text?.type !== "text" ||
        text.value !== href
      ) {
        return;
      }
      const id = youtubeVideoId(href);
      if (id === undefined) return;
      ctx.replaceNode(node, {
        type: "element",
        tagName: "iframe",
        properties: {
          className: ["youtube-embed"],
          src: `https://www.youtube-nocookie.com/embed/${id}`,
          title: "YouTube の動画",
          width: 560,
          height: 315,
          loading: "lazy",
          allow:
            "clipboard-write; encrypted-media; picture-in-picture; web-share",
          allowFullScreen: true,
        },
        children: [],
      });
    },
  },
});
