import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/** Reads a file under `src/` without its CSS comments. */
function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
}

interface Rule {
  selector: string;
  body: string;
}

/** Returns the rules of a CSS text, with the whitespace of each selector collapsed. */
function rulesOf(text: string): Rule[] {
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].replace(/\s+/g, " ").trim(),
    body: match[2].replace(/\s+/g, " ").trim(),
  }));
}

const header = source("components/SiteHeader.astro");
const style = header.slice(
  header.indexOf("<style>"),
  header.indexOf("</style>"),
);

/** The part of the `<style>` of the header that is inside `@media (min-width: 1024px)`. */
const wide = style.slice(style.indexOf("@media (min-width: 1024px)"));

/** Returns the declarations of the rule with `selector` in `css`, or fails. */
function body(css: string, selector: string): string {
  const rule = rulesOf(css).find((r) => r.selector.endsWith(selector));
  if (!rule) throw new Error(`no rule for ${selector}`);
  return rule.body;
}

describe("SiteHeader の 1024px 以上", () => {
  it("上端に貼り付き、--hdr の地を blur し、--line の線を下に引く", () => {
    const rule = body(wide, ".site-header");
    expect(rule).toContain("position: sticky");
    expect(rule).toContain("top: 0");
    expect(rule).toContain("z-index: 50");
    expect(rule).toContain("border-bottom: 1px solid var(--line)");
    expect(rule).toContain("background: var(--hdr)");
    expect(rule).toContain("backdrop-filter: blur(10px)");
  });

  it("中身は 1440px までで、左右に 32px、上下に 8px の余白を取る", () => {
    const rule = body(wide, ".bar");
    expect(rule).toContain("max-width: 1440px");
    expect(rule).toContain("padding: 8px 32px");
  });

  it("現在地のナビは --keyword の地に --ink の太い文字で、ホバーでも変わらない", () => {
    const rule = rulesOf(wide).find((r) =>
      r.selector.includes(".ws[aria-current]:is(:hover, :focus-visible)"),
    );
    expect(rule?.selector).toContain(".site-nav .ws[aria-current],");
    expect(rule?.body).toContain("background: var(--keyword)");
    expect(rule?.body).toContain("color: var(--ink)");
    expect(rule?.body).toContain("font-weight: 700");
  });

  it("要素名だけの a に色を付けず、--fg はロゴとメニューのリンクにだけ付ける", () => {
    const rules = rulesOf(style);
    expect(rules.filter((r) => r.selector === "a")).toEqual([]);
    expect(
      rules.find((r) => r.selector === ".brand, .menu-panel a")?.body,
    ).toBe("color: var(--fg);");
  });

  it("JS が無いときの 00 top は、ホバー・フォーカスでも --ink の文字のまま", () => {
    const rule = rulesOf(wide).find((r) =>
      r.selector.includes(".ws[aria-current]:is(:hover, :focus-visible)"),
    );
    expect(rule?.selector).toContain(
      ".site-nav .ws.on:is(:hover, :focus-visible)",
    );
  });

  it("backdrop-filter は接頭辞なしの 1 行だけで、CSS の出力で消されない", () => {
    expect(style).not.toContain("-webkit-backdrop-filter");
    expect(style.match(/backdrop-filter/g)).toHaveLength(1);
  });
});

describe("global.css の scroll-margin-top", () => {
  it("ヘッダーが貼り付く 1024px 以上だけ、節とブログの着地を 72px 下げる", () => {
    const css = source("styles/global.css");
    const media = css.slice(css.indexOf("@media (min-width: 1024px)"));
    expect(rulesOf(media).map((r) => [r.selector, r.body])).toEqual([
      [
        expect.stringContaining("section[id], #blog"),
        "scroll-margin-top: 72px;",
      ],
    ]);
    expect(css.match(/scroll-margin-top/g)).toHaveLength(1);
  });
});

describe("SiteHeader のトップの現在地の印", () => {
  const rules = rulesOf(style);
  const rule = (selector: string) => rules.find((r) => r.selector === selector);

  it("--nav-index に 96px を掛けて動き、--keyword の地で、追従の前は出さない", () => {
    const ind = rule(".nav-ind")?.body;
    expect(ind).toContain(
      "transform: translateX(calc(var(--nav-index, 0) * 96px))",
    );
    expect(ind).toContain("background: var(--keyword)");
    expect(ind).toContain("display: none");
    expect(rule(".site-nav.following .nav-ind")?.body).toContain(
      "display: block",
    );
  });

  it("追従の間、現在地の項目は地を持たず、印の地が見える", () => {
    expect(rule(".site-nav.following .ws[aria-current]")?.body).toContain(
      "background: transparent;",
    );
  });

  it("追従の間の現在地の規則は、#308 の現在地の規則より後ろにある", () => {
    const index = (match: (r: Rule) => boolean) => rules.findIndex(match);
    expect(
      index((r) => r.selector === ".site-nav.following .ws[aria-current]"),
    ).toBeGreaterThan(
      index((r) =>
        r.selector.includes(".ws[aria-current]:is(:hover, :focus-visible)"),
      ),
    );
  });

  it(".nav-ind の規則は transition を持たず、.site-nav.ready .nav-ind だけが持つ", () => {
    expect(rule(".nav-ind")?.body).not.toContain("transition");
    expect(rule(".site-nav.ready .nav-ind")?.body).toContain(
      "transition: transform 0.4s",
    );
  });

  it("prefers-reduced-motion: reduce で印の移動と項目の文字の色の変化を止める", () => {
    expect(
      rule(".site-nav.ready .nav-ind, .site-nav[data-follow] .ws")?.body,
    ).toBe("transition: none;");
  });

  it("印の移動と項目の文字の色には、止める前の transition がある", () => {
    expect(rule(".site-nav.ready .nav-ind")?.body).toContain("transform 0.4s");
    expect(rule(".site-nav[data-follow] .ws")?.body).toContain(
      "transition: color 0.25s",
    );
  });
});
