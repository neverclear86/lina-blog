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

/** Removes the `@media` blocks of a CSS text, which leaves the rules that apply at every width. */
function withoutMedia(css: string): string {
  return css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, "");
}

/** The rules of the `<style>` of the header that apply at every width. */
const base = withoutMedia(style);

/** The markup of the header, that is, the file without the frontmatter, `<style>` and `<script>`. */
const markup = header.slice(
  header.indexOf("<header"),
  header.indexOf("</header>"),
);

/** The `<script>` of the header. */
const script = header.slice(header.indexOf("<script>"));

/** Returns the declarations of the rule with `selector` in `css`, or fails. */
function body(css: string, selector: string): string {
  const rule = rulesOf(css).find((r) => r.selector.endsWith(selector));
  if (!rule) throw new Error(`no rule for ${selector}`);
  return rule.body;
}

describe("SiteHeader の 1024px 以上", () => {
  it("現在地のナビは --keyword の地に --ink の太い文字で、ホバーでも変わらない", () => {
    const rule = rulesOf(wide).find((r) =>
      r.selector.includes(".ws[aria-current]:is(:hover, :focus-visible)"),
    );
    expect(rule?.selector).toContain(".site-nav .ws[aria-current],");
    expect(rule?.body).toContain("background: var(--keyword)");
    expect(rule?.body).toContain("color: var(--ink)");
    expect(rule?.body).toContain("font-weight: 700");
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

describe("SiteHeader の全幅", () => {
  it("ヘッダーは幅によらず sticky で、--hdr の地と --line の線と blur を持つ", () => {
    const rule = body(base, ".site-header");
    expect(rule).toContain("position: sticky");
    expect(rule).toContain("top: 0");
    expect(rule).toContain("z-index: 50");
    expect(rule).toContain("border-bottom: 1px solid var(--line)");
    expect(rule).toContain("background: var(--hdr)");
    expect(rule).toContain("backdrop-filter: blur(10px)");
  });

  it("バーは上下 8px の余白と 44px のボタンで 61px の高さになる", () => {
    const bar = body(base, ".bar");
    expect(bar).toContain("max-width: 1440px");
    expect(bar).toContain("margin: 0 auto");
    expect(bar).toContain("padding: 8px var(--gutter)");
    expect(body(base, ".brand")).toContain("height: 44px");
    expect(body(base, ".brand")).toContain("width: 82px");
    expect(body(wide, ".brand")).toContain("width: 92px");
    expect(body(base, ".site-header")).toContain("--gutter: 16px");
    const media768 = style.slice(
      style.indexOf("@media (min-width: 768px)"),
      style.indexOf("@media (max-width: 1023px)"),
    );
    expect(body(media768, ".site-header")).toBe("--gutter: 32px;");
    const controls = source("styles/controls.css");
    const button = body(controls, ".sq, .iconbtn");
    expect(button).toContain("width: 44px");
    expect(button).toContain("height: 44px");
    expect(button).toContain("border: 1px solid var(--line2)");
  });

  it("メニューのボタンは .iconbtn.iconbtn-acc で、名前は menu.label、押すと site-menu を開く", () => {
    expect(markup).toContain('class="iconbtn iconbtn-acc menu-toggle"');
    expect(markup).toContain('aria-label={translate(lang, "menu.label")}');
    expect(markup).toContain('popovertarget="site-menu"');
    expect(markup).toContain('<path d="M4 7h16M4 12h16M4 17h10"></path>');
    expect(markup).toContain('<path d="M6 6l12 12M18 6L6 18"></path>');
    expect(markup).toContain('stroke-linecap="square"');
  });

  it("テーマのボタンは .iconbtn で、IconButton を使わない", () => {
    const toggle = source("components/ThemeToggle.astro");
    expect(toggle).toContain(
      '<button class="theme-toggle iconbtn" type="button">',
    );
    expect(toggle).not.toContain("IconButton");
    expect(header).not.toContain("IconButton");
  });

  it("ヘッダーの下 61px から伸びる --bg の不透明なシートで、高さは残りまで", () => {
    const rule = body(base, ".menu-panel");
    expect(rule).toContain("position: fixed");
    expect(rule).toContain("inset: 61px 0 auto");
    expect(rule).toContain("max-height: calc(100dvh - 61px)");
    expect(rule).toContain("background: var(--bg)");
    expect(rule).toContain("overflow-y: auto");
  });

  it("ナビの行は高さ 48px の等幅で、現在地の行は --keyword の地と --ink の文字にする", () => {
    const row = body(base, ".menu-nav a");
    expect(row).toContain("height: 48px");
    expect(row).toContain("font-family: var(--font-mono)");
    expect(row).toContain("font-size: 14px");
    expect(body(base, ".menu-nav a + a")).toContain(
      "border-top: 1px solid var(--line)",
    );
    expect(body(base, ".menu-nav a:focus-visible")).toContain(
      "outline-offset: -2px",
    );
    const current = rulesOf(base).find((r) =>
      r.selector.startsWith(".menu-nav a[aria-current],"),
    );
    expect(current?.body).toContain("background: var(--keyword)");
    expect(current?.body).toContain("color: var(--ink)");
    expect(current?.body).toContain("font-weight: 700");
  });

  it("お問い合わせは .btn.btn-acc を全幅で置く", () => {
    expect(markup).toContain(
      '<a class="btn btn-acc" href={homeSectionPath(lang, "contact")}>',
    );
    expect(body(base, ".menu-contact .btn")).toContain("display: flex");
    expect(body(base, ".menu-contact .btn")).toContain("flex: 1");
  });

  it("日本語だけのページの JA に lang.jaOnly を添える", () => {
    const menu = markup.slice(markup.indexOf('class="menu-languages"'));
    expect(menu).toContain('translate(lang, "lang.jaOnly")');
    expect(menu).toContain("languages.length === 1");
  });

  it("色は A案のトークンだけで、--fg・--hair・--pink・--legacy-* を使わない", () => {
    expect(style).not.toMatch(/--(fg|hair|pink|legacy-)/);
    expect(source("components/ThemeToggle.astro")).not.toMatch(
      /--(fg|hair|pink|legacy-)/,
    );
    expect(rulesOf(style).filter((r) => r.selector === "a")).toEqual([]);
  });

  it("メニューを閉じる script は、リンクを押したときと、フォーカスがヘッダーの外の要素に入ったときに閉じる", () => {
    expect(script).toContain('link.addEventListener("click"');
    expect(script).toContain('document.addEventListener("focusin"');
    expect(script).toContain("!header?.contains(event.target)");
    expect(script).not.toContain("focusout");
    expect(script.match(/hidePopover\(\)/g)).toHaveLength(2);
  });
});

describe("global.css の scroll-margin-top", () => {
  it("section[id] と #blog は幅によらずヘッダーの下 72px で止まる", () => {
    const css = source("styles/global.css");
    expect(
      rulesOf(withoutMedia(css)).map((r) => [r.selector, r.body]),
    ).toContainEqual([
      expect.stringContaining("section[id], #blog"),
      "scroll-margin-top: 72px;",
    ]);
    expect(css.match(/scroll-margin-top/g)).toHaveLength(1);
    expect(withoutMedia(css)).toContain("scroll-margin-top: 72px");
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
