import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchLatestVideos, parseYouTubeFeed } from "./youtube-feed";

const FEED =
  "https://www.youtube.com/feeds/videos.xml?channel_id=UCxkOLgdNumvVIQqn5ps_bJA";

/** Returns one `<entry>` nested as in the channel's real feed. */
const entry = ({
  id = "AAAAAAAAAAA",
  title = "動画の題",
  published = "2026-09-01T12:00:00+00:00",
  views = "84",
  path = `watch?v=${id}`,
  statistics = true,
}: {
  id?: string;
  title?: string;
  published?: string;
  views?: string;
  path?: string;
  statistics?: boolean;
} = {}) => `
  <entry>
    <id>yt:video:${id}</id>
    <yt:videoId>${id}</yt:videoId>
    <yt:channelId>UCxkOLgdNumvVIQqn5ps_bJA</yt:channelId>
    <title>${title}</title>
    <link rel="alternate" href="https://www.youtube.com/${path}"/>
    <author>
      <name>創好リナ</name>
      <uri>https://www.youtube.com/channel/UCxkOLgdNumvVIQqn5ps_bJA</uri>
    </author>
    <published>${published}</published>
    <updated>${published}</updated>
    <media:group>
      <media:title>${title}</media:title>
      <media:content url="https://www.youtube.com/v/${id}?version=3" type="application/x-shockwave-flash" width="640" height="390"/>
      <media:thumbnail url="https://i4.ytimg.com/vi/${id}/hqdefault.jpg" width="480" height="360"/>
      <media:description>説明</media:description>
      <media:community>
        <media:starRating count="3" average="5.00" min="1" max="5"/>
        ${statistics ? `<media:statistics views="${views}"/>` : ""}
      </media:community>
    </media:group>
  </entry>`;

/** Wraps entries in a `<feed>` with the three namespaces of the real feed. */
const feed = (...entries: string[]) =>
  `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <link rel="self" href="${FEED}"/>
  <id>yt:channel:xkOLgdNumvVIQqn5ps_bJA</id>
  <title>創好リナ</title>
  ${entries.join("")}
</feed>`;

const ids = (videos: { id: string }[] | null) =>
  videos?.map((video) => video.id);

describe("parseYouTubeFeed", () => {
  it("entry を ID・タイトル・公開日時・URL・WebP のサムネイルに変える", () => {
    expect(
      parseYouTubeFeed(feed(entry({ id: "abcDEF_12-3", title: "A &amp; B" }))),
    ).toEqual([
      {
        id: "abcDEF_12-3",
        title: "A & B",
        publishedAt: new Date("2026-09-01T12:00:00Z"),
        url: "https://www.youtube.com/watch?v=abcDEF_12-3",
        thumbnail: {
          src: "https://i.ytimg.com/vi_webp/abcDEF_12-3/hqdefault.webp",
          srcset:
            "https://i.ytimg.com/vi_webp/abcDEF_12-3/mqdefault.webp 320w, https://i.ytimg.com/vi_webp/abcDEF_12-3/hqdefault.webp 480w",
        },
      },
    ]);
  });

  it("視聴回数が 0 の entry（配信予定）を除く", () => {
    const videos = parseYouTubeFeed(
      feed(
        entry({ id: "upcoming000", views: "0" }),
        entry({ id: "watched0001", views: "1" }),
      ),
    );
    expect(ids(videos)).toEqual(["watched0001"]);
  });

  it("ショートも載せ、URL は watch の形にする", () => {
    const videos = parseYouTubeFeed(
      feed(entry({ id: "short000001", path: "shorts/short000001" })),
    );
    expect(videos?.[0]?.url).toBe(
      "https://www.youtube.com/watch?v=short000001",
    );
  });

  it("公開日時の新しい順に並べる", () => {
    const videos = parseYouTubeFeed(
      feed(
        entry({ id: "middle00001", published: "2026-09-02T00:00:00+00:00" }),
        entry({ id: "oldest00001", published: "2026-09-01T00:00:00+00:00" }),
        entry({ id: "newest00001", published: "2026-09-03T00:00:00+00:00" }),
      ),
    );
    expect(ids(videos)).toEqual(["newest00001", "middle00001", "oldest00001"]);
  });

  it("entry が 1 件でも配列で返す", () => {
    expect(ids(parseYouTubeFeed(feed(entry())))).toEqual(["AAAAAAAAAAA"]);
  });

  it("entry が無い feed は空の配列を返す", () => {
    expect(parseYouTubeFeed(feed())).toEqual([]);
  });

  it("属性も子も無い feed は空の配列を返す", () => {
    expect(parseYouTubeFeed("<feed></feed>")).toEqual([]);
  });

  it("media:statistics の無い entry は載せる", () => {
    expect(ids(parseYouTubeFeed(feed(entry({ statistics: false }))))).toEqual([
      "AAAAAAAAAAA",
    ]);
  });

  it("ID・タイトル・公開日時が読めない entry を飛ばす", () => {
    const videos = parseYouTubeFeed(
      feed(
        entry({ id: "too-short" }),
        entry({ id: "emptyTitle1", title: "" }),
        entry({ id: "badDate0001", published: "not a date" }),
        entry({ id: "valid000001" }),
      ),
    );
    expect(ids(videos)).toEqual(["valid000001"]);
  });

  it("数字だけのタイトルも文字列で返す", () => {
    expect(parseYouTubeFeed(feed(entry({ title: "2026" })))?.[0]?.title).toBe(
      "2026",
    );
  });

  it("整形式でない XML は null を返す", () => {
    expect(parseYouTubeFeed("<feed><entry></feed>")).toBeNull();
  });

  it("検証は通るが parser が拒否する XML は null を返す", () => {
    expect(
      parseYouTubeFeed("<!DOCTYPE feed><!DOCTYPE feed><feed/>"),
    ).toBeNull();
    expect(
      parseYouTubeFeed("<feed><constructor>a</constructor></feed>"),
    ).toBeNull();
  });

  it("feed の要素が無い XML は null を返す", () => {
    expect(parseYouTubeFeed("<html></html>")).toBeNull();
  });
});

describe("fetchLatestVideos", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  /** Returns a `fetch` stub that answers the feed with `body` and a `HEAD` with `status`. */
  const stubFetch = (body: string, status = 200) =>
    vi.fn<typeof fetch>(async (input) =>
      String(input).includes("feeds")
        ? new Response(body)
        : new Response(null, { status }),
    );

  it("チャンネルの RSS を取得し、新しい順に limit 件を返す", async () => {
    const fetchImpl = stubFetch(
      feed(
        entry({ id: "oldest00001", published: "2026-09-01T00:00:00+00:00" }),
        entry({ id: "newest00001", published: "2026-09-03T00:00:00+00:00" }),
      ),
    );
    const result = await fetchLatestVideos({ limit: 1 }, fetchImpl);
    expect(result.ok && ids(result.videos)).toEqual(["newest00001"]);
    expect(fetchImpl.mock.calls[0]?.[0]).toBe(FEED);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("WebP のサムネイルが無いと JPEG に戻す", async () => {
    const fetchImpl = stubFetch(feed(entry({ id: "noWebp00001" })), 404);
    const result = await fetchLatestVideos({ limit: 3 }, fetchImpl);
    expect(fetchImpl.mock.calls[1]?.[1]?.method).toBe("HEAD");
    expect(result.ok && result.videos[0]?.thumbnail).toEqual({
      src: "https://i.ytimg.com/vi/noWebp00001/hqdefault.jpg",
      srcset:
        "https://i.ytimg.com/vi/noWebp00001/mqdefault.jpg 320w, https://i.ytimg.com/vi/noWebp00001/hqdefault.jpg 480w",
    });
  });

  it("WebP の確認が失敗しても JPEG に戻す", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async (input) => {
      if (String(input).includes("feeds")) {
        return new Response(feed(entry({ id: "noWebp00001" })));
      }
      throw new TypeError("fetch failed");
    });
    const result = await fetchLatestVideos({ limit: 3 }, fetchImpl);
    expect(result.ok && result.videos[0]?.thumbnail.src).toBe(
      "https://i.ytimg.com/vi/noWebp00001/hqdefault.jpg",
    );
  });

  it("ネットワークの失敗は unavailable を返す", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await fetchLatestVideos({ limit: 3 }, fetchImpl)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("2xx でない応答は unavailable を返す", async () => {
    const fetchImpl = vi.fn<typeof fetch>(
      async () => new Response(feed(entry()), { status: 500 }),
    );
    expect(await fetchLatestVideos({ limit: 3 }, fetchImpl)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("解析できない本文は invalid-feed を返す", async () => {
    expect(await fetchLatestVideos({ limit: 3 }, stubFetch("<feed>"))).toEqual({
      ok: false,
      reason: "invalid-feed",
    });
  });

  it("parser が拒否する本文も例外を投げず invalid-feed を返す", async () => {
    expect(
      await fetchLatestVideos(
        { limit: 3 },
        stubFetch("<!DOCTYPE feed><!DOCTYPE feed><feed/>"),
      ),
    ).toEqual({ ok: false, reason: "invalid-feed" });
  });

  it("本文の読み出しが失敗しても unavailable を返す", async () => {
    const fetchImpl = vi.fn<typeof fetch>(async () => {
      const res = new Response(feed(entry()));
      vi.spyOn(res, "text").mockRejectedValue(new TypeError("terminated"));
      return res;
    });
    expect(await fetchLatestVideos({ limit: 3 }, fetchImpl)).toEqual({
      ok: false,
      reason: "unavailable",
    });
  });

  it("時限までに WebP の確認が終わらなければ JPEG に戻す", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(async (input, init) => {
      if (String(input).includes("feeds")) {
        return new Response(feed(entry({ id: "slowWebp001" })));
      }
      return new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    });
    const pending = fetchLatestVideos({ limit: 3 }, fetchImpl);
    await vi.advanceTimersByTimeAsync(10_000);
    const result = await pending;
    expect(result.ok && result.videos[0]?.thumbnail.src).toBe(
      "https://i.ytimg.com/vi/slowWebp001/hqdefault.jpg",
    );
  });

  it("10 秒で応答が無ければ打ち切って unavailable を返す", async () => {
    vi.useFakeTimers();
    const fetchImpl = vi.fn<typeof fetch>(
      (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () =>
            reject(new DOMException("aborted", "AbortError")),
          );
        }),
    );
    let settled = false;
    const pending = fetchLatestVideos({ limit: 3 }, fetchImpl).then(
      (result) => {
        settled = true;
        return result;
      },
    );
    await vi.advanceTimersByTimeAsync(9_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    expect(settled).toBe(true);
    expect(await pending).toEqual({ ok: false, reason: "unavailable" });
  });
});
