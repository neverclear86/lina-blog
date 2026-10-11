import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  cssOfAstro,
  hasCondition,
  parseCss,
  rulesFor,
  valueIn,
} from "../test/css-source";

/** Reads a file under `src/` without its CSS comments. */
function source(path: string): string {
  return readFileSync(new URL(`../${path}`, import.meta.url), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
}

const header = source("components/SiteHeader.astro");
const RULES = parseCss(cssOfAstro(header));
const REDUCE = "@media (prefers-reduced-motion: reduce)";

/** A color written as one token, such as `var(--text)`. */
const TOKEN = /^var\(--[\w-]+\)$/;

/** The markup of the header, that is, the file without the frontmatter, `<style>` and `<script>`. */
const markup = header.slice(
  header.indexOf("<header"),
  header.indexOf("</header>"),
);

/** The `<script>` of the header. */
const script = header.slice(header.indexOf("<script>"));

describe("SiteHeader の現在地のナビ", () => {
  it("現在地のナビは地と文字の色をトークンで指し、ホバー・フォーカス・JS が無いときの 00 top でも変わらない", () => {
    const [current] = rulesFor(RULES, ".site-nav .ws[aria-current]");
    expect(current.selectors).toEqual(
      expect.arrayContaining([
        ".site-nav .ws[aria-current]:is(:hover, :focus-visible)",
        ".site-nav .ws.on:is(:hover, :focus-visible)",
      ]),
    );
    expect(valueIn(current, "background")).toMatch(TOKEN);
    expect(valueIn(current, "color")).toMatch(TOKEN);
  });

  it("backdrop-filter は接頭辞なしの 1 行だけで、CSS の出力で消されない", () => {
    const properties = RULES.flatMap((rule) =>
      rule.declarations.map((d) => d.property),
    );
    expect(properties.filter((p) => p === "backdrop-filter")).toHaveLength(1);
    expect(properties).not.toContain("-webkit-backdrop-filter");
  });
});

describe("SiteHeader の全幅", () => {
  it("メニューのボタンは menu.label を名前に持ち、押すと popover の site-menu を開く", () => {
    expect(markup).toContain('aria-label={translate(lang, "menu.label")}');
    expect(markup).toContain('popovertarget="site-menu"');
    expect(markup).toMatch(/<div\s+id="site-menu"[^>]*\spopover[\s>]/);
  });

  it("閉じた popover は UA の display で隠れ、幅の条件の無い .menu-panel の規則は display を持たない", () => {
    const base = rulesFor(RULES, ".menu-panel").filter(
      (rule) => rule.conditions.length === 0,
    );
    expect(base.length).toBeGreaterThan(0);
    for (const rule of base) {
      expect(valueIn(rule, "display")).toBeUndefined();
    }
  });

  it("メニューの行のフォーカスの輪は、行の内側に描く", () => {
    const [focus] = rulesFor(RULES, ".menu-nav a:focus-visible");
    expect(valueIn(focus, "outline-offset")).toMatch(/^-/);
  });

  it("ヘッダーは ThemeToggle を言語の切り替えとお問い合わせの間に 1 つだけ置く", () => {
    expect(markup.match(/<ThemeToggle/g)).toHaveLength(1);
    const toggle = markup.indexOf("<ThemeToggle");
    expect(toggle).toBeGreaterThan(markup.indexOf('class="languages"'));
    expect(toggle).toBeLessThan(markup.indexOf('class="btn btn-acc contact"'));
  });

  it("お問い合わせのリンクは、ヘッダーとメニューのどちらも aria-current を持つ", () => {
    const links = markup.match(
      /<a\b[^>]*\bhref=\{contactPagePath\(lang\)\}[^>]*>/g,
    );
    expect(links).toHaveLength(2);
    for (const link of links ?? []) {
      expect(link).toContain("aria-current={contactCurrent}");
    }
  });

  it("日本語だけのページの JA に lang.jaOnly を添える", () => {
    const menu = markup.slice(markup.indexOf('class="menu-languages"'));
    expect(menu).toContain('translate(lang, "lang.jaOnly")');
    expect(menu).toContain("languages.length === 1");
  });

  it("ヘッダーの style は要素名だけの a の規則を持たない", () => {
    expect(RULES.filter((rule) => rule.selectors.includes("a"))).toEqual([]);
  });

  it("メニューを閉じる script は、リンクを押したときと、フォーカスがヘッダーの外の要素に入ったときに閉じる", () => {
    expect(script).toContain('link.addEventListener("click"');
    expect(script).toContain('document.addEventListener("focusin"');
    expect(script).toContain("!header?.contains(event.target)");
    expect(script).not.toContain("focusout");
    expect(script.match(/hidePopover\(\)/g)).toHaveLength(2);
  });

  it("メニューのボタンの aria-expanded は、script が読み込み時と popover の toggle で更新する", () => {
    expect(markup).not.toContain("aria-expanded");
    expect(script).toMatch(/menu\?\.addEventListener\(\s*"toggle"/);
    expect(script).toMatch(/setAttribute\(\s*"aria-expanded"/);
    expect(script).toContain('menu?.matches(":popover-open")');
    expect(script).toMatch(/^syncExpanded\(\);$/m);
  });
});

describe("ThemeToggle", () => {
  const toggle = source("components/ThemeToggle.astro");
  const rules = parseCss(cssOfAstro(toggle));
  const dark = ':global(:root[data-theme="dark"])';

  /** Returns the `display` that the first rule with `selector` declares, if any. */
  const displayOf = (selector: string) => {
    const [rule] = rulesFor(rules, selector);
    return rule && valueIn(rule, "display");
  };

  it("名前は切り替え先を言い、ライトでは to-dark、ダークでは to-light だけを出す", () => {
    expect(toggle).toContain(
      '<span class="to-dark">{translate(lang, "theme.toDark")}</span>',
    );
    expect(toggle).toContain(
      '<span class="to-light">{translate(lang, "theme.toLight")}</span>',
    );
    expect(displayOf(".to-light")).toBe("none");
    expect(displayOf(".to-dark")).toBeUndefined();
    expect(displayOf(`${dark} .to-dark`)).toBe("none");
    expect(displayOf(`${dark} .to-light`)).toBeDefined();
    expect(displayOf(`${dark} .to-light`)).not.toBe("none");
  });

  it("アイコンは、ライトでは太陽、ダークでは月だけを出す", () => {
    expect(displayOf(".moon")).toBe("none");
    expect(displayOf(".sun")).toBeUndefined();
    expect(displayOf(`${dark} .sun`)).toBe("none");
    expect(displayOf(`${dark} .moon`)).toBeDefined();
    expect(displayOf(`${dark} .moon`)).not.toBe("none");
  });
});

describe("global.css の scroll-padding", () => {
  it("ページは幅によらず scroll-padding を 1 か所に持ち、要素の scroll-margin は持たない", () => {
    const global = parseCss(source("styles/global.css"));
    const declared = global.filter((rule) =>
      rule.declarations.some((d) => d.property.startsWith("scroll-padding")),
    );
    expect(declared).toHaveLength(1);
    expect(declared[0].selectors).toEqual(["html"]);
    expect(declared[0].conditions).toEqual([]);
    expect(
      global.some((rule) =>
        rule.declarations.some((d) => d.property.startsWith("scroll-margin")),
      ),
    ).toBe(false);
    expect(source("components/ArticleBody.astro")).not.toContain(
      "scroll-margin",
    );
    expect(source("markdown/article.css")).not.toContain("scroll-margin");
  });
});

describe("SiteHeader のトップの現在地の印", () => {
  it("印は追従が始まるまで出さない", () => {
    const [mark] = rulesFor(RULES, ".nav-ind");
    expect(valueIn(mark, "display")).toBe("none");
    const [following] = rulesFor(RULES, ".site-nav.following .nav-ind");
    expect(valueIn(following, "display")).toBeDefined();
    expect(valueIn(following, "display")).not.toBe("none");
  });

  it("追従の間の現在地の項目の地は、現在地の規則より後ろで置き換える", () => {
    const [current] = rulesFor(RULES, ".site-nav.following .ws[aria-current]");
    expect(valueIn(current, "background")).toBeDefined();
    // On hover and focus, the current item matches both rules with the same specificity, so the
    // replacement comes last.
    const [shown] = rulesFor(RULES, ".site-nav .ws[aria-current]");
    expect(RULES.indexOf(current)).toBeGreaterThan(RULES.indexOf(shown));
  });

  it(".nav-ind の規則は transition を持たず、.site-nav.ready .nav-ind だけが持つ", () => {
    for (const rule of rulesFor(RULES, ".nav-ind")) {
      expect(valueIn(rule, "transition")).toBeUndefined();
    }
    const [ready] = rulesFor(RULES, ".site-nav.ready .nav-ind");
    expect(valueIn(ready, "transition")).toBeDefined();
  });

  it("transition のある規則のセレクタは、それより後ろの reduce の中でそれぞれ transition: none になる", () => {
    const moving = RULES.filter(
      (rule) =>
        !hasCondition(rule, REDUCE) &&
        valueIn(rule, "transition") !== undefined,
    );
    expect(moving.length).toBeGreaterThan(0);
    for (const rule of moving) {
      for (const selector of rule.selectors) {
        const stops = rulesFor(RULES, selector).filter(
          (r) =>
            hasCondition(r, REDUCE) &&
            RULES.indexOf(r) > RULES.indexOf(rule) &&
            valueIn(r, "transition") === "none",
        );
        expect(stops, selector).toHaveLength(1);
      }
    }
  });
});
