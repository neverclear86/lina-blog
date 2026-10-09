import { describe, expect, it } from "vitest";
import { translate } from "./i18n/ui";
import { ogImagePages, postOgImagePath, topOgImagePath } from "./og-pages";

/** A post as `ogImagePages` needs it, with `patch` over a post with one tag and no sponsor. */
function post(patch: Record<string, unknown> = {}) {
  return {
    data: {
      title: "記事の題",
      slug: "hello-world-0001",
      tags: ["技術" as const],
      ...patch,
    },
  };
}

describe("topOgImagePath", () => {
  it("トップの画像のパスは言語ごとに /og/<言語>.png になる", () => {
    expect(topOgImagePath("ja")).toBe("/og/ja.png");
    expect(topOgImagePath("en")).toBe("/og/en.png");
  });
});

describe("postOgImagePath", () => {
  it("記事の画像のパスは /og/blog/<slug>.png になる", () => {
    expect(postOgImagePath("hello-world-0001")).toBe(
      "/og/blog/hello-world-0001.png",
    );
  });
});

describe("ogImagePages", () => {
  it("記事が無くても、トップの日英の画像を ja、en の順に返す", () => {
    expect(ogImagePages([]).map((page) => page.path)).toEqual([
      "/og/ja.png",
      "/og/en.png",
    ]);
  });

  it("トップの画像の題はヒーローの見出しで、日本語は続けて、英語は空白でつなぐ", () => {
    const [ja, en] = ogImagePages([]);
    expect(ja?.input).toEqual({
      title:
        translate("ja", "hero.headingLead") +
        translate("ja", "hero.headingMark"),
      lang: "ja",
    });
    expect(en?.input).toEqual({
      title: `${translate("en", "hero.headingLead")} ${translate("en", "hero.headingMark")}`,
      lang: "en",
    });
  });

  it("記事の画像はトップの後ろに、渡した記事の順に並ぶ", () => {
    const pages = ogImagePages([post(), post({ slug: "second-post-0002" })]);
    expect(pages.map((page) => page.path)).toEqual([
      "/og/ja.png",
      "/og/en.png",
      "/og/blog/hello-world-0001.png",
      "/og/blog/second-post-0002.png",
    ]);
  });

  it("記事の画像には、題と日本語と最初のタグをカテゴリとして渡す", () => {
    const pages = ogImagePages([post({ tags: ["日記", "技術"] })]);
    expect(pages[2]?.input).toEqual({
      title: "記事の題",
      lang: "ja",
      category: "日記",
      sponsor: undefined,
    });
  });

  it("sponsor がある記事の画像には、スポンサー名だけを渡す", () => {
    const sponsor = { name: "ACME", url: "https://example.com/" };
    const pages = ogImagePages([post({ sponsor })]);
    expect(pages[2]?.input.sponsor).toBe("ACME");
  });
});
