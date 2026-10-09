import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const HERO = read("./Hero.astro");
const HEADER = read("./SiteHeader.astro");
const MOTION = read("../styles/motion.css");

describe("カーソルの点滅の切り替え", () => {
  it("Hero のロゴとヘッダーのロゴの親が blink-on を持つ", () => {
    expect(HERO).toMatch(/<div class="ticks hero-logo blink-on">/);
    expect(HEADER).toMatch(/class="brand blink-on"/);
  });

  it("blink-on の中の cur を点滅させ、動きを減らす設定では止める", () => {
    expect(MOTION).toMatch(
      /\.blink-on \.cur\s*\{\s*animation:\s*blink 1\.1s steps\(1, end\) infinite;\s*\}/,
    );
    const reduce = MOTION.slice(
      MOTION.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reduce).toMatch(/\.blink-on \.cur,[^{]*\{\s*animation:\s*none;/);
  });

  it("Hero のロゴが見えている間はヘッダーのカーソルを止める", () => {
    expect(HEADER).toMatch(
      /:global\(:root:has\(\.hero-logo:not\(\[data-offscreen\]\)\)\)\s*\.brand\s*:global\(\.cur\)\s*\{\s*animation:\s*none;\s*\}/,
    );
  });

  it("Hero のロゴが見えなくなったら Hero のカーソルを止める", () => {
    expect(HERO).toMatch(
      /\.hero-logo\[data-offscreen\]\s*:global\(\.cur\)\s*\{\s*animation:\s*none;\s*\}/,
    );
  });

  it("script は Hero のロゴが画面に入っていないとき data-offscreen を付ける", () => {
    expect(HERO).toMatch(
      /logo\.toggleAttribute\("data-offscreen",\s*!entry\.isIntersecting\)/,
    );
  });
});
