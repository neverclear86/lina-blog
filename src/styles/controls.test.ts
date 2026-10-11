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

const SRC = new URL("../", import.meta.url);

const REDUCE = "@media (prefers-reduced-motion: reduce)";

/** Returns a file under `src/` as text. */
function read(path: string): string {
  return readFileSync(new URL(path, SRC), "utf8");
}

/** Returns the rules of `src/styles/<name>`. */
function cssFile(name: string): CssRule[] {
  return parseCss(read(`styles/${name}`));
}

/** Returns the rules of the `<style>` of the `.astro` file `path` under `src/`. */
function astroStyle(path: string): CssRule[] {
  return parseCss(cssOfAstro(read(path)));
}

/** Returns the one rule outside `REDUCE` that has `selector` among its selectors, or fails. */
function only(rules: CssRule[], selector: string): CssRule {
  const found = rulesFor(rules, selector).filter(
    (rule) => !hasCondition(rule, REDUCE),
  );
  expect(found, selector).toHaveLength(1);
  return found[0];
}

/** Returns the selectors of `rule` as one text, however the list is split. */
function selectorText(rule: CssRule): string {
  return rule.selectors.join(", ");
}

const GLOBAL = cssFile("global.css");
const CONTROLS = cssFile("controls.css");
const WINDOW = cssFile("window.css");
const LABELS = cssFile("labels.css");
const ARTICLE_CSS = parseCss(read("markdown/article.css"));

/** A color written as one token, such as `var(--text)`. */
const TOKEN = /^var\(--[\w-]+\)$/;

/** The states a control shows alike: the pointer, the keyboard and the two sample classes. */
const STATES = [":hover", ":focus-visible", ".is-hover", ".is-focus"];

describe("リンクのホバー", () => {
  it("リンクの規則はすべて :where の中にあり、部品のクラスの規則が常に勝つ", () => {
    const bareA = /(^|[\s,>+~(])a(?![\w-])/;
    const selectors = GLOBAL.flatMap((rule) => rule.selectors);
    expect(selectors.filter((selector) => bareA.test(selector))).not.toEqual(
      [],
    );
    // A `:where()` holds selectors with one level of parentheses, such as `:not([…])`.
    const outside = selectors.map((selector) =>
      selector.replace(/:where\((?:[^()]|\([^()]*\))*\)/g, ""),
    );
    expect(outside.filter((selector) => bareA.test(selector))).toEqual([]);
  });

  it("ライトのホバーとフォーカスは色に頼らず下線で示し、見本の状態も同じ規則に載る", () => {
    const found = GLOBAL.filter(
      (rule) => valueIn(rule, "text-decoration-line") === "underline",
    );
    expect(found).toHaveLength(1);
    for (const state of STATES) {
      expect(selectorText(found[0])).toContain(state);
    }
    expect(valueIn(found[0], "text-decoration-color")).toMatch(TOKEN);
  });

  it("ダークのホバーとフォーカスは文字の色で示して下線を消し、その規則はライトの規則より後にある", () => {
    const light = GLOBAL.findIndex(
      (rule) => valueIn(rule, "text-decoration-line") === "underline",
    );
    const found = GLOBAL.filter(
      (rule) =>
        valueIn(rule, "text-decoration-line") === "none" &&
        selectorText(rule).includes('[data-theme="dark"]'),
    );
    expect(found).toHaveLength(1);
    for (const state of STATES) {
      expect(selectorText(found[0])).toContain(state);
    }
    expect(valueIn(found[0], "color")).toMatch(TOKEN);
    expect(GLOBAL.indexOf(found[0])).toBeGreaterThan(light);
  });

  it("global.css と controls.css の hover の規則は、フォーカスと見本の状態も同じ規則に持つ", () => {
    for (const [name, rules] of [
      ["global.css", GLOBAL],
      ["controls.css", CONTROLS],
    ] as const) {
      const hover = rules.filter((rule) =>
        /:hover|\.is-hover/.test(selectorText(rule)),
      );
      expect(hover.length, name).toBeGreaterThan(0);
      for (const rule of hover) {
        for (const state of STATES) {
          expect(selectorText(rule), name).toContain(state);
        }
      }
    }
  });
});

describe("body", () => {
  it("body の文字色はトークンで、テーマの切り替えに transition を使わない", () => {
    const rules = rulesFor(GLOBAL, "body");
    const colored = rules.filter(
      (rule) => valueIn(rule, "color") !== undefined,
    );
    expect(colored).toHaveLength(1);
    expect(valueIn(colored[0], "color")).toMatch(TOKEN);
    expect(
      rules
        .flatMap((rule) => rule.declarations)
        .filter((d) => d.property.startsWith("transition")),
    ).toEqual([]);
  });
});

describe("フォーカスの輪", () => {
  it("global.css は --focus-ring の輪を :focus-visible と .is-focus に描く", () => {
    const found = GLOBAL.filter((rule) =>
      valueIn(rule, "outline")?.includes("var(--focus-ring)"),
    );
    expect(found).toHaveLength(1);
    expect(selectorText(found[0])).toContain(":focus-visible");
    expect(selectorText(found[0])).toContain(".is-focus");
  });
});

describe("ボタンとアイコンのリンク", () => {
  it("地を塗るボタンは、地と一緒に文字の色をトークンで持つ", () => {
    for (const selector of [".btn-acc", ".btn-ink", ".iconbtn-acc", ".ws.on"]) {
      const rule = only(CONTROLS, selector);
      expect(valueIn(rule, "background"), selector).toMatch(TOKEN);
      expect(valueIn(rule, "color"), selector).toMatch(TOKEN);
    }
  });

  it(".btn と .ws は下線を自分で消し、:where の下線の規則に頼らない", () => {
    for (const selector of [".btn", ".ws"]) {
      expect(valueIn(only(CONTROLS, selector), "text-decoration")).toBe("none");
    }
  });

  it(".ws.on は .ws のホバーの規則より後にあり、ホバーでも地を変えない", () => {
    const hover = CONTROLS.filter(
      (rule) =>
        /\.ws(?![\w-])/.test(selectorText(rule)) &&
        selectorText(rule).includes(":hover") &&
        valueIn(rule, "background") !== undefined,
    );
    expect(hover.length).toBeGreaterThan(0);
    const current = only(CONTROLS, ".ws.on");
    for (const rule of hover) {
      expect(CONTROLS.indexOf(current)).toBeGreaterThan(CONTROLS.indexOf(rule));
    }
  });

  it("controls.css と global.css は !important を使わない", () => {
    for (const [name, rules] of [
      ["controls.css", CONTROLS],
      ["global.css", GLOBAL],
    ] as const) {
      const found = rules.flatMap((rule) =>
        rule.declarations
          .filter((d) => d.value.includes("!important"))
          .map((d) => `${selectorText(rule)} { ${d.property} }`),
      );
      expect(found, name).toEqual([]);
    }
  });
});

describe("配線", () => {
  it("記事一覧の頭は PageHead の中にパンくずと h1 と絞り込みを置き、絞り込みのリンクに .ws と現在地の .on を付ける", () => {
    const index = read("components/BlogIndex.astro");
    const head = index.slice(
      index.indexOf("<PageHead>"),
      index.indexOf("</PageHead>"),
    );
    expect(head).toContain("<Breadcrumb ");
    expect(head).toContain("<h1>");
    expect(head).toContain('class="filter"');
    expect(head).toContain('class:list={["ws", { on: link.current }]}');
    expect(head).toContain('aria-current={link.current ? "page" : undefined}');
  });

  it("ブラウザーの既定の下線に頼っていた 404 ページのリンクは自分で下線を持つ", () => {
    const link = only(astroStyle("pages/404.astro"), "p a");
    expect(valueIn(link, "text-decoration")).toBe("underline");
  });

  it("404 ページの戻るボタン .btn-acc の色と下線を、ページの a の規則が上書きしない", () => {
    const selectors = astroStyle("pages/404.astro").flatMap(
      (rule) => rule.selectors,
    );
    expect(selectors).not.toContain("a");
    expect(read("pages/404.astro")).toContain('class="btn btn-acc back"');
  });
});

describe("記事の本文のリンク", () => {
  it("記事の本文のリンクには下線が付く", () => {
    const link = only(ARTICLE_CSS, ".article-body a");
    expect(valueIn(link, "text-decoration-line")).toBe("underline");
  });
});

/** The files of the cards whose title is underlined, with the selector of the card's link. */
const CARDS = [
  ["components/PostRows.astro", ".row"],
  ["components/PostNav.astro", ".item"],
  ["components/LatestVideoFeature.astro", ".feature"],
] as const;

describe("カードのタイトル", () => {
  it("カードのリンクは自分に下線を引かず、部品はタイトルの下線の規則を持たない", () => {
    for (const [path, link] of CARDS) {
      const rules = astroStyle(path);
      expect(
        rulesFor(rules, link)
          .map((rule) => valueIn(rule, "text-decoration"))
          .filter((value) => value !== undefined),
        path,
      ).toEqual(["none"]);
      const decorated = rules.filter((rule) =>
        rule.declarations.some(
          (declaration) =>
            declaration.property.startsWith("text-decoration") &&
            declaration.value !== "none",
        ),
      );
      expect(decorated, path).toEqual([]);
    }
  });

  it("カードのタイトルはすべて .link-title を持つ", () => {
    for (const [path] of CARDS) {
      const titles = read(path).match(/<strong class="title[^"]*"/g) ?? [];
      expect(titles.length, path).toBeGreaterThan(0);
      for (const title of titles) {
        expect(title, path).toBe('<strong class="title link-title"');
      }
    }
  });

  it("ライトのホバーとフォーカスではタイトルにだけ下線を引く規則が、リンクの下線の規則に並ぶ", () => {
    const found = GLOBAL.filter(
      (rule) => valueIn(rule, "text-decoration-line") === "underline",
    );
    expect(found).toHaveLength(1);
    expect(found[0].selectors).toHaveLength(1);
    expect(selectorText(found[0])).toContain(
      ':root:not([data-theme="dark"]) a:is(:hover, :focus-visible, .is-hover, .is-focus) .link-title',
    );
  });
});

describe("カテゴリのチップ", () => {
  it("767px までの小さい寸法は labels.css の 1 つの規則が持ち、基本の規則より後にある", () => {
    const chips = rulesFor(LABELS, ".chip-acc");
    const base = chips.filter((rule) => rule.conditions.length === 0);
    expect(base).toHaveLength(1);
    const small = chips.filter((rule) =>
      hasCondition(rule, "@media (max-width: 767px)"),
    );
    expect(small).toHaveLength(1);
    expect(valueIn(small[0], "padding")).toBe("3px 8px");
    expect(valueIn(small[0], "font-size")).toBe("11px");
    expect(LABELS.indexOf(small[0])).toBeGreaterThan(LABELS.indexOf(base[0]));
  });

  it("使い手は寸法を写さない", () => {
    for (const path of [
      "pages/blog/[slug].astro",
      "components/SponsorNotice.astro",
    ]) {
      const sizes = rulesFor(astroStyle(path), ".chip-acc").flatMap((rule) =>
        rule.declarations.filter(
          (declaration) =>
            declaration.property === "padding" ||
            declaration.property === "font-size",
        ),
      );
      expect(sizes, path).toEqual([]);
    }
  });
});

describe("記事のアコーディオン", () => {
  const SELECTORS = {
    ring: ".article-body details::before",
    hover: ".article-body details:has(> summary:hover)::before",
    focus: ".article-body details:has(> summary:focus-visible)::before",
  };

  it("details の地と輪は .win の規則と同じ規則で描く", () => {
    expect(only(WINDOW, ".win").selectors).toContain(".article-body details");
    expect(only(WINDOW, ".win::before").selectors).toContain(SELECTORS.ring);
  });

  it("summary のホバーとキーボードのフォーカスは同じ規則で輪を回す", () => {
    const turn = rulesFor(WINDOW, SELECTORS.hover).filter(
      (rule) => !hasCondition(rule, REDUCE),
    );
    expect(turn.length).toBeGreaterThan(0);
    for (const rule of turn) {
      expect(rule.selectors).toContain(SELECTORS.focus);
    }
  });

  it("開閉は <details> に任せ、ArticleBody のスクリプトは details に触れない", () => {
    const scripts =
      read("components/ArticleBody.astro").match(
        /<script>[\s\S]*?<\/script>/g,
      ) ?? [];
    expect(scripts).toHaveLength(1);
    expect(scripts[0]).not.toMatch(/details|summary/);
  });
});

describe("記事のメッセージボックス", () => {
  /** The selector that `window.css` and `labels.css` share with `.win` and `.label`. */
  const SHARED = ":where(.article-body aside:is(.note, .warning))";

  it("window.css は .win の地の規則と輪の規則に記事のメッセージボックスを足している", () => {
    expect(only(WINDOW, ".win").selectors).toContain(SHARED);
    expect(only(WINDOW, ".win::before").selectors).toContain(
      `${SHARED}::before`,
    );
  });

  it("labels.css は .label の規則にメッセージボックスの ::after を足している", () => {
    expect(only(LABELS, ".label").selectors).toContain(`${SHARED}::after`);
  });

  it("ラベルの語は ::after の content で、読み上げには # を除いた同じ語を渡す", () => {
    for (const kind of ["note", "warning"]) {
      const label = only(ARTICLE_CSS, `.article-body aside.${kind}::after`);
      expect(valueIn(label, "content"), kind).toMatch(/^"#+ (.+)" \/ "\1"$/);
    }
  });

  it("背景は縞や顔を重ねても、最後の層が地の --panel になる", () => {
    const boxes = ARTICLE_CSS.filter(
      (rule) =>
        selectorText(rule).includes("aside") &&
        valueIn(rule, "background") !== undefined,
    );
    expect(boxes.length).toBeGreaterThan(0);
    for (const rule of boxes) {
      expect(valueIn(rule, "background"), selectorText(rule)).toMatch(
        /var\(--panel\)$/,
      );
    }
  });
});
