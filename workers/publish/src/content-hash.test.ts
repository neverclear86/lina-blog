import { afterEach, describe, expect, it, vi } from "vitest";
import { contentHash } from "./content-hash";

const MARKDOWN = "---\ntitle: 創好リナ\n---\n本文\n";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("contentHash", () => {
  it.each([
    ["", "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"],
    ["abc", "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"],
  ])("%j の SHA-256 を小文字の 16 進 64 文字で返す", async (markdown, hash) => {
    expect(await contentHash(markdown)).toBe(hash);
  });

  it("日本語を含む Markdown は UTF-8 のバイト列のハッシュを返す", async () => {
    expect(await contentHash(MARKDOWN)).toBe(
      "a068b25ef2f0ae33f365437b8766a9df0dba25d6b6ad37220c06710bc952ec81",
    );
  });

  it("改行の CRLF を正規化せずにそのままハッシュする", async () => {
    expect(await contentHash(MARKDOWN.replaceAll("\n", "\r\n"))).toBe(
      "774393d6c575a111fd747239359da39edde06e77e8dbd4661678b2a915d8bd3f",
    );
  });

  it("crypto.subtle が無い実行環境では例外を投げる", async () => {
    vi.stubGlobal("crypto", {});
    await expect(contentHash("abc")).rejects.toThrow(
      "crypto.subtle is not available",
    );
  });
});
