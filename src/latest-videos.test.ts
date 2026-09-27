import { describe, expect, it } from "vitest";
import { formatVideoDate, latestVideos } from "./latest-videos";
import type { YouTubeVideo } from "./youtube-feed";

const video = (id: string): YouTubeVideo => ({
  id,
  title: `title ${id}`,
  publishedAt: new Date("2026-09-01T00:00:00Z"),
  url: `https://www.youtube.com/watch?v=${id}`,
  thumbnail: {
    src: `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    srcset: `https://i.ytimg.com/vi/${id}/mqdefault.jpg 320w, https://i.ytimg.com/vi/${id}/hqdefault.jpg 480w`,
  },
});

describe("latestVideos", () => {
  it("先頭の動画をカードに、続く 2 件を一覧にする", () => {
    const result = latestVideos({
      ok: true,
      videos: [video("a"), video("b"), video("c")],
    });
    expect(result.feature?.id).toBe("a");
    expect(result.list.map((v) => v.id)).toEqual(["b", "c"]);
  });

  it("一覧は 2 件までにする", () => {
    const result = latestVideos({
      ok: true,
      videos: [video("a"), video("b"), video("c"), video("d")],
    });
    expect(result.list.map((v) => v.id)).toEqual(["b", "c"]);
  });

  it("取得に失敗した結果ならカードも一覧も空にする", () => {
    expect(latestVideos({ ok: false, reason: "unavailable" })).toEqual({
      feature: undefined,
      list: [],
    });
  });
});

describe("formatVideoDate", () => {
  it("日本時間の日付を YYYY.MM.DD で返す", () => {
    expect(formatVideoDate(new Date("2026-09-27T15:30:00Z"))).toBe(
      "2026.09.28",
    );
  });

  it("1 桁の月と日を 0 で埋める", () => {
    expect(formatVideoDate(new Date("2026-01-04T00:00:00+09:00"))).toBe(
      "2026.01.04",
    );
  });
});
