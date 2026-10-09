import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** The `<style>` of `LatestVideoList.astro`. */
const style = (() => {
  const text = readFileSync(
    new URL("./LatestVideoList.astro", import.meta.url),
    "utf8",
  );
  return text.match(/<style\b[^>]*>([\s\S]*?)<\/style>/)?.[1] ?? "";
})();

describe("LatestVideoList の幅ごとの表示", () => {
  it("既定では display: none で隠し、767px 以下では小さな窓の列もボタンも出ない", () => {
    const outside = style.replace(/@media[^{]*\{[\s\S]*?\n\}/g, "");
    expect(outside).toMatch(/\.latest-video-list\s*\{[^}]*display:\s*none;/);
  });

  it("768px 以上で display: flex にして列として並べる", () => {
    expect(style).toMatch(
      /@media \(min-width: 768px\) \{\s*\.latest-video-list\s*\{[^}]*display:\s*flex;/,
    );
  });
});
