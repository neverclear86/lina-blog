/**
 * Prepares the videos from the channel's feed for the Latest section of the home page: which
 * video goes on the large card, which go in the list, and how their dates are written.
 */
import type { YouTubeFeedResult, YouTubeVideo } from "./youtube-feed";

/** How many videos the Latest section shows: one on the large card and the rest in the list. */
export const LATEST_VIDEOS_SHOWN = 3;

/** Formats a date as YYYY-MM-DD in Japan time, where the videos are published. */
const VIDEO_DATE_FORMAT = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** Videos of the Latest section, split by where they are shown. */
export interface LatestVideos {
  /** The newest video, for the large card, or `undefined` when there is none. */
  feature: YouTubeVideo | undefined;
  /** The videos after it, newest first, for the list. */
  list: YouTubeVideo[];
}

/**
 * Splits a result of `fetchLatestVideos` into the video for the large card and the videos for
 * the list. The newest video goes on the card and the next ones, up to
 * `LATEST_VIDEOS_SHOWN - 1`, go in the list. A failed result gives no videos, the same as a feed
 * without videos.
 */
export function latestVideos(result: YouTubeFeedResult): LatestVideos {
  if (!result.ok) {
    return { feature: undefined, list: [] };
  }
  const [feature, ...rest] = result.videos;
  return { feature, list: rest.slice(0, LATEST_VIDEOS_SHOWN - 1) };
}

/** Writes `date` in Japan time as `YYYY.MM.DD`, whatever the time zone of the build. */
export function formatVideoDate(date: Date): string {
  return VIDEO_DATE_FORMAT.format(date).replaceAll("-", ".");
}
