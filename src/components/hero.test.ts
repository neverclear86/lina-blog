import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type CssRule,
  cssOfAstro,
  hasCondition,
  parseCss,
  rulesFor,
  valueIn,
} from "../test/css-source";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const HERO = read("./Hero.astro");
const HERO_RULES = parseCss(cssOfAstro(HERO));
const POSES_RULES = parseCss(cssOfAstro(read("./HeroPoses.astro")));
const WINDOW_RULES = parseCss(read("../styles/window.css"));
const MOTION_RULES = parseCss(read("../styles/motion.css"));

const REDUCE = "@media (prefers-reduced-motion: reduce)";

/** Returns the index of `needle` in `HERO`, after checking that `HERO` has it. */
const at = (needle: string) => {
  const index = HERO.indexOf(needle);
  expect(index, needle).toBeGreaterThanOrEqual(0);
  return index;
};

/** Returns the part of `HERO` from `start` up to the next `end`. */
const between = (start: string, end: string) => {
  const from = at(start);
  const to = HERO.indexOf(end, from);
  expect(to, end).toBeGreaterThan(from);
  return HERO.slice(from, to);
};

describe("Hero の飾りと窓の差し込み口", () => {
  it("斜めの帯・斜線・線・印は 1 つの aria-hidden の箱に入る", () => {
    const decor = between(
      '<div class="decor"',
      '<div class="hero-grid page-width">',
    );
    expect(decor).toMatch(/^<div class="decor" aria-hidden="true">/);
    for (const cls of ["hatch", "band", "ln", "cross"]) {
      expect(decor, cls).toMatch(new RegExp(`class="${cls}[ "]`));
    }
  });

  it("Hero の下の斜線の帯は .stripes で、支援技術から隠す", () => {
    expect(HERO).toMatch(/<div class="stripes" aria-hidden="true"><\/div>/);
  });

  it("プロンプトは支援技術から隠す", () => {
    expect(HERO).toMatch(/<p class="whoami rv" aria-hidden="true">/);
  });

  it("ボタンは #latest へのリンクにする", () => {
    expect(HERO).toMatch(/<a class="[^"]*\blatest\b[^"]*" href="#latest">/);
  });

  it("インラインの style 属性を持たない", () => {
    expect(HERO).not.toMatch(/\sstyle=["{]/);
  });

  it("ボタン、アカウントの窓、ポーズの順に並べ、フォーカスもこの順に進む", () => {
    expect(at('href="#latest"')).toBeLessThan(at("<HeroAccount"));
    expect(at("<HeroAccount")).toBeLessThan(at("<HeroPoses"));
  });
});

/**
 * Asserts that every rule of `rules` that starts an animation, except those of keyframes and of
 * reduced motion, has a later rule of reduced motion that sets `animation: none` for each of its
 * selectors.
 */
function expectStoppedUnderReduce(rules: CssRule[]) {
  const moving = rules.filter((rule) => {
    const animation = valueIn(rule, "animation");
    return (
      animation !== undefined &&
      animation !== "none" &&
      !hasCondition(rule, REDUCE) &&
      !rule.conditions.some((c) => c.startsWith("@keyframes"))
    );
  });
  expect(moving.length).toBeGreaterThan(0);
  for (const rule of moving) {
    for (const selector of rule.selectors) {
      const stops = rulesFor(rules, selector).filter(
        (r) =>
          hasCondition(r, REDUCE) &&
          rules.indexOf(r) > rules.indexOf(rule) &&
          valueIn(r, "animation") === "none",
      );
      expect(stops, selector).toHaveLength(1);
    }
  }
}

describe("Hero の動き", () => {
  it.each([
    ["Hero.astro", HERO_RULES],
    ["HeroPoses.astro", POSES_RULES],
    ["window.css", WINDOW_RULES],
    ["motion.css", MOTION_RULES],
  ])(
    "%s で animation を始める規則は、動きを減らす設定の中の後ろの規則で止める",
    (_, rules) => {
      expectStoppedUnderReduce(rules);
    },
  );

  it("animation の一括指定は、同じセレクタの animation-duration・animation-delay より先に書く", () => {
    for (const rules of [HERO_RULES, WINDOW_RULES]) {
      const shorthands = rules.filter((rule) => {
        const animation = valueIn(rule, "animation");
        return animation !== undefined && animation !== "none";
      });
      expect(shorthands.length).toBeGreaterThan(0);
      for (const rule of shorthands) {
        for (const selector of rule.selectors) {
          const earlier = rulesFor(rules, selector).filter(
            (r) =>
              rules.indexOf(r) < rules.indexOf(rule) &&
              r.declarations.some((d) => /^animation-/.test(d.property)),
          );
          // The shorthand resets the longhands of a rule before it.
          expect(earlier, selector).toEqual([]);
        }
      }
    }
  });
});
