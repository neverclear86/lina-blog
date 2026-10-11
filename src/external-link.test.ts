import { describe, expect, it } from "vitest";
import {
  externalLabel,
  externalLinkAttrs,
  externalNote,
  isExternalLink,
} from "./external-link";

const site = new URL("https://ikili.pro/");

describe("isExternalLink", () => {
  it.each([
    ["/blog/", "相対パス"],
    ["blog/post/", "ディレクトリー相対"],
    ["", "空の href"],
    ["#top", "ページ内のアンカー"],
    ["https://ikili.pro/blog/", "自サイトの絶対 URL"],
    ["http://ikili.pro/blog/", "自サイトの http"],
    ["https://IKILI.PRO/blog/", "大文字のホスト"],
    ["//ikili.pro/blog/", "自サイトのスキーム相対"],
    [
      "https://evil.example@ikili.pro/",
      "userinfo に別のホストを書いた自サイト",
    ],
    ["mailto:lina@ikili.pro", "mailto:"],
    ["tel:+810000000000", "tel:"],
    ["javascript:void(0)", "javascript:"],
    ["data:text/plain,hello", "data:"],
    ["https://", "解決できない URL"],
    ["https://ikili.pro%0A/", "ホストに %0A を含む URL"],
    ["/blog/%0A", "パスに %0A を含む相対パス"],
  ])("%s（%s）は外部でない", (href) => {
    expect(isExternalLink(href, site)).toBe(false);
  });

  it.each([
    ["https://example.com/", "外部の https"],
    ["http://example.com/", "外部の http"],
    ["//example.com/", "外部のスキーム相対"],
    ["https://www.ikili.pro/", "www 付きの別ホスト"],
    ["https://ikili.pro.evil.example/", "自サイトで始まる別ホスト"],
    ["https://ikili.pro@example.com/", "userinfo だけに自サイト"],
    ["https://example.com/?u=https://ikili.pro/", "クエリーに自サイトの URL"],
    ["https://ikili.pro./", "末尾にドットのホスト"],
    ["  https://example.com/  ", "前後に空白"],
    ["\nhttps://example.com/", "先頭に改行"],
    ["https://exa\tmple.com/", "ホストの途中にタブ"],
    ["https://example.com/%0A", "パスに %0A"],
    ["/\\example.com", "スラッシュとバックスラッシュ"],
  ])("%s（%s）は外部", (href) => {
    expect(isExternalLink(href, site)).toBe(true);
  });
});

describe("externalLinkAttrs", () => {
  it("外部のリンクには target=_blank と noopener を付ける", () => {
    expect(externalLinkAttrs("https://example.com/", site)).toEqual({
      target: "_blank",
      rel: "noopener",
    });
  });

  it.each([
    ["sponsored", "sponsored noopener", "既存の値を保ち末尾に noopener を足す"],
    ["me", "me noopener", "既存の値を保ち末尾に noopener を足す"],
    ["me   sponsored", "me sponsored noopener", "値の間の空白を 1 つにする"],
    ["noopener noreferrer", "noopener noreferrer", "noopener を重ねて足さない"],
    [
      "noreferrer NoOpener",
      "noreferrer NoOpener",
      "noopener の大文字小文字を区別しない",
    ],
  ])("外部のリンクの rel が %s のとき %s になる（%s）", (rel, expected) => {
    expect(externalLinkAttrs("https://example.com/", site, rel)).toEqual({
      target: "_blank",
      rel: expected,
    });
  });

  it("空の rel は noopener だけにする", () => {
    expect(externalLinkAttrs("https://example.com/", site, "")).toEqual({
      target: "_blank",
      rel: "noopener",
    });
  });

  it("サイトの中のリンクには target を付けず rel を変えない", () => {
    expect(externalLinkAttrs("/blog/", site, "me")).toEqual({ rel: "me" });
  });

  it("サイトの中のリンクで rel が無ければ属性を返さない", () => {
    expect(externalLinkAttrs("/blog/", site)).toEqual({});
  });

  it("mailto: のリンクには target を付けない", () => {
    expect(externalLinkAttrs("mailto:lina@ikili.pro", site)).toEqual({});
  });
});

describe("externalNote", () => {
  it("日本語は区切りなしで、外部サイトで新しいタブで開く旨を返す", () => {
    expect(externalNote("ja")).toBe("（外部サイト・新しいタブで開く）");
  });

  it("英語は半角の空白で始まる", () => {
    expect(externalNote("en")).toBe(" (external site, opens in a new tab)");
  });
});

describe("externalLabel", () => {
  it.each([
    ["ja", "YouTube", "YouTube（外部サイト・新しいタブで開く）"],
    ["ja", "Twitter(自称X)", "Twitter(自称X)（外部サイト・新しいタブで開く）"],
    ["en", "YouTube", "YouTube (external site, opens in a new tab)"],
    [
      "en",
      "Twitter (self-proclaimed X)",
      "Twitter (self-proclaimed X) (external site, opens in a new tab)",
    ],
  ] as const)(
    "%s の %s は名前の後ろに注記を続ける",
    (lang, label, expected) => {
      expect(externalLabel(lang, label)).toBe(expected);
    },
  );
});
