import { z } from "astro/zod";
import { describe, expect, it } from "vitest";
import { workSchema } from "./work-schema";

const schema = workSchema(z.string().transform((src) => ({ src })));

const valid = {
  title: "ikili.pro",
  slug: "ikili-pro",
  description: { ja: "このサイト。", en: "This site." },
  order: 1,
};

const accepts = (patch: Record<string, unknown>): boolean =>
  schema.safeParse({ ...valid, ...patch }).success;

describe("workSchema", () => {
  it("必須の項目だけのデータを既定値で埋める", () => {
    expect(schema.parse(valid)).toEqual({
      ...valid,
      tech: [],
      links: { videos: [], posts: [] },
      hasPage: false,
      label: "$ cat README.md",
      cursor: false,
    });
  });

  it.each(["title", "slug", "description", "order"])(
    "%s が無いデータを拒否する",
    (key) => {
      const { [key as keyof typeof valid]: _, ...rest } = valid;
      expect(schema.safeParse(rest).success).toBe(false);
    },
  );

  it("スキーマに無いキーを拒否する", () => {
    expect(accepts({ thumbnial: "logo" })).toBe(false);
  });

  it("links の中のスキーマに無いキーを拒否する", () => {
    expect(accepts({ links: { website: "https://example.com/" } })).toBe(false);
  });

  it.each(["ikili-pro", "nostr-no-su", "a1"])("slug %s を受理する", (slug) => {
    expect(accepts({ slug })).toBe(true);
  });

  it.each([
    "",
    "Ikili-pro",
    "ikili_pro",
    "ikili.pro",
    "-ikili",
    "ikili-",
    "ikili--pro",
  ])("slug %j を拒否する", (slug) => {
    expect(accepts({ slug })).toBe(false);
  });

  it.each(["ja", "en"] as const)("description.%s が無ければ拒否する", (key) => {
    const { [key]: _, ...rest } = valid.description;
    expect(accepts({ description: rest })).toBe(false);
  });

  it.each(["ja", "en"] as const)(
    "description.%s が空文字なら拒否する",
    (key) => {
      expect(
        accepts({ description: { ...valid.description, [key]: "" } }),
      ).toBe(false);
    },
  );

  it("description の中のスキーマに無いキーを拒否する", () => {
    expect(accepts({ description: { ja: "a", en: "b", fr: "x" } })).toBe(false);
  });

  it("thumbnail の logo はそのまま残す", () => {
    expect(schema.parse({ ...valid, thumbnail: "logo" }).thumbnail).toBe(
      "logo",
    );
  });

  it("thumbnail の logo 以外の文字列は画像のスキーマに渡す", () => {
    expect(schema.parse({ ...valid, thumbnail: "./a.png" }).thumbnail).toEqual({
      src: "./a.png",
    });
  });

  it.each(["demo", "repo"])(
    "links.%s の http と https 以外の URL を拒否する",
    (key) => {
      expect(accepts({ links: { [key]: "https://example.com/" } })).toBe(true);
      expect(accepts({ links: { [key]: "javascript:alert(1)" } })).toBe(false);
    },
  );

  it.each(["videos", "posts"])(
    "links.%s の行の URL と名前を検証する",
    (key) => {
      expect(
        accepts({
          links: { [key]: [{ url: "https://example.com/", name: "動画" }] },
        }),
      ).toBe(true);
      expect(
        accepts({
          links: { [key]: [{ url: "ftp://example.com/", name: "x" }] },
        }),
      ).toBe(false);
      expect(
        accepts({
          links: { [key]: [{ url: "https://example.com/", name: "" }] },
        }),
      ).toBe(false);
    },
  );

  it.each(["videos", "posts"])("links.%s の名前の無い行を受理する", (key) => {
    expect(
      accepts({ links: { [key]: [{ url: "https://example.com/" }] } }),
    ).toBe(true);
  });

  it.each(["videos", "posts"])(
    "links.%s の行のスキーマに無いキーを拒否する",
    (key) => {
      expect(
        accepts({
          links: { [key]: [{ url: "https://example.com/", title: "x" }] },
        }),
      ).toBe(false);
    },
  );

  it.each([1.5, "1"])("order %j を拒否する", (order) => {
    expect(accepts({ order })).toBe(false);
  });

  it("tech の空文字を拒否する", () => {
    expect(accepts({ tech: [""] })).toBe(false);
  });

  it("label の空文字を拒否する", () => {
    expect(accepts({ label: "" })).toBe(false);
  });
});
