import { describe, expect, it } from "vitest";
import { diffArticles, type VaultArticleState } from "./diff";

const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

/** An article with `published: true` at `articles/<slug>.md` unless `path` is given. */
function publishedArticle(
  slug: string,
  hash: string,
  path = `articles/${slug}.md`,
): VaultArticleState {
  return { path, slug, published: true, hash };
}

/** An article with `published: false` at `articles/<slug>.md` unless `path` is given. */
function draftArticle(
  slug: string,
  path = `articles/${slug}.md`,
): VaultArticleState {
  return { path, slug, published: false };
}

describe("diffArticles", () => {
  it("公開する記事で一覧に無いものは公開になる", () => {
    expect(diffArticles([publishedArticle("a", HASH_A)], [])).toEqual([
      { kind: "publish", slug: "a", path: "articles/a.md" },
    ]);
  });

  it.each([
    ["ハッシュが違う", HASH_B],
    ["一覧の hash が null", null],
  ])("公開する記事で（%s）ものは更新になる", (_, listedHash) => {
    expect(
      diffArticles(
        [publishedArticle("a", HASH_A)],
        [{ slug: "a", hash: listedHash }],
      ),
    ).toEqual([{ kind: "update", slug: "a", path: "articles/a.md" }]);
  });

  it("公開する記事でハッシュが同じものは何もしない", () => {
    expect(
      diffArticles(
        [publishedArticle("a", HASH_A)],
        [{ slug: "a", hash: HASH_A }],
      ),
    ).toEqual([{ kind: "unchanged", slug: "a", path: "articles/a.md" }]);
  });

  it.each([
    ["hash がある", HASH_A],
    ["hash が null", null],
  ])("非公開の記事で一覧に有る（%s）ものは取り下げになる", (_, listedHash) => {
    expect(
      diffArticles([draftArticle("a")], [{ slug: "a", hash: listedHash }]),
    ).toEqual([{ kind: "unpublish", slug: "a", path: "articles/a.md" }]);
  });

  it("非公開の記事で一覧に無いものは何もしない", () => {
    expect(diffArticles([draftArticle("a")], [])).toEqual([
      { kind: "draft", slug: "a", path: "articles/a.md" },
    ]);
  });

  it("一覧に有って Vault に無い記事は取り下げずに報告だけする", () => {
    expect(diffArticles([], [{ slug: "a", hash: HASH_A }])).toEqual([
      { kind: "missing", slug: "a" },
    ]);
  });

  it("slug が重なる記事はどれも処理せず重複として報告する", () => {
    expect(
      diffArticles(
        [
          publishedArticle("a", HASH_B, "notes/z.md"),
          draftArticle("a", "articles/a.md"),
        ],
        [{ slug: "a", hash: HASH_A }],
      ),
    ).toEqual([
      { kind: "duplicate", slug: "a", paths: ["articles/a.md", "notes/z.md"] },
    ]);
  });

  it("結果を slug の昇順に並べる", () => {
    expect(
      diffArticles(
        [publishedArticle("c", HASH_A), draftArticle("a")],
        [{ slug: "b", hash: HASH_A }],
      ),
    ).toEqual([
      { kind: "draft", slug: "a", path: "articles/a.md" },
      { kind: "missing", slug: "b" },
      { kind: "publish", slug: "c", path: "articles/c.md" },
    ]);
  });
});
