import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  type CssRule,
  cssOfAstro,
  hasCondition,
  parseCss,
  rulesFor,
  valueIn,
} from "../../test/css-source";

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), "utf8");

const HERO = read("./Hero.astro");
const HEADER = read("../site/SiteHeader.astro");
const HERO_RULES = parseCss(cssOfAstro(HERO));
const HEADER_RULES = parseCss(cssOfAstro(HEADER));
const MOTION_RULES = parseCss(read("../../styles/motion.css"));

const REDUCE = "@media (prefers-reduced-motion: reduce)";

/** Returns whether one `class` attribute of `html` lists all of `names`. */
const hasClasses = (html: string, names: string[]) =>
  [...html.matchAll(/class="([^"]*)"/g)].some((match) => {
    const classes = match[1].split(/\s+/);
    return names.every((name) => classes.includes(name));
  });

/** Returns the `animation` values of the rules that have a selector for which `matches` holds. */
const animations = (rules: CssRule[], matches: (selector: string) => boolean) =>
  rules
    .filter((rule) => rule.selectors.some(matches))
    .map((rule) => valueIn(rule, "animation"));

describe("カーソルの点滅の切り替え", () => {
  it("Hero のロゴとヘッダーのロゴの親が blink-on を持つ", () => {
    expect(hasClasses(HERO, ["hero-logo", "blink-on"])).toBe(true);
    expect(hasClasses(HEADER, ["brand", "blink-on"])).toBe(true);
  });

  it("blink-on の中の cur は点滅させ、動きを減らす設定では後ろの規則で止める", () => {
    const rules = rulesFor(MOTION_RULES, ".blink-on .cur");
    const moving = rules.filter((rule) => !hasCondition(rule, REDUCE));
    expect(moving).toHaveLength(1);
    expect(valueIn(moving[0], "animation")).not.toBe("none");
    const stops = rules.filter(
      (rule) =>
        hasCondition(rule, REDUCE) &&
        MOTION_RULES.indexOf(rule) > MOTION_RULES.indexOf(moving[0]),
    );
    expect(stops.map((rule) => valueIn(rule, "animation"))).toEqual(["none"]);
  });

  it("Hero のロゴが見えている間はヘッダーのカーソルを止める", () => {
    expect(
      animations(
        HEADER_RULES,
        (selector) =>
          selector.includes(".hero-logo:not([data-offscreen])") &&
          selector.includes(".brand"),
      ),
    ).toEqual(["none"]);
  });

  it("Hero のロゴが見えなくなったら Hero のカーソルを止める", () => {
    expect(
      animations(
        HERO_RULES,
        (selector) =>
          selector.includes(".hero-logo[data-offscreen]") &&
          selector.includes(".cur"),
      ),
    ).toEqual(["none"]);
  });

  it("script は Hero のロゴが画面に入っていないとき data-offscreen を付ける", () => {
    expect(HERO).toMatch(
      /logo\.toggleAttribute\("data-offscreen",\s*!entry\.isIntersecting\)/,
    );
  });
});
