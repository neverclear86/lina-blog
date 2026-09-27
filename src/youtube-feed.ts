/**
 * Reads the channel's YouTube RSS feed at build time and turns it into a list of videos for the
 * top page. Every failure is returned as a value, so a feed that cannot be read never stops the
 * build.
 */
import { XMLParser, XMLValidator } from "fast-xml-parser";

/** RSS feed of the channel, which lists its newest uploads. */
const FEED_URL =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCxkOLgdNumvVIQqn5ps_bJA";

/**
 * How long {@link fetchLatestVideos} waits for the feed and the thumbnail checks together
 * before it gives up.
 */
const FEED_TIMEOUT_MS = 10_000;

/** Shape of a YouTube video ID, which is put into URLs as is. */
const VIDEO_ID = /^[A-Za-z0-9_-]{11}$/;

/**
 * Thumbnail of a video on i.ytimg.com, for an `<img>`. `srcset` lists `mqdefault` (320 × 180)
 * as `320w` and `hqdefault` (480 × 360, 4:3 with black bars) as `480w`, and `src` is the
 * `hqdefault` one. Both are WebP from `vi_webp/`, or JPEG from `vi/` when the WebP could not be
 * confirmed. `maxresdefault` is never used.
 */
export interface VideoThumbnail {
  src: string;
  srcset: string;
}

/** A video, a finished stream or a Short from the channel's feed. */
export interface YouTubeVideo {
  /** The 11-character video ID. */
  id: string;
  /** The title as written on YouTube, with XML entities decoded. */
  title: string;
  /** When the video was published. */
  publishedAt: Date;
  /** The watch page, `https://www.youtube.com/watch?v=<id>`, also for Shorts. */
  url: string;
  /** Thumbnail URLs; see {@link VideoThumbnail}. */
  thumbnail: VideoThumbnail;
}

/**
 * Result of {@link fetchLatestVideos}. Every failure has `ok: false`, and `reason` tells the
 * failures apart:
 * - `unavailable`: the feed could not be reached, answered with a non-2xx status, or did not
 *   answer within the time limit.
 * - `invalid-feed`: the body is not well-formed XML, is rejected by the parser, or has no
 *   `<feed>` element.
 */
export type YouTubeFeedResult =
  | { ok: true; videos: YouTubeVideo[] }
  | { ok: false; reason: "unavailable" | "invalid-feed" };

/**
 * Builds the thumbnail URLs of a video: WebP from `vi_webp/` or JPEG from `vi/` on i.ytimg.com.
 */
function thumbnailOf(id: string, format: "webp" | "jpeg"): VideoThumbnail {
  const base =
    format === "webp"
      ? `https://i.ytimg.com/vi_webp/${id}/`
      : `https://i.ytimg.com/vi/${id}/`;
  const ext = format === "webp" ? "webp" : "jpg";
  const mq = `${base}mqdefault.${ext}`;
  const hq = `${base}hqdefault.${ext}`;
  return { src: hq, srcset: `${mq} 320w, ${hq} 480w` };
}

/**
 * Reads `key` of a node parsed by fast-xml-parser, or `undefined` when `node` is not an object.
 */
function child(node: unknown, key: string): unknown {
  if (typeof node !== "object" || node === null) {
    return undefined;
  }
  return (node as Record<string, unknown>)[key];
}

/**
 * Turns the text of a channel's RSS feed into its videos, newest first.
 *
 * An entry whose `media:statistics` has `views="0"` is left out, because that is how the feed
 * shows an upcoming stream. Any other entry with no views yet, such as a video published
 * minutes before the build, is left out too. An entry without `media:statistics` is kept.
 * Entries without a valid video ID, a non-empty title or a readable `published` date are
 * skipped.
 *
 * @param xml The body of the feed.
 * @returns The videos with WebP thumbnails, sorted by `publishedAt` from newest to oldest, or
 *   `null` when `xml` is not well-formed, is rejected by the parser (such as a DOCTYPE with an
 *   external entity or a reserved element name), or has no `<feed>` element. A feed without
 *   entries gives an empty array.
 */
export function parseYouTubeFeed(xml: string): YouTubeVideo[] | null {
  if (XMLValidator.validate(xml) !== true) {
    return null;
  }
  // Keeps text and attributes as strings (a title such as "2026", `views="0"`) and reads
  // `entry` as an array even when the feed has only one.
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: "@",
    parseTagValue: false,
    parseAttributeValue: false,
    isArray: (_name, jpath) => jpath === "feed.entry",
  });
  // The parser throws on some input that the validator accepts, such as a second DOCTYPE.
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch {
    return null;
  }
  const feed = child(doc, "feed");
  if (feed === undefined) {
    return null;
  }

  const videos: YouTubeVideo[] = [];
  const entries = child(feed, "entry");
  for (const e of Array.isArray(entries) ? entries : []) {
    const id = child(e, "yt:videoId");
    const title = child(e, "title");
    const published = child(e, "published");
    if (typeof id !== "string" || !VIDEO_ID.test(id)) continue;
    if (typeof title !== "string" || title === "") continue;
    if (typeof published !== "string") continue;
    const publishedAt = new Date(published);
    if (Number.isNaN(publishedAt.getTime())) continue;
    const stats = child(
      child(child(e, "media:group"), "media:community"),
      "media:statistics",
    );
    if (child(stats, "@views") === "0") continue;
    videos.push({
      id,
      title,
      publishedAt,
      url: `https://www.youtube.com/watch?v=${id}`,
      thumbnail: thumbnailOf(id, "webp"),
    });
  }
  return videos.sort(
    (a, b) => b.publishedAt.getTime() - a.publishedAt.getTime(),
  );
}

/**
 * Fetches the channel's RSS feed and returns its newest videos.
 *
 * For each returned video it sends a `HEAD` request for the WebP `hqdefault` thumbnail and,
 * when that fails or answers with a non-2xx status, switches the thumbnail to JPEG. The feed
 * and these checks share one time limit of 10 seconds; a check cut off by it also switches to
 * JPEG.
 *
 * @param options.limit How many videos to return at most, zero or more, counted after upcoming
 *   streams are left out. Only these get a thumbnail check.
 * @param fetchImpl The `fetch` to call. It is called as a plain function, never as a method,
 *   because workerd rejects `fetch` called with another `this`. Tests pass a stub so that they
 *   never reach the network.
 * @returns `{ ok: true, videos }` with up to `limit` videos, newest first (empty when the feed
 *   has none), or one of the failures described in {@link YouTubeFeedResult}. It never throws.
 */
export async function fetchLatestVideos(
  { limit }: { limit: number },
  fetchImpl: typeof fetch = fetch,
): Promise<YouTubeFeedResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
  const { signal } = controller;
  try {
    let xml: string;
    try {
      const res = await fetchImpl(FEED_URL, { signal });
      if (!res.ok) {
        return { ok: false, reason: "unavailable" };
      }
      xml = await res.text();
    } catch {
      return { ok: false, reason: "unavailable" };
    }

    const parsed = parseYouTubeFeed(xml);
    if (parsed === null) {
      return { ok: false, reason: "invalid-feed" };
    }

    const videos = await Promise.all(
      parsed.slice(0, limit).map(async (video) => {
        try {
          const res = await fetchImpl(video.thumbnail.src, {
            method: "HEAD",
            signal,
          });
          if (res.ok) {
            return video;
          }
        } catch {
          // Falls back to JPEG below, as for a missing WebP.
        }
        return { ...video, thumbnail: thumbnailOf(video.id, "jpeg") };
      }),
    );
    return { ok: true, videos };
  } finally {
    clearTimeout(timer);
  }
}
