import { describe, expect, it } from "vitest";
import {
  type WorkCardLinkSource,
  workCardLink,
  worksInOrder,
} from "./work-card";

const work = (patch: Partial<WorkCardLinkSource>): WorkCardLinkSource => ({
  slug: "nostr-no-su",
  hasPage: false,
  links: {},
  ...patch,
});

describe("workCardLink", () => {
  it("詳細ページのある作品は日本語のページで /ja/works/<slug>/ へリンクする", () => {
    expect(workCardLink(work({ hasPage: true }), "ja")).toEqual({
      href: "/ja/works/nostr-no-su/",
      external: false,
    });
  });

  it("詳細ページのある作品は英語のページで /en/works/<slug>/ へリンクする", () => {
    expect(workCardLink(work({ hasPage: true }), "en")).toEqual({
      href: "/en/works/nostr-no-su/",
      external: false,
    });
  });

  it("詳細ページのある作品はデモの URL があっても詳細ページへリンクする", () => {
    expect(
      workCardLink(
        work({ hasPage: true, links: { demo: "https://example.com/demo" } }),
        "ja",
      ),
    ).toEqual({ href: "/ja/works/nostr-no-su/", external: false });
  });

  it("詳細ページの無い作品はリポジトリの URL があってもデモの URL へ外部のリンクとしてリンクする", () => {
    expect(
      workCardLink(
        work({
          links: {
            demo: "https://example.com/demo",
            repo: "https://example.com/repo",
          },
        }),
        "ja",
      ),
    ).toEqual({ href: "https://example.com/demo", external: true });
  });

  it("詳細ページもデモも無い作品はリポジトリの URL へ外部のリンクとしてリンクする", () => {
    expect(
      workCardLink(work({ links: { repo: "https://example.com/repo" } }), "ja"),
    ).toEqual({ href: "https://example.com/repo", external: true });
  });

  it("詳細ページもデモもリポジトリも無い作品は undefined を返す", () => {
    expect(workCardLink(work({}), "ja")).toBeUndefined();
  });
});

describe("worksInOrder", () => {
  const entry = (id: string, order: number) => ({ id, data: { order } });

  it("作品を data.order の小さい順に並べる", () => {
    const works = [entry("c", 3), entry("a", 1), entry("b", 2)];
    expect(worksInOrder(works).map((w) => w.id)).toEqual(["a", "b", "c"]);
  });

  it("worksInOrder は渡した配列を変えない", () => {
    const works = [entry("c", 3), entry("a", 1), entry("b", 2)];
    worksInOrder(works);
    expect(works.map((w) => w.id)).toEqual(["c", "a", "b"]);
  });
});
