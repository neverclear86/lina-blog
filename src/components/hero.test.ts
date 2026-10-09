import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const HERO = readFileSync(new URL("./Hero.astro", import.meta.url), "utf8");

/** Returns the part of `HERO` from `start` up to the next `end`. */
const between = (start: string, end: string) => {
  const from = HERO.indexOf(start);
  expect(from).toBeGreaterThanOrEqual(0);
  const to = HERO.indexOf(end, from);
  expect(to).toBeGreaterThan(from);
  return HERO.slice(from, to);
};

describe("Hero の飾りと窓の差し込み口", () => {
  it("斜めの帯・斜線・2 本の線・5 つの印は 1 つの aria-hidden の箱に入る", () => {
    const decor = between('<div class="decor"', '<div class="hero-grid">');
    expect(decor).toMatch(/^<div class="decor" aria-hidden="true">/);
    expect(decor).toContain('<div class="hatch">');
    expect(decor).toContain('<div class="band">');
    expect(decor.match(/class="ln ln-/g)).toHaveLength(2);
    expect(decor.match(/class="cross c\d"/g)).toHaveLength(5);
  });

  it("Hero の下の斜線の帯は .stripes で、支援技術から隠す", () => {
    expect(HERO).toMatch(/<div class="stripes" aria-hidden="true"><\/div>/);
  });

  it("プロンプトは支援技術から隠す", () => {
    expect(HERO).toMatch(/<p class="whoami" aria-hidden="true">/);
  });

  it("ボタンは #latest へのリンクで、A案の .btn .btn-acc を使う", () => {
    expect(HERO).toMatch(/<a class="btn btn-acc latest" href="#latest">/);
  });

  it("C'案の部品を使わない", () => {
    expect(HERO).not.toMatch(/import (Kao|Chip|IconLink|Tape)\b/);
    expect(HERO).not.toMatch(/PROFILE_LINKS/);
  });

  it("インラインの style 属性を持たない", () => {
    expect(HERO).not.toMatch(/\sstyle=["{]/);
  });

  it("アカウントの窓の箱は左の列の最後で HeroAccount を入れ、右の列の箱は格子の 2 つ目の子で HeroPoses だけを持つ", () => {
    const left = between('<div class="hero-left">', '<div class="hero-right">');
    expect(left).toMatch(
      /<div class="hero-account"><HeroAccount lang=\{lang\} \/><\/div>\s*<\/div>\s*$/,
    );
    expect(
      HERO.match(
        /<div class="hero-right">\s*<HeroPoses lang=\{lang\} \/>\s*<\/div>/g,
      ),
    ).toHaveLength(1);
  });
});
