import { describe, expect, it } from "vitest";
import { buildLlmsTxt } from "./llms";

const text = buildLlmsTxt(new URL("https://example.com"));

describe("buildLlmsTxt", () => {
  it("H1 のサイト名の次に引用の要約を置く", () => {
    const lines = text.split("\n");
    expect(lines[0]).toBe("# ikili.pro");
    expect(lines[1]).toBe("");
    expect(lines[2]).toMatch(/^> \S/);
  });

  it("言語ごとのトップページへのリンクを site の絶対 URL で書く", () => {
    expect(text).toContain("- [トップ（日本語）](https://example.com/ja/)\n");
    expect(text).toContain("- [トップ（英語）](https://example.com/en/)\n");
  });

  it("言語ごとのお問い合わせのページへのリンクを、トップページの次の行に書く", () => {
    expect(text).toContain(
      "- [トップ（英語）](https://example.com/en/)\n- [お問い合わせ（日本語）](https://example.com/ja/contact/)\n- [お問い合わせ（英語）](https://example.com/en/contact/)\n",
    );
  });

  it.each([
    ["YouTube", "https://www.youtube.com/@LinaTsukusu"],
    ["Twitter(自称X)", "https://x.com/TsukusuLina"],
    ["GitHub", "https://github.com/neverclear86"],
    [
      "Nostr",
      "https://nostter.app/npub1es86m387vusxe66jjp200eqkn3lcxsxudeg2g50zz0yjx5ggvt8sgctaxz",
    ],
    ["Zenn", "https://zenn.dev/linatsukusu"],
  ])("リンクの節に %s を載せる", (label, url) => {
    expect(text).toContain(`- [${label}](${url}): `);
  });

  it("リンクでない角括弧（仮の文言の穴）を含まない", () => {
    expect(text).not.toMatch(/\[[^\]]*\](?!\()/);
  });

  it("リンクの節は YouTube、Twitter(自称X)、GitHub、Nostr、Zenn の順に並ぶ", () => {
    const labels = [
      ...text.matchAll(/^- \[([^\]]+)\]\(https:\/\/(?!example\.com\/)/gm),
    ].map((m) => m[1]);
    expect(labels).toEqual([
      "YouTube",
      "Twitter(自称X)",
      "GitHub",
      "Nostr",
      "Zenn",
    ]);
  });

  it("末尾は改行 1 つで終わる", () => {
    expect(text).toMatch(/[^\n]\n$/);
  });

  it("site が無いと例外を投げる", () => {
    expect(() => buildLlmsTxt(undefined)).toThrow("astro.config.mjs");
  });
});
