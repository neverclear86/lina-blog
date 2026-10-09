import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const SRC = new URL("../", import.meta.url);

/** Reads a file under `src/` without its CSS comments. */
function source(path: string): string {
  return readFileSync(new URL(path, SRC), "utf8").replace(
    /\/\*[\s\S]*?\*\//g,
    "",
  );
}

interface Rule {
  selector: string;
  body: string;
}

/** Returns the contents of the `<style>` elements of an `.astro` source. */
function styleOf(text: string): string {
  return [...text.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/g)]
    .map((match) => match[1])
    .join("\n");
}

/** Returns the rules of a CSS text, with the whitespace of each selector collapsed. */
function rulesOf(text: string): Rule[] {
  return [...text.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
    selector: match[1].replace(/\s+/g, " ").trim(),
    body: match[2],
  }));
}

/** Returns the rules of `src/styles/<name>`. */
function rules(name: string): Rule[] {
  return rulesOf(source(`styles/${name}`));
}

/** Returns the rules of `src/styles/<name>` that have `declaration` among their declarations. */
function withDeclaration(name: string, declaration: string): Rule[] {
  return rules(name).filter((rule) =>
    rule.body.split(";").some((part) => part.trim() === declaration),
  );
}

/** Returns true when `selector` names `cls` as a whole class, not as the start of a longer one. */
function hasClass(selector: string, cls: string): boolean {
  return new RegExp(`${cls.replace(".", "\\.")}(?![\\w-])`).test(selector);
}

const STATES = [":hover", ":focus-visible", ".is-hover", ".is-focus"];

describe("リンクのホバー", () => {
  it("リンクの規則はすべて :where の中にあり、部品のクラスの規則が常に勝つ", () => {
    const outside = rules("global.css").map((rule) =>
      rule.selector.replace(/:where\([^)]*\)/g, ""),
    );
    expect(
      outside.filter((selector) => /(^|[\s,>+~])a(?![\w-])/.test(selector)),
    ).toEqual([]);
    expect(rules("global.css").map((rule) => rule.selector)).toContain(
      ":where(a)",
    );
  });

  it("ライトのホバーとフォーカスは 2px の --keyword の下線になり、見本の状態も同じ規則に載る", () => {
    const found = withDeclaration(
      "global.css",
      "text-decoration-line: underline",
    );
    expect(found).toHaveLength(1);
    const [rule] = found;
    for (const state of [
      "a:hover",
      "a:focus-visible",
      "a.is-hover",
      "a.is-focus",
    ]) {
      expect(rule.selector).toContain(state);
    }
    expect(rule.body).toContain("text-decoration-color: var(--keyword)");
    expect(rule.body).toContain("text-decoration-thickness: 2px");
  });

  it("ダークのホバーとフォーカスは文字が --keyword になり、下線は付かない", () => {
    const found = withDeclaration("global.css", "color: var(--keyword)");
    expect(found).toHaveLength(1);
    const [rule] = found;
    for (const state of STATES) {
      expect(rule.selector).toContain(`:root[data-theme="dark"] a${state}`);
    }
    expect(rule.body).toContain("text-decoration-line: none");
  });

  it("ダークの規則はライトの規則より後にあり、ダークのホバーに下線が残らない", () => {
    const all = rules("global.css");
    const indexOf = (declaration: string) =>
      all.findIndex((rule) =>
        rule.body.split(";").some((part) => part.trim() === declaration),
      );
    const dark = indexOf("color: var(--keyword)");
    const light = indexOf("text-decoration-line: underline");
    expect(light).toBeGreaterThanOrEqual(0);
    expect(dark).toBeGreaterThan(light);
  });
});

describe("フォーカスの輪", () => {
  it("global.css が 2px の --focus-ring の輪を :focus-visible と .is-focus に描く", () => {
    const found = withDeclaration(
      "global.css",
      "outline: 2px solid var(--focus-ring, var(--fg))",
    );
    expect(found).toHaveLength(1);
    expect(found[0].selector).toContain(":focus-visible");
    expect(found[0].selector).toContain(".is-focus");
    expect(found[0].body).toContain("outline-offset: 2px");
  });

  it("shapes.css は輪の太さと色を持たず、:has(> .lift) の輪の距離だけを持つ", () => {
    const declarations = rules("shapes.css").flatMap((rule) =>
      rule.body.split(";").map((part) => part.trim()),
    );
    expect(declarations.filter((part) => part.startsWith("outline:"))).toEqual(
      [],
    );
    expect(
      declarations.filter((part) => part === "outline-offset: 5px"),
    ).toHaveLength(1);
  });
});

describe("ボタンとアイコンのリンク", () => {
  it(".btn-acc は地が --keyword-hover に、.btn-ghost・.sq・.iconbtn は枠が --keyword になり、ホバーとフォーカスと見本の状態で同じになる", () => {
    const fill = withDeclaration(
      "controls.css",
      "background: var(--keyword-hover)",
    );
    const border = rules("controls.css").filter(
      (rule) =>
        rule.body.trim() === "border-color: var(--keyword);" &&
        hasClass(rule.selector, ".btn-ghost"),
    );
    expect(fill).toHaveLength(1);
    expect(border).toHaveLength(1);
    for (const state of STATES) {
      expect(fill[0].selector).toContain(state);
      expect(border[0].selector).toContain(state);
    }
    expect(hasClass(fill[0].selector, ".btn-acc")).toBe(true);
    for (const cls of [".btn-ghost", ".sq", ".iconbtn"]) {
      expect(hasClass(border[0].selector, cls)).toBe(true);
    }
  });

  it(".sq と .iconbtn は 44px 角で、.btn は 46px 以上の高さを持つ", () => {
    const square = withDeclaration("controls.css", "width: 44px");
    expect(square).toHaveLength(1);
    expect(hasClass(square[0].selector, ".sq")).toBe(true);
    expect(hasClass(square[0].selector, ".iconbtn")).toBe(true);
    expect(square[0].body).toContain("height: 44px");
    const button = withDeclaration("controls.css", "min-height: 46px");
    expect(button).toHaveLength(1);
    expect(button[0].selector).toBe(".btn");
    expect(button[0].body).toContain("text-decoration: none");
  });

  it(".sq と .iconbtn は box-sizing: border-box と padding: 0 を持ち、<button> の既定の余白で中が縮まない", () => {
    const [rule] = withDeclaration("controls.css", "width: 44px");
    expect(rule.body).toContain("box-sizing: border-box");
    expect(rule.body).toContain("padding: 0");
  });

  it(".iconbtn-acc は地と枠が --keyword、文字が --ink になる", () => {
    const found = rules("controls.css").filter(
      (rule) => rule.selector === ".iconbtn-acc",
    );
    expect(found).toHaveLength(1);
    expect(found[0].body).toContain("border-color: var(--keyword)");
    expect(found[0].body).toContain("background: var(--keyword)");
    expect(found[0].body).toContain("color: var(--ink)");
  });

  it(".ws は高さ 30px、最小幅 44px で下線を持たず、ホバー・フォーカス・見本の状態で地が --panel になる", () => {
    const base = rules("controls.css").filter(
      (rule) => rule.selector === ".ws",
    );
    expect(base).toHaveLength(1);
    expect(base[0].body).toContain("height: 30px");
    expect(base[0].body).toContain("min-width: 44px");
    expect(base[0].body).toContain("text-decoration: none");
    const fill = withDeclaration("controls.css", "background: var(--panel)");
    expect(fill).toHaveLength(1);
    expect(hasClass(fill[0].selector, ".ws")).toBe(true);
    for (const state of STATES) {
      expect(fill[0].selector).toContain(state);
    }
  });

  it(".ws.on は --keyword の地に --ink の太い文字で、ホバーの規則より後にあり、ホバーでも変わらない", () => {
    const all = rules("controls.css");
    const current = all.findIndex((rule) => rule.selector === ".ws.on");
    const hover = all.findIndex((rule) => rule.selector.startsWith(".ws:is("));
    expect(current).toBeGreaterThanOrEqual(0);
    expect(current).toBeGreaterThan(hover);
    expect(all[current].body).toContain("background: var(--keyword)");
    expect(all[current].body).toContain("color: var(--ink)");
    expect(all[current].body).toContain("font-weight: 700");
  });

  it("controls.css と global.css は !important を使わない", () => {
    expect(source("styles/controls.css")).not.toContain("!important");
    expect(source("styles/global.css")).not.toContain("!important");
  });
});

describe("配線", () => {
  it("Layout は controls.css を shapes.css の後に読み込む", () => {
    const layout = source("layouts/Layout.astro");
    const shapes = layout.indexOf('import "../styles/shapes.css"');
    const controls = layout.indexOf('import "../styles/controls.css"');
    expect(shapes).toBeGreaterThanOrEqual(0);
    expect(controls).toBeGreaterThan(shapes);
  });

  it("記事一覧の頭は PageHead の中にパンくずと h1 と絞り込みを置き、絞り込みのリンクに .ws と現在地の .on を付ける", () => {
    const index = source("components/BlogIndex.astro");
    const head = index.slice(
      index.indexOf("<PageHead>"),
      index.indexOf("</PageHead>"),
    );
    expect(head).toContain('class="crumbs"');
    expect(head).toContain("<h1>");
    expect(head).toContain('class="filter"');
    expect(head).toContain('class:list={["ws", { on: link.current }]}');
    expect(head).toContain('aria-current={link.current ? "page" : undefined}');
  });

  it("ブラウザーの既定の下線に頼っていた 404 ページのリンクは自分で下線を持つ", () => {
    const targets: [string, string][] = [["pages/404.astro", "a"]];
    for (const [path, selector] of targets) {
      const found = rulesOf(styleOf(source(path))).find(
        (rule) => rule.selector === selector,
      );
      expect(found?.body, `${path} ${selector}`).toContain(
        "text-decoration: underline;",
      );
    }
  });
});

describe("記事の本文のリンク", () => {
  it("記事の本文のリンクには下線が付く", () => {
    const found = rulesOf(styleOf(source("components/ArticleBody.astro"))).find(
      (rule) => rule.selector === ".article-body :global(a)",
    );
    expect(found?.body).toContain("text-decoration-line: underline;");
  });
});

describe("記事の一覧の行", () => {
  it("行のリンクは自分に下線を引かず、ライトのホバーとフォーカスではタイトルにだけ 2px の --keyword の下線を引く", () => {
    const all = rulesOf(styleOf(source("components/PostRows.astro")));
    const row = all.find((rule) => rule.selector === ".row");
    expect(row?.body).toContain("text-decoration: none;");
    const underlined = all.filter((rule) =>
      rule.body.includes("text-decoration: underline;"),
    );
    expect(underlined.map((rule) => rule.selector)).toEqual([
      ':global(:root:not([data-theme="dark"])) .row:is(:hover, :focus-visible) .title',
    ]);
    expect(underlined[0].body).toContain(
      "text-decoration-color: var(--keyword);",
    );
    expect(underlined[0].body).toContain("text-decoration-thickness: 2px;");
  });
});

describe("記事のアコーディオン", () => {
  const SELECTORS = {
    ring: ".article-body details::before",
    hover: ".article-body details:has(> summary:hover)::before",
    focus: ".article-body details:has(> summary:focus-visible)::before",
  };
  const article = () =>
    rulesOf(styleOf(source("components/ArticleBody.astro")));

  it("details の地と輪は .win の規則と同じ規則で描く", () => {
    const [panel] = withDeclaration("window.css", "background: var(--panel)");
    const [ring] = withDeclaration("window.css", "--wb: 360deg");
    expect(panel.selector.split(", ")).toContain(".article-body details");
    expect(ring.selector.split(", ")).toContain(SELECTORS.ring);
  });

  it("summary のホバーとキーボードのフォーカスは同じ規則で輪を回す", () => {
    const [turn] = withDeclaration("window.css", "--wa: 180deg");
    expect(turn.selector.split(", ")).toEqual(
      expect.arrayContaining([SELECTORS.hover, SELECTORS.focus]),
    );
  });

  it("輪の動きは prefers-reduced-motion: reduce で止まる", () => {
    const [stop] = withDeclaration("window.css", "transition: none");
    expect(stop.selector.split(", ")).toEqual(
      expect.arrayContaining(Object.values(SELECTORS)),
    );
  });

  it("summary は JetBrains Mono で、高さ 48px 以上の押せる行になる", () => {
    const found = article().find(
      (rule) => rule.selector === ".article-body :global(summary)",
    );
    expect(found?.body).toContain("font-family: var(--font-mono);");
    expect(found?.body).toContain("min-height: 48px;");
    expect(found?.body).toContain("cursor: pointer;");
  });

  it("開閉は <details> に任せ、ArticleBody は <script> を持たない", () => {
    expect(source("components/ArticleBody.astro")).not.toContain("<script");
  });
});

describe("記事のメッセージボックス", () => {
  /** The selector that `window.css` and `labels.css` share with `.win` and `.label`. */
  const SHARED = ":where(.article-body aside:is(.note, .warning))";

  /** Returns true when a rule of `list` has both `selector` and `among` in its selector list. */
  function listsBoth(list: Rule[], selector: string, among: string): boolean {
    return list.some((rule) => {
      const items = rule.selector
        .split(/,(?![^(]*\))/)
        .map((item) => item.trim());
      return items.includes(selector) && items.includes(among);
    });
  }

  /** Returns the body of the first rule of `text` whose selector is `:global(<inner>)`. */
  function bodyOf(text: string, inner: string): string | undefined {
    return rulesOf(text).find(
      (rule) => rule.selector === `.article-body :global(${inner})`,
    )?.body;
  }

  const article = () => styleOf(source("components/ArticleBody.astro"));
  /** The part of the article's style from the last `@media (min-width: 768px)`. */
  const wide = () =>
    article().slice(article().lastIndexOf("@media (min-width: 768px)"));

  it("window.css は .win の地の規則と輪の規則に記事のメッセージボックスを足している", () => {
    const list = rules("window.css");
    expect(listsBoth(list, SHARED, ".win")).toBe(true);
    expect(listsBoth(list, `${SHARED}::before`, ".win::before")).toBe(true);
  });

  it("labels.css は .label の規則にメッセージボックスの ::after を足している", () => {
    expect(listsBoth(rules("labels.css"), `${SHARED}::after`, ".label")).toBe(
      true,
    );
  });

  it("ラベルの語は ::after の content で、読み上げには # を除いた語を渡す", () => {
    expect(bodyOf(article(), "aside.note::after")).toContain(
      'content: "# note" / "note";',
    );
    expect(bodyOf(article(), "aside.warning::after")).toContain(
      'content: "# warning" / "warning";',
    );
  });

  it("ラベルは文の上に出て、色は --acc-text になる", () => {
    const body = bodyOf(article(), "aside:is(.note, .warning)::after");
    expect(body).toContain("order: -1;");
    expect(body).toContain("color: var(--acc-text);");
  });

  it("警告だけが上端の縞を背景の 1 層目に持ち、地の --panel を最後の層に残す", () => {
    const warning = bodyOf(article(), "aside.warning") ?? "";
    expect(warning).toMatch(/--stripes:\s*repeating-linear-gradient\(/);
    expect(warning).toMatch(/background: var\(--stripes\), var\(--panel\);/);
    expect(bodyOf(article(), "aside:is(.note, .warning)")).not.toContain(
      "gradient",
    );
  });

  it("768px 以上で余白と文の大きさが PC の値になり、警告の上の余白も 6px 増えたまま", () => {
    const text = wide();
    expect(bodyOf(text, "aside:is(.note, .warning)")).toContain(
      "padding: 16px 20px;",
    );
    expect(bodyOf(text, "aside:is(.note, .warning) > *")).toContain(
      "font-size: 15px;",
    );
    expect(bodyOf(text, "aside.warning")).toContain("padding-top: 22px;");
    expect(bodyOf(article(), "aside.warning")).toContain("padding-top: 18px;");
  });

  it("face は hate.webp を背景の層に置き、768px 未満で 52px × 70px、以上で 72px × 96px にする", () => {
    const face = bodyOf(article(), "aside:is(.note, .warning).face") ?? "";
    expect(face).toContain(
      '--face: url("../assets/hate.webp") 14px center / 52px 70px no-repeat;',
    );
    expect(face).toContain("min-height: 70px;");
    expect(face).toContain("padding-left: 78px;");
    expect(face).toContain("background: var(--face), var(--panel);");
    const wideFace = bodyOf(wide(), "aside:is(.note, .warning).face") ?? "";
    expect(wideFace).toContain(
      '--face: url("../assets/hate.webp") 20px center / 72px 96px no-repeat;',
    );
    expect(wideFace).toContain("min-height: 96px;");
    expect(wideFace).toContain("padding-left: 108px;");
  });

  it("顔ありの警告は縞を 1 層目、顔を 2 層目に置き、地の --panel を最後の層に残す", () => {
    expect(bodyOf(article(), "aside.warning.face")).toContain(
      "background: var(--stripes), var(--face), var(--panel);",
    );
  });
});
