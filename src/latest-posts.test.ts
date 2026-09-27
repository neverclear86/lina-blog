import { describe, expect, it } from "vitest";
import { newestPosts, tagChipTone } from "./latest-posts";

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
