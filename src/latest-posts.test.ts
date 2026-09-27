import { describe, expect, it } from "vitest";
import {
  type BlogTag,
  newestPosts,
  postsNewestFirst,
  postsWithTag,
  tagChipTone,
  tagPath,
  tagSlug,
} from "./latest-posts";

const post = (slug: string, date: string) => ({
  slug,
  data: { date: new Date(date) },
});

const posts = [
  post("b", "2026-09-02"),
  post("d", "2026-09-04"),
  post("a", "2026-09-01"),
  post("c", "2026-09-03"),
];

describe("newestPosts", () => {
  it("記事を data.date の新しい順に並べる", () => {
    expect(newestPosts(posts, 4).map((p) => p.slug)).toEqual([
      "d",
      "c",
      "b",
      "a",
    ]);
  });

  it("新しい方から limit 件だけを返す", () => {
    expect(newestPosts(posts, 2).map((p) => p.slug)).toEqual(["d", "c"]);
  });

  it("記事が limit より少ないときはすべてを返す", () => {
    expect(newestPosts(posts, 10).map((p) => p.slug)).toEqual([
      "d",
      "c",
      "b",
      "a",
    ]);
  });

  it("空の配列には空の配列を返す", () => {
    expect(newestPosts([], 3)).toEqual([]);
  });

  it("入力の配列を変えない", () => {
    const input = [...posts];
    newestPosts(input, 2);
    expect(input).toEqual(posts);
  });
});

describe("tagChipTone", () => {
  it("制作記は orange にする", () => {
    expect(tagChipTone("制作記")).toBe("orange");
  });

  it("技術は neutral にする", () => {
    expect(tagChipTone("技術")).toBe("neutral");
  });

  it("日記は neutral にする", () => {
    expect(tagChipTone("日記")).toBe("neutral");
  });
});

describe("postsNewestFirst", () => {
  it("全記事を data.date の新しい順に並べる", () => {
    expect(postsNewestFirst(posts).map((p) => p.slug)).toEqual([
      "d",
      "c",
      "b",
      "a",
    ]);
  });

  it("同じ日付の記事は入力の順を保つ", () => {
    const sameDay = [post("x", "2026-09-01"), post("y", "2026-09-01")];
    expect(postsNewestFirst(sameDay).map((p) => p.slug)).toEqual(["x", "y"]);
  });

  it("入力の配列を変えない", () => {
    const input = [...posts];
    postsNewestFirst(input);
    expect(input).toEqual(posts);
  });
});

describe("postsWithTag", () => {
  const tagged = (slug: string, date: string, tags: BlogTag[]) => ({
    slug,
    data: { date: new Date(date), tags },
  });
  const taggedPosts = [
    tagged("tech-old", "2026-09-01", ["技術"]),
    tagged("diary", "2026-09-02", ["日記"]),
    tagged("tech-new", "2026-09-04", ["技術", "制作記"]),
    tagged("devlog", "2026-09-03", ["制作記"]),
  ];

  it("タグを持つ記事だけを data.date の新しい順に返す", () => {
    expect(postsWithTag(taggedPosts, "技術").map((p) => p.slug)).toEqual([
      "tech-new",
      "tech-old",
    ]);
  });

  it("複数のタグを持つ記事は、そのどのタグの一覧にも入る", () => {
    expect(postsWithTag(taggedPosts, "制作記").map((p) => p.slug)).toEqual([
      "tech-new",
      "devlog",
    ]);
  });

  it("タグを持つ記事が無いときは空の配列を返す", () => {
    expect(postsWithTag(taggedPosts.slice(0, 1), "日記")).toEqual([]);
  });

  it("入力の配列を変えない", () => {
    const input = [...taggedPosts];
    postsWithTag(input, "技術");
    expect(input).toEqual(taggedPosts);
  });
});

describe("tagSlug と tagPath", () => {
  it.each([
    ["制作記", "devlog", "/blog/tags/devlog/"],
    ["技術", "tech", "/blog/tags/tech/"],
    ["日記", "diary", "/blog/tags/diary/"],
  ] as const)(
    "%s のスラッグは %s、一覧のパスは %s にする",
    (tag, slug, path) => {
      expect(tagSlug(tag)).toBe(slug);
      expect(tagPath(tag)).toBe(path);
    },
  );
});
