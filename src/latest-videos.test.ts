import { describe, expect, it } from "vitest";
import { latestVideos } from "./latest-videos";
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
  it("先頭の動画をカードに、続く 3 件を一覧にする", () => {
    const result = latestVideos({
      ok: true,
      videos: [video("a"), video("b"), video("c"), video("d")],
    });
    expect(result.feature?.id).toBe("a");
    expect(result.list.map((v) => v.id)).toEqual(["b", "c", "d"]);
  });

  it("一覧は 3 件までにする", () => {
    const result = latestVideos({
      ok: true,
      videos: [video("a"), video("b"), video("c"), video("d"), video("e")],
    });
    expect(result.list.map((v) => v.id)).toEqual(["b", "c", "d"]);
  });

  it("取得に失敗した結果ならカードも一覧も空にする", () => {
    expect(latestVideos({ ok: false, reason: "unavailable" })).toEqual({
      feature: undefined,
      list: [],
    });
  });
});
