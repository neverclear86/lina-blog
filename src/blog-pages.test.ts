import { describe, expect, it } from "vitest";
import {
  blogCrumbs,
  blogListText,
  blogTagPagePaths,
  tagFilterLinks,
} from "./blog-pages";
import { translate } from "./i18n/ui";
import type { BlogTag } from "./latest-posts";

describe("blogTagPagePaths", () => {
  it("記事が無くても、制作記・技術・日記の 3 つのタグのページをこの順に出す", () => {
    expect(blogTagPagePaths()).toEqual([
      { params: { tag: "devlog" }, props: { tag: "制作記" } },
      { params: { tag: "tech" }, props: { tag: "技術" } },
      { params: { tag: "diary" }, props: { tag: "日記" } },
    ]);
  });
});

describe("blogListText", () => {
  it("/blog/ は見出しの上に ~/blog を、題に「ブログ」、副題に「記事一覧」を出す", () => {
    const text = blogListText(undefined);
    expect(text.label).toBe("~/blog");
    expect(translate("ja", text.title)).toBe("ブログ");
    expect(translate("ja", text.subtitle)).toBe("記事一覧");
    expect(translate("ja", text.noPosts)).toBe("まだ記事はありません。");
  });

  it("タグのページは副題を題にも使い、0 件の文にタグの名前を入れる", () => {
    const text = blogListText("技術");
    expect(text.label).toBe("~/blog/tags/tech");
    expect(translate("ja", text.title)).toBe("技術の記事");
    expect(translate("ja", text.subtitle)).toBe("技術の記事");
    expect(translate("ja", text.noPosts)).toBe("技術の記事はまだありません。");
  });

  it("3 つのタグの副題と 0 件の文はそれぞれのタグの名前を含む", () => {
    expect(
      (["制作記", "技術", "日記"] as const).map((tag) => {
        const { subtitle, noPosts } = blogListText(tag);
        return [translate("ja", subtitle), translate("ja", noPosts)];
      }),
    ).toEqual([
      ["制作記の記事", "制作記の記事はまだありません。"],
      ["技術の記事", "技術の記事はまだありません。"],
      ["日記の記事", "日記の記事はまだありません。"],
    ]);
  });
});

describe("tagFilterLinks", () => {
  it("すべて・制作記・技術・日記の順に、/blog/ とタグのページを指す", () => {
    expect(
      tagFilterLinks(undefined).map(({ key, href }) => [
        translate("ja", key),
        href,
      ]),
    ).toEqual([
      ["すべて", "/blog/"],
      ["制作記", "/blog/tags/devlog/"],
      ["技術", "/blog/tags/tech/"],
      ["日記", "/blog/tags/diary/"],
    ]);
  });

  it("/blog/ ではすべてだけを現在地にする", () => {
    expect(
      tagFilterLinks(undefined)
        .filter((link) => link.current)
        .map((link) => link.href),
    ).toEqual(["/blog/"]);
  });

  it("タグのページではそのタグだけを現在地にする", () => {
    expect(
      tagFilterLinks("日記")
        .filter((link) => link.current)
        .map((link) => link.href),
    ).toEqual(["/blog/tags/diary/"]);
  });
});

describe("blogCrumbs", () => {
  it("/blog/ は ~ から日本語のトップへ進め、現在地の blog はリンクにしない", () => {
    expect(blogCrumbs(undefined)).toEqual([
      { text: "~", href: "/ja/#top" },
      { text: "blog" },
    ]);
  });

  it("タグのページは ~ と blog にリンクし、tags はリンクにせず、最後にタグのスラッグを出す", () => {
    expect(blogCrumbs("技術")).toEqual([
      { text: "~", href: "/ja/#top" },
      { text: "blog", href: "/blog/" },
      { text: "tags" },
      { text: "tech" },
    ]);
  });

  it("どのページも最後の要素が現在地で、href を持たない", () => {
    const tags: (BlogTag | undefined)[] = [undefined, "制作記", "技術", "日記"];
    const lasts = tags.map((tag) => blogCrumbs(tag).at(-1));
    expect(lasts).toEqual([
      { text: "blog" },
      { text: "devlog" },
      { text: "tech" },
      { text: "diary" },
    ]);
  });
});
