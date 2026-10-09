import { satteriHighlightPlugin } from "@astrojs/markdown-satteri";
import { markdownToHtml } from "satteri";
import { describe, expect, it } from "vitest";
import { codeFilename } from "./code-filename.ts";

function render(markdown: string) {
  return markdownToHtml(markdown, { mdastPlugins: [codeFilename] }).html;
}

describe("codeFilename", () => {
  it("ファイル名付きのコードブロックを figure と figcaption で包み、題をファイル名、言語をファイル名を除いた値にする", () => {
    const html = render("```ts:src/hello.ts\nconst a = 1;\n```\n");
    expect(html).toContain(
      '<figure class="code-window"><figcaption>src/hello.ts</figcaption><pre><code class="language-ts">const a = 1;',
    );
  });

  it("言語の無いファイル名付きのコードブロックは、言語のクラスを付けずに包む", () => {
    const html = render("```:notes.txt\nhi\n```\n");
    expect(html).toContain(
      '<figure class="code-window"><figcaption>notes.txt</figcaption><pre><code>hi',
    );
  });

  it.each(["ts", "brainfuck"])(
    "ファイル名の無いコードブロックは、書いた言語 %s を題にして包む",
    (lang) => {
      const html = render(`\`\`\`${lang}\nx\n\`\`\`\n`);
      expect(html).toBe(
        `<figure class="code-window"><figcaption>${lang}</figcaption><pre><code class="language-${lang}">x\n</code></pre></figure>\n`,
      );
    },
  );

  it("言語もファイル名も無いコードブロックは、題を text にして包む", () => {
    const html = render("```\nhi\n```\n");
    expect(html).toBe(
      '<figure class="code-window"><figcaption>text</figcaption><pre><code>hi\n</code></pre></figure>\n',
    );
  });

  it("字下げのコードブロックも、題を text にして包む", () => {
    const html = render("    hi\n");
    expect(html).toBe(
      '<figure class="code-window"><figcaption>text</figcaption><pre><code>hi\n</code></pre></figure>\n',
    );
  });

  it("diff の後ろの meta は題に出さず、言語の diff だけを題にする", () => {
    const html = render("```diff js\n+a\n```\n");
    expect(html).toContain("<figcaption>diff</figcaption>");
    expect(html).toContain('class="language-diff"');
    expect(html).not.toContain("<figcaption>diff js");
  });

  it("言語の後ろの : にファイル名が続かないコードブロックは、書いたままの言語を題にして包む", () => {
    const html = render("```ts:\nx\n```\n");
    expect(html).toBe(
      '<figure class="code-window"><figcaption>ts:</figcaption><pre><code class="language-ts:">x\n</code></pre></figure>\n',
    );
  });

  it("リストと引用の中のコードブロックも包み、包んだ中を二重に包まない", () => {
    const html = render(
      "- item\n\n  ```ts\n  a\n  ```\n\n> ```sh:run.sh\n> b\n> ```\n",
    );
    expect(html.match(/<figure /g)).toHaveLength(2);
    expect(html).toContain("<figcaption>ts</figcaption>");
    expect(html).toContain("<figcaption>run.sh</figcaption>");
  });

  it("ハイライトの関数にファイル名を除いた言語とメタを渡す", async () => {
    const highlight = satteriHighlightPlugin(
      async (_code, lang, meta) => ({
        type: "element",
        tagName: "pre",
        properties: { dataLang: lang, dataMeta: meta },
        children: [],
      }),
      undefined,
    );
    const { html } = await markdownToHtml(
      "```ts:src/hello.ts {1}\nconst a = 1;\n```\n",
      {
        mdastPlugins: [codeFilename],
        hastPlugins: [highlight],
      },
    );
    expect(html).toContain(
      '<figcaption>src/hello.ts</figcaption><pre data-lang="ts" data-meta="{1}"></pre>',
    );
  });

  it("ファイル名が : を含むときは、最初の : より前を言語にする", () => {
    const html = render("```ts:C:\\work\\a.ts\nx\n```\n");
    expect(html).toContain(
      '<figure class="code-window"><figcaption>C:\\work\\a.ts</figcaption><pre><code class="language-ts">x',
    );
  });
});
