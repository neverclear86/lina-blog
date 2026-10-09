import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SOURCE = readFileSync(
  new URL("./SectionTitle.astro", import.meta.url),
  "utf8",
);

/** The CSS of the component without its comments. */
const CSS = SOURCE.slice(SOURCE.indexOf("<style>")).replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Returns the block that starts with `start`, from `start` to its closing brace. */
const block = (text: string, start: string) => {
  const from = text.indexOf(start);
  expect(from).toBeGreaterThanOrEqual(0);
  const open = text.indexOf("{", from);
  let depth = 0;
  for (let i = open; i < text.length; i++) {
    if (text[i] === "{") depth++;
    if (text[i] === "}") depth--;
    if (depth === 0) return text.slice(from, i + 1);
  }
  throw new Error(`The block of ${start} is not closed`);
};

const squash = (text: string) => text.replace(/\s+/g, " ").trim();

const SUPPORTS = block(CSS, "@supports (animation-timeline: view())");
const KEYFRAMES = block(CSS, "@keyframes rule-draw");
const REDUCE = block(CSS, "@media (prefers-reduced-motion: reduce)");

describe("見出しの線の描画", () => {
  it("スクロールで左から描く規則は @supports と @media screen の中にだけある", () => {
    expect(squash(SUPPORTS)).toMatch(
      /^@supports \(animation-timeline: view\(\)\) \{ @media screen \{ \.rule \{/,
    );
    for (const declaration of [
      "transform-origin: left center;",
      "animation: rule-draw linear both;",
      "animation-timeline: view();",
      "animation-range: entry 0% cover 35%;",
    ]) {
      expect(SUPPORTS).toContain(declaration);
    }
    const rest = CSS.replace(SUPPORTS, "")
      .replace(KEYFRAMES, "")
      .replace(REDUCE, "");
    expect(rest).not.toMatch(/animation/);
    expect(rest).not.toMatch(/transform/);
  });

  it("rule-draw は scaleX(0) から scaleX(1) まで", () => {
    expect(squash(KEYFRAMES)).toBe(
      "@keyframes rule-draw { from { transform: scaleX(0); } to { transform: scaleX(1); } }",
    );
  });

  it("動きを減らす設定では描かず、@supports の規則より後ろで animation を止める", () => {
    expect(squash(REDUCE)).toBe(
      "@media (prefers-reduced-motion: reduce) { .rule { animation: none; } }",
    );
    expect(CSS.indexOf(REDUCE)).toBeGreaterThan(CSS.indexOf(SUPPORTS));
  });
});
