import { describe, expect, it } from "vitest";
import { type RssSourcePost, rssItemTitle, toRssItems } from "./blog-rss";
import type { BlogFrontmatter } from "./blog-schema";

const data = (patch: Partial<BlogFrontmatter> = {}): BlogFrontmatter => ({
  title: "記事の題",
  slug: "hello-world-0001",
  date: new Date("2026-09-01"),
  tags: ["技術"],
  emoji: "📝",
  description: "記事の説明",
  ...patch,
});

const sponsor = { name: "ACME", url: "https://example.com/" };

describe("rssItemTitle", () => {
  it("sponsor がある記事はタイトルの先頭に【PR】を付ける", () => {
    expect(rssItemTitle(data({ sponsor }))).toBe("【PR】記事の題");
  });

  it("sponsor が無い記事はタイトルをそのまま返す", () => {
    expect(rssItemTitle(data())).toBe("記事の題");
  });
});

describe("toRssItems", () => {
  it("記事を日付の新しい順に並べる", () => {
    const posts: RssSourcePost[] = [
      { data: data({ slug: "older-post-0001", date: new Date("2026-09-01") }) },
      { data: data({ slug: "newer-post-0002", date: new Date("2026-09-10") }) },
    ];
    expect(toRssItems(posts).map((item) => item.link)).toEqual([
      "/blog/newer-post-0002/",
      "/blog/older-post-0001/",
    ]);
  });

  it("渡した配列の並びを変えない", () => {
    const posts: RssSourcePost[] = [
      { data: data({ slug: "older-post-0001", date: new Date("2026-09-01") }) },
      { data: data({ slug: "newer-post-0002", date: new Date("2026-09-10") }) },
    ];
    toRssItems(posts);
    expect(posts.map((post) => post.data.slug)).toEqual([
      "older-post-0001",
      "newer-post-0002",
    ]);
  });

  it("項目に記事ページのリンク、日付、説明、本文の HTML を入れる", () => {
    const [item] = toRssItems([
      { data: data(), rendered: { html: "<p>本文</p>" } },
    ]);
    expect(item).toEqual({
      title: "記事の題",
      link: "/blog/hello-world-0001/",
      pubDate: new Date("2026-09-01"),
      description: "記事の説明",
      content: "<p>本文</p>",
    });
  });

  it("sponsor がある記事の項目のタイトルに【PR】が付く", () => {
    const [item] = toRssItems([{ data: data({ sponsor }) }]);
    expect(item.title).toBe("【PR】記事の題");
  });

  it("rendered が無い記事の項目は content を持たない", () => {
    const [item] = toRssItems([{ data: data() }]);
    expect(item.content).toBeUndefined();
  });
});
