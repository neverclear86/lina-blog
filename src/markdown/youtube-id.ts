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
export function youtubeVideoId(href: string): string | undefined {
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
