import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cssOfAstro,
  hasCondition,
  parseCss,
  rulesFor,
  valueIn,
} from "../../test/css-source";

const RULES = parseCss(
  cssOfAstro(
    readFileSync(new URL("./SectionTitle.astro", import.meta.url), "utf8"),
  ),
);

const SCROLL = "@supports (animation-timeline: view())";
const REDUCE = "@media (prefers-reduced-motion: reduce)";
const MOVES = /^(animation|transform)/;

/** The rules that declare an `animation` or `transform` property, except those of keyframes. */
const moving = RULES.filter(
  (rule) =>
    !rule.conditions.some((condition) => condition.startsWith("@keyframes")) &&
    rule.declarations.some((d) => MOVES.test(d.property)),
);

describe("見出しの線の描画", () => {
  it("スクロールで描く規則は @supports と @media screen の中にだけあり、animation を animation-* より先に書く", () => {
    const scroll = moving.filter((rule) => !hasCondition(rule, REDUCE));
    expect(scroll.length).toBeGreaterThan(0);
    for (const rule of scroll) {
      expect(hasCondition(rule, SCROLL), rule.selectors.join()).toBe(true);
      expect(hasCondition(rule, "@media screen"), rule.selectors.join()).toBe(
        true,
      );
      const properties = rule.declarations.map((d) => d.property);
      const shorthand = properties.indexOf("animation");
      expect(shorthand).toBeGreaterThanOrEqual(0);
      const longhands = properties
        .filter((property) => property.startsWith("animation-"))
        .map((property) => properties.indexOf(property));
      // The `animation` shorthand resets the `animation-*` longhands, so it comes before them.
      for (const longhand of longhands) {
        expect(shorthand, rule.selectors.join()).toBeLessThan(longhand);
      }
    }
  });

  it("動きを減らす設定では、描く規則と同じセレクタの animation を、それより後ろで止める", () => {
    const scroll = moving.filter((rule) => hasCondition(rule, SCROLL));
    expect(scroll.length).toBeGreaterThan(0);
    for (const rule of scroll) {
      for (const selector of rule.selectors) {
        const stops = rulesFor(RULES, selector).filter(
          (r) =>
            hasCondition(r, REDUCE) &&
            RULES.indexOf(r) > RULES.indexOf(rule) &&
            valueIn(r, "animation") === "none",
        );
        expect(stops, selector).toHaveLength(1);
      }
    }
  });
});

describe("見出しの大きさ", () => {
  const sizeAt = (condition?: string) => {
    const rule = rulesFor(RULES, ".section-title .title").find((r) =>
      condition === undefined
        ? r.conditions.length === 0
        : hasCondition(r, condition),
    );
    return rule && valueIn(rule, "font-size");
  };

  it("文字の大きさは .section-title .title に、幅の境ごとに 30px、40px、52px で書く", () => {
    expect(sizeAt()).toBe("30px");
    expect(sizeAt("@media (min-width: 768px)")).toBe("40px");
    expect(sizeAt("@media (min-width: 900px)")).toBe("52px");
  });

  it("見出しの規則は .lg・.md・.link のクラスを使わない", () => {
    const stale = RULES.flatMap((rule) => rule.selectors).filter((selector) =>
      /\.(lg|md|link)\b/.test(selector),
    );
    expect(stale).toEqual([]);
  });
});
