import { markdownToHtml } from "satteri";
import { describe, expect, it } from "vitest";
import { CODE_LANGUAGES, highlightCodeBlocks } from "./highlight.ts";

async function render(markdown: string): Promise<string> {
  return (
    await markdownToHtml(markdown, { hastPlugins: [highlightCodeBlocks] })
  ).html;
}

const PRE = '<pre class="shiki code-roles" tabindex="0">';

/** Per language: code to highlight, and a fragment the output must contain. */
const SAMPLES: Record<string, [code: string, fragment: string]> = {
  astro: [
    "---\nconst a = 1;\n---\n<p>{a}</p>",
    '<span class="hl-keyword">const</span>',
  ],
  css: ["a { color: red; }", '<span class="hl-type"> color</span>'],
  diff: ["+ added\n- removed", '<span class="hl-punctuation">+</span>'],
  dockerfile: ["FROM node:22", '<span class="hl-keyword">FROM</span>'],
  go: ["func main() {}", '<span class="hl-keyword">func</span>'],
  html: ['<p class="x">hi</p>', '<span class="hl-string">x</span>'],
  javascript: ['const a = "s";', '<span class="hl-string">s</span>'],
  json: ['{ "a": 1 }', '<span class="hl-constant"> 1</span>'],
  jsonc: ['// c\n{ "a": true }', '<span class="hl-comment">// c</span>'],
  jsx: ["const a = <div />;", '<span class="hl-keyword">const</span>'],
  markdown: ["# Title", '<span class="hl-punctuation">#</span>'],
  python: ["def f(): return None", '<span class="hl-keyword">def</span>'],
  rust: ["fn main() {}", '<span class="hl-keyword">fn</span>'],
  shellscript: ['echo "hi" # c', '<span class="hl-function">echo</span>'],
  sql: ["SELECT * FROM t;", '<span class="hl-keyword">SELECT</span>'],
  toml: ["a = 1", '<span class="hl-constant"> 1</span>'],
  tsx: ["const a: number = <T />;", '<span class="hl-type">T</span>'],
  typescript: ["type A = string;", '<span class="hl-type"> string</span>'],
  yaml: ["a: true", '<span class="hl-constant"> true</span>'],
};

describe("highlightCodeBlocks", () => {
  it.each(Object.entries(SAMPLES))(
    "%s をトークンごとのクラスでハイライトする",
    async (lang, [code, fragment]) => {
      const html = await render(`\`\`\`${lang}\n${code}\n\`\`\`\n`);
      expect(html).toContain(PRE);
      expect(html).toContain(fragment);
    },
  );

  it.each([
    ["ts", "const a = 1;"],
    ["sh", "echo hi"],
    ["py", "def f(): pass"],
    ["yml", "a: true"],
  ])("別名の %s でもハイライトする", async (lang, code) => {
    const html = await render(`\`\`\`${lang}\n${code}\n\`\`\`\n`);
    expect(html).toContain(PRE);
    expect(html).toContain('class="hl-');
  });

  it("主要な言語の一覧の全言語にハイライトのテストがある", () => {
    expect(Object.keys(SAMPLES).sort()).toEqual([...CODE_LANGUAGES].sort());
  });

  it("style 属性とインラインの <style> を出さない", async () => {
    const html = await render(
      [
        "```ts\nconst a = 1;\n```",
        "```diff js\n+const a = 1;\n-let b = 2;\n```",
        "```\nplain\n```",
      ].join("\n\n"),
    );
    expect(html).toContain('class="hl-');
    expect(html).not.toContain("style=");
    expect(html).not.toContain("<style");
  });

  it("diff js では + と - の行に差分のクラスを付け、行の中を js としてハイライトする", async () => {
    const html = await render(
      "```diff js\n+const a = 1;\n-let b = 2;\n c();\n```\n",
    );
    expect(html).toContain(
      '<span class="line diff-add"><span class="hl-punctuation">+</span><span class="hl-keyword">const</span>',
    );
    expect(html).toContain(
      '<span class="line diff-del"><span class="hl-punctuation">-</span><span class="hl-keyword">let</span>',
    );
    expect(html).toContain(
      '<span class="line"><span class="hl-function"> c</span>',
    );
  });

  it("diff の後の言語の前後の空白を無視する", async () => {
    const html = await render("```diff js  \n+const a = 1;\n```\n");
    expect(html).toContain(
      '<span class="line diff-add"><span class="hl-punctuation">+</span><span class="hl-keyword">const</span>',
    );
  });

  it("中の言語が無い diff は diff としてハイライトし、行に差分のクラスを付ける", async () => {
    const html = await render("```diff\n+a\n-b\n```\n");
    expect(html).toContain(
      '<span class="line diff-add"><span class="hl-punctuation">+</span><span>a</span></span>',
    );
    expect(html).toContain(
      '<span class="line diff-del"><span class="hl-punctuation">-</span><span>b</span></span>',
    );
  });

  it("中の言語が一覧に無い diff は、行に差分のクラスだけを付ける", async () => {
    const html = await render("```diff brainfuck\n+a\n```\n");
    expect(html).toBe(
      `${PRE}<code><span class="line diff-add"><span>+a</span></span></code></pre>\n`,
    );
  });

  it.each([
    ["brainfuck", "```brainfuck\nplain <b>\n```\n"],
    ["言語なし", "```\nplain <b>\n```\n"],
  ])(
    "一覧に無い言語と言語の指定が無いブロックは同じ枠で単色で出す（%s）",
    async (_name, markdown) => {
      const html = await render(markdown);
      expect(html).toBe(
        `${PRE}<code><span class="line"><span>plain &lt;b&gt;</span></span></code></pre>\n`,
      );
    },
  );
});
