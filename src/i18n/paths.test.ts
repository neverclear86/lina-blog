import { describe, expect, it } from "vitest";
import { localizedPath } from "./paths";

describe("localizedPath", () => {
  it("/ja/ で始まるパスは言語の接頭辞だけを英語に替える", () => {
    expect(localizedPath("/ja/", "en")).toBe("/en/");
    expect(localizedPath("/ja/about/", "en")).toBe("/en/about/");
  });

  it("/en/ で始まるパスは言語の接頭辞だけを日本語に替える", () => {
    expect(localizedPath("/en/", "ja")).toBe("/ja/");
    expect(localizedPath("/en/about/", "ja")).toBe("/ja/about/");
  });

  it("言語の接頭辞の無いパスは切り替え先の言語のトップを返す", () => {
    expect(localizedPath("/blog/hello/", "en")).toBe("/en/");
    expect(localizedPath("/", "en")).toBe("/en/");
  });

  it("言語の一覧に無い語で始まるパスは接頭辞の無いパスとして扱う", () => {
    expect(localizedPath("/japan/about/", "en")).toBe("/en/");
  });
});
