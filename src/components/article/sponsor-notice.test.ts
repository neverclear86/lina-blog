import { describe, expect, it } from "vitest";
import { sponsorNotice } from "./sponsor-notice";

describe("sponsorNotice", () => {
  it("sponsor がある記事は PR のラベルとスポンサー名の文を返す", () => {
    expect(sponsorNotice({ name: "ACME" })).toEqual({
      label: "PR",
      before: "この記事は ",
      name: "ACME",
      link: undefined,
      after: " の提供による PR 記事です。",
    });
  });

  it("sponsor の url があればスポンサー名を rel=sponsored のリンクにする", () => {
    expect(
      sponsorNotice({ name: "ACME", url: "https://example.com/" })?.link,
    ).toEqual({
      href: "https://example.com/",
      rel: "sponsored",
    });
  });

  it("sponsor が無い記事は表示を返さない", () => {
    expect(sponsorNotice(undefined)).toBeUndefined();
  });
});
