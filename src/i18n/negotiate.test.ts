import { describe, expect, it } from "vitest";
import { negotiateLocale } from "./negotiate";

describe("negotiateLocale", () => {
  it("ヘッダーが無いときは既定の言語を返す", () => {
    expect(negotiateLocale(undefined)).toBe("ja");
  });

  it("en だけを受け入れるときは英語を返す", () => {
    expect(negotiateLocale("en")).toBe("en");
  });

  it("地域付きの en-US は英語として扱う", () => {
    expect(negotiateLocale("en-US")).toBe("en");
  });

  it("言語タグの大文字と小文字を区別しない", () => {
    expect(negotiateLocale("EN-us")).toBe("en");
  });

  it("q 値の大きい言語を優先する", () => {
    expect(negotiateLocale("ja;q=0.5, en;q=0.8")).toBe("en");
  });

  it("日本語の q 値が英語より大きいときは日本語を返す", () => {
    expect(negotiateLocale("ja, en-US;q=0.9, en;q=0.8")).toBe("ja");
  });

  it("q 値が同じときは先に書かれた言語を優先する", () => {
    expect(negotiateLocale("en, ja")).toBe("en");
  });

  it("q=0 の言語は受け入れないものとして扱う", () => {
    expect(negotiateLocale("en;q=0")).toBe("ja");
  });

  it("対応しない言語を飛ばして次の言語を見る", () => {
    expect(negotiateLocale("fr, en;q=0.5")).toBe("en");
  });

  it("対応する言語が無いときは既定の言語を返す", () => {
    expect(negotiateLocale("fr, de;q=0.8, *;q=0.5")).toBe("ja");
  });
});
