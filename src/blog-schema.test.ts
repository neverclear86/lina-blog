import { describe, expect, it } from "vitest";
import { blogSchema } from "./blog-schema";

const valid = {
  title: "記事の題",
  slug: "hello-world-0001",
  date: "2026-09-01",
  tags: ["技術"],
  emoji: "📝",
  description: "記事の説明",
};

const accepts = (patch: Record<string, unknown>): boolean =>
  blogSchema.safeParse({ ...valid, ...patch }).success;

describe("blogSchema", () => {
  it("必須の項目だけの frontmatter を受理する", () => {
    expect(accepts({})).toBe(true);
  });

  it("date の文字列を Date に変換する", () => {
    expect(blogSchema.parse(valid).date).toEqual(new Date("2026-09-01"));
  });

  it.each([
    new Date("2026-09-01"),
    "2026-09-01T10:00:00+09:00",
    "2026-09-01T01:00:00Z",
  ])("date %j を受理する", (date) => {
    expect(accepts({ date })).toBe(true);
  });

  it.each([null, 0, "2026/09/01", "2026-09-01T10:00:00", "nope"])(
    "date %j を拒否する",
    (date) => {
      expect(accepts({ date })).toBe(false);
    },
  );

  it("published などスキーマに無い項目は受理して出力から除く", () => {
    const result = blogSchema.safeParse({ ...valid, published: true });
    expect(result.success).toBe(true);
    expect(result.data).not.toHaveProperty("published");
  });

  it.each(["title", "slug", "date", "tags", "emoji", "description"])(
    "%s が無い frontmatter を拒否する",
    (key) => {
      const { [key as keyof typeof valid]: _, ...rest } = valid;
      expect(blogSchema.safeParse(rest).success).toBe(false);
    },
  );

  it.each(["title", "description"])("%s が空文字なら拒否する", (key) => {
    expect(accepts({ [key]: "" })).toBe(false);
  });

  it.each(["a".repeat(12), "a".repeat(50), "abc_def-0123"])(
    "slug %s を受理する",
    (slug) => {
      expect(accepts({ slug })).toBe(true);
    },
  );

  it.each([
    "a".repeat(11),
    "a".repeat(51),
    "Hello-World-0001",
    "hello.world.0001",
  ])("slug %s を拒否する", (slug) => {
    expect(accepts({ slug })).toBe(false);
  });

  it("tags に 制作記・技術・日記 を受理する", () => {
    expect(accepts({ tags: ["制作記", "技術", "日記"] })).toBe(true);
  });

  it.each([[[]], [["雑記"]]])("tags %j を拒否する", (tags) => {
    expect(accepts({ tags })).toBe(false);
  });

  it.each(["🇯🇵", "👩‍💻", "1️⃣", "👍🏽"])("emoji %s を受理する", (emoji) => {
    expect(accepts({ emoji })).toBe(true);
  });

  it.each(["📝📝", "a", "", "❤"])("emoji %j を拒否する", (emoji) => {
    expect(accepts({ emoji })).toBe(false);
  });

  it("topics を 5 個まで受理する", () => {
    expect(accepts({ topics: ["a", "b", "c", "d", "e"] })).toBe(true);
  });

  it("topics が 6 個なら拒否する", () => {
    expect(accepts({ topics: ["a", "b", "c", "d", "e", "f"] })).toBe(false);
  });

  it("sponsor の name だけ、name と https の url を受理する", () => {
    expect(accepts({ sponsor: { name: "スポンサー" } })).toBe(true);
    expect(
      accepts({ sponsor: { name: "スポンサー", url: "https://example.com/" } }),
    ).toBe(true);
  });

  it.each([
    { url: "https://example.com/" },
    { name: "スポンサー", url: "javascript:alert(1)" },
    { name: "スポンサー", url: "not a url" },
  ])("sponsor %j を拒否する", (sponsor) => {
    expect(accepts({ sponsor })).toBe(false);
  });
});
