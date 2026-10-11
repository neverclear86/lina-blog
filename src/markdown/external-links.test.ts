import { readFileSync } from "node:fs";
import { defineHastPlugin, markdownToHtml } from "satteri";
import { describe, expect, it } from "vitest";
import { taskItemLabel } from "./a11y";
import { externalLinks } from "./external-links";
import { youtubeEmbed } from "./youtube";

const SITE = new URL("https://ikili.pro");
const NOTE = '<span class="sr-only">（外部サイト・新しいタブで開く）</span>';
const ARROW = '<span aria-hidden="true">\xa0↗</span>';

type Plugin = ReturnType<typeof defineHastPlugin>;

async function render(
  markdown: string,
  before: Plugin[] = [],
): Promise<string> {
  return (
    await markdownToHtml(markdown, {
      hastPlugins: [...before, externalLinks(SITE)],
    })
  ).html;
}

/** Plugin that gives every link `rel`, before `externalLinks` reads it. */
function withRel(value: string | string[]): Plugin {
  return defineHastPlugin({
    name: "with-rel",
    element: {
      filter: ["a"],
      visit(node, ctx) {
        ctx.setProperty(node, "rel", value);
      },
    },
  });
}

describe("externalLinks", () => {
  it("外部の http(s) のリンクに target と noopener を付け、矢印と読み上げの文を末尾に足す", async () => {
    expect(await render("[書名](https://example.com/a)\n")).toBe(
      `<p><a href="https://example.com/a" target="_blank" rel="noopener">書名${ARROW}${NOTE}</a></p>\n`,
    );
  });

  it.each([
    "<https://example.com/>",
    "https://example.com/",
    "[a](http://example.com/)",
    "[a](//example.com/)",
    "[a](https://www.ikili.pro/)",
    "[a](https://example.com/%0A)",
    "[a](<https://example.com/a b>)",
  ])("%s は外部のリンクにする", async (markdown) => {
    const html = await render(`${markdown}\n`);
    expect(html).toContain('target="_blank" rel="noopener"');
    expect(html).toContain(NOTE);
  });

  it.each([
    "[a](/blog/)",
    "[a](./x/)",
    "[a](#top)",
    "[a](https://ikili.pro/blog/)",
    "[a](http://IKILI.PRO/)",
    "[a](//ikili.pro/x)",
    "[a](https://ikili.pro/%0A)",
    "[a](mailto:a@example.com)",
    "[a](tel:+81312345678)",
  ])("%s には何も付けない", async (markdown) => {
    const html = await render(`${markdown}\n`);
    for (const absent of ["target", "rel=", "sr-only", "↗"]) {
      expect(html).not.toContain(absent);
    }
  });

  it("脚注の参照と戻りには何も付けない", async () => {
    const html = await render("本文[^1]\n\n[^1]: 注\n");
    expect(html.match(/<a href="#/g)).toHaveLength(2);
    for (const absent of ["target", "rel=", "↗", "新しいタブ"]) {
      expect(html).not.toContain(absent);
    }
  });

  it("画像だけのリンクには読み上げの文だけを足し、矢印は足さない", async () => {
    const html = await render("[![立ち姿](/a.png)](https://example.com/)\n");
    expect(html).toMatch(/<img [^>]*>[^<]*<span class="sr-only">/);
    expect(html).toContain(`${NOTE}</a>`);
    expect(html).not.toContain("↗");
  });

  it.each([
    "[ ![a](/a.png) ](https://example.com/)",
    "[![a](/a.png)\n![b](/b.png)](https://example.com/)",
  ])(
    "%j のように画像と空白だけのリンクにも矢印は足さない",
    async (markdown) => {
      const html = await render(`${markdown}\n`);
      expect(html).toContain(NOTE);
      expect(html).not.toContain("↗");
    },
  );

  it("文字と画像を含むリンク、コードだけのリンクには矢印を足す", async () => {
    const html = await render(
      "[文字 ![a](/a.png)](https://example.com/)\n\n[`code`](https://example.com/)\n",
    );
    expect(html.match(/↗/g)).toHaveLength(2);
  });

  it("リンクの rel が noopener を持たなければ、元の値を保って noopener を足す", async () => {
    const html = await render("[a](https://example.com/)\n", [withRel("me")]);
    expect(html).toContain('rel="me noopener"');
    expect(html).toContain('target="_blank"');
  });

  it("リンクの rel が配列でも、元の値を保って noopener を足す", async () => {
    const html = await render("[a](https://example.com/)\n", [
      withRel(["me", "sponsored"]),
    ]);
    expect(html).toContain('rel="me sponsored noopener"');
  });

  it("リンクの rel が noopener を持てば、そのまま保つ", async () => {
    const html = await render("[a](https://example.com/)\n", [
      withRel("sponsored noopener"),
    ]);
    expect(html).toContain('rel="sponsored noopener"');
  });

  it("サイトの中のリンクの rel は変えない", async () => {
    const html = await render("[a](/x/)\n", [withRel("me")]);
    expect(html).toContain('rel="me"');
    expect(html).not.toContain("target");
  });

  it("生の HTML で書いた <a> は変えない", async () => {
    expect(await render('<a href="https://example.com/">raw</a>\n')).toBe(
      '<p><a href="https://example.com/">raw</a></p>\n',
    );
  });

  it("見出しの中の外部リンクは変えず、見出しの id と目次の文字に注記を混ぜない", async () => {
    const html = await render(
      "## [Astro](https://example.com/) の見出し\n\n### **[太字](https://example.com/)**\n",
    );
    for (const absent of ["target", "sr-only", "↗"]) {
      expect(html).not.toContain(absent);
    }
  });

  it("タスクリストのチェックボックスの aria-label に、リンクの読み上げの文を混ぜない", async () => {
    const html = await render("- [x] [リンク](https://example.com/)\n", [
      taskItemLabel,
    ]);
    expect(html).toContain('aria-label="リンク"');
    expect(html).toContain(NOTE);
  });

  it("YouTube の URL だけの段落は、リンクにならず埋め込みのままにする", async () => {
    const html = await render("https://youtu.be/dQw4w9WgXcQ\n", [youtubeEmbed]);
    expect(html).toContain("<iframe");
    expect(html).not.toContain("target");
    expect(html).not.toContain("sr-only");
  });
});

describe("astro.config.mjs", async () => {
  it("externalLinks は taskItemLabel と youtubeEmbed の後ろに積む", () => {
    const config = readFileSync(
      new URL("../../astro.config.mjs", import.meta.url),
      "utf8",
    );
    const list = config.match(/hastPlugins: \[([^\]]*)\]/)?.[1] ?? "";
    const names = list
      .split(",")
      .map((entry) => entry.split("(")[0].trim())
      .filter((name) => name !== "");
    const at = (name: string) => names.indexOf(name);
    expect(at("externalLinks")).not.toBe(-1);
    expect(at("externalLinks")).toBeGreaterThan(at("taskItemLabel"));
    expect(at("taskItemLabel")).not.toBe(-1);
    expect(at("externalLinks")).toBeGreaterThan(at("youtubeEmbed"));
    expect(at("youtubeEmbed")).not.toBe(-1);
  });
});
