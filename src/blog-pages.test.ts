import { describe, expect, it } from "vitest";
import {
  adjacentPosts,
  blogCrumbs,
  blogListText,
  blogPostBreadcrumb,
  blogPostDate,
  blogPostPaths,
  blogTagPagePaths,
  readingMinutes,
  tagFilterLinks,
} from "./blog-pages";
import { translate } from "./i18n/ui";
import type { BlogTag } from "./latest-posts";

/** A post as `adjacentPosts` needs it: a slug and a date in `YYYY-MM-DD`. */
function post(slug: string, date: string) {
  return { data: { slug, date: new Date(date) } };
}

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

describe("blogPostPaths", () => {
  it("記事 1 件につき /blog/<slug>/ の経路を 1 件、記事の順に出し、記事を props に渡す", () => {
    const first = {
      data: { slug: "first-post-slug", date: new Date("2026-01-01") },
    };
    const second = {
      data: { slug: "second-post-slug", date: new Date("2026-02-01") },
    };
    const paths = blogPostPaths([first, second]);
    expect(paths.map((path) => path.params)).toEqual([
      { slug: "first-post-slug" },
      { slug: "second-post-slug" },
    ]);
    expect(paths[0]?.props.post).toBe(first);
    expect(paths[1]?.props.post).toBe(second);
  });

  it("記事が 0 件なら経路も 0 件にする", () => {
    expect(blogPostPaths([])).toEqual([]);
  });

  it("props に、その記事の 1 つ古い記事を prev、1 つ新しい記事を next として渡す", () => {
    const middle = post("middle", "2026-01-01");
    const newest = post("newest", "2026-02-01");
    const oldest = post("oldest", "2025-12-01");
    const paths = blogPostPaths([middle, newest, oldest]);
    expect(paths.map((path) => [path.props.prev, path.props.next])).toEqual([
      [oldest, newest],
      [middle, undefined],
      [undefined, middle],
    ]);
  });
});

describe("adjacentPosts", () => {
  const middle = post("middle", "2026-01-01");
  const oldest = post("oldest", "2025-12-01");
  const newest = post("newest", "2026-02-01");

  it("中ほどの記事は、1 つ古い記事を prev、1 つ新しい記事を next にする", () => {
    expect(adjacentPosts([middle, oldest, newest], "middle")).toEqual({
      prev: oldest,
      next: newest,
    });
  });

  it("最古の記事は prev が無く、next は 1 つ新しい記事にする", () => {
    expect(adjacentPosts([middle, oldest, newest], "oldest")).toEqual({
      prev: undefined,
      next: middle,
    });
  });

  it("最新の記事は next が無く、prev は 1 つ古い記事にする", () => {
    expect(adjacentPosts([middle, oldest, newest], "newest")).toEqual({
      prev: middle,
      next: undefined,
    });
  });

  it("記事が 1 件なら prev も next も無い", () => {
    expect(adjacentPosts([middle], "middle")).toEqual({
      prev: undefined,
      next: undefined,
    });
  });

  it("同じ日付の記事は postsNewestFirst と同じく posts の順で、先の記事を新しい側にする", () => {
    const first = post("first", "2026-01-01");
    const second = post("second", "2026-01-01");
    expect(adjacentPosts([first, second], "first")).toEqual({
      prev: second,
      next: undefined,
    });
    expect(adjacentPosts([first, second], "second")).toEqual({
      prev: undefined,
      next: first,
    });
  });

  it("posts に無い slug には prev も next も無い", () => {
    expect(adjacentPosts([middle, oldest, newest], "missing")).toEqual({
      prev: undefined,
      next: undefined,
    });
  });

  it("posts を並べ替えない", () => {
    const posts = [middle, oldest, newest];
    adjacentPosts(posts, "middle");
    expect(posts).toEqual([middle, oldest, newest]);
  });
});

describe("blogPostBreadcrumb", () => {
  it("年は日本時間の日付の年にする（UTC では前の年の 12/31 でも、日本では元日になる）", () => {
    expect(
      blogPostBreadcrumb("new-year-post", new Date("2025-12-31T15:00:00Z")),
    ).toEqual({ year: "2026", file: "new-year-post.md" });
  });

  it("日本時間の大晦日の夜は前の年にする", () => {
    expect(
      blogPostBreadcrumb("late-post", new Date("2025-12-31T14:59:59Z")).year,
    ).toBe("2025");
  });

  it("末尾は slug に .md を付けたファイル名にする", () => {
    expect(
      blogPostBreadcrumb("my-first-article", new Date("2026-05-01T00:00:00Z"))
        .file,
    ).toBe("my-first-article.md");
  });
});

describe("blogPostDate", () => {
  const date = new Date("2025-12-31T15:00:00Z");

  it("表示は日本時間の YYYY.MM.DD にする", () => {
    expect(blogPostDate(date).text).toBe("2026.01.01");
  });

  it("datetime は UTC の ISO 8601 にする", () => {
    expect(blogPostDate(date).dateTime).toBe("2025-12-31T15:00:00.000Z");
  });
});

describe("readingMinutes", () => {
  const chars = (n: number) => "あ".repeat(n);
  const fence = "`".repeat(3);

  it("500 字までは 1 分、501 字から 2 分にする", () => {
    expect(
      [499, 500, 501, 1000, 1001].map((n) => readingMinutes(chars(n))),
    ).toEqual([1, 1, 2, 2, 3]);
  });

  it("本文が空か無いときは 1 分にする", () => {
    expect([readingMinutes(""), readingMinutes(undefined)]).toEqual([1, 1]);
  });

  it("空白、全角の空白、改行は数えない", () => {
    expect(readingMinutes(`${chars(250)} 　\n\r\n\t${chars(250)}`)).toBe(1);
    expect(readingMinutes(`${chars(500)} あ`)).toBe(2);
  });

  it("コードポイント 1 つを 1 字と数える（絵文字や𠮷を 2 字にしない）", () => {
    expect(readingMinutes("𠮷".repeat(500))).toBe(1);
    expect(readingMinutes(`${"𠮷".repeat(500)}😀`)).toBe(2);
  });

  it("バッククォートのフェンスのコードブロックは、フェンスの行ごと数えない", () => {
    const body = [chars(500), `${fence}ts`, chars(2000), fence, ""].join("\n");
    expect(readingMinutes(body)).toBe(1);
  });

  it("チルダのフェンスのコードブロックも数えない", () => {
    const body = [chars(500), "~~~", chars(2000), "~~~", ""].join("\n");
    expect(readingMinutes(body)).toBe(1);
  });

  it("閉じていないフェンスは本文の終わりまでコードとして数えない", () => {
    const body = [chars(500), fence, chars(2000), ""].join("\n");
    expect(readingMinutes(body)).toBe(1);
  });

  it("開いたフェンスより短いフェンスと別の文字のフェンスでは閉じず、同じ長さ以上で閉じる", () => {
    const body = [
      `${"`".repeat(4)}md`,
      fence,
      "~~~~",
      chars(2000),
      "`".repeat(5),
      chars(501),
    ].join("\n");
    expect(readingMinutes(body)).toBe(2);
  });

  it("コードブロックの後の本文は数える", () => {
    const body = [fence, chars(2000), fence, chars(501)].join("\n");
    expect(readingMinutes(body)).toBe(2);
  });

  it("同じ行で閉じるバッククォート 3 つのインラインコードはフェンスにしない", () => {
    const body = [`${fence}コード${fence}`, chars(500)].join("\n");
    expect(readingMinutes(body)).toBe(2);
  });

  it("フェンスの外のインラインコードと Markdown の記号は数える", () => {
    const body = [`## ${chars(496)}`, "`a`"].join("\n");
    expect(readingMinutes(body)).toBe(2);
  });
});
