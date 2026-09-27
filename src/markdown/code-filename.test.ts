import { satteriHighlightPlugin } from "@astrojs/markdown-satteri";
import { markdownToHtml } from "satteri";
import { describe, expect, it } from "vitest";
import { codeFilename } from "./code-filename.ts";

function render(markdown: string) {
  return markdownToHtml(markdown, { mdastPlugins: [codeFilename] }).html;
}

describe("codeFilename", () => {
  it("ファイル名付きのコードブロックを figure と figcaption で包み、言語はファイル名を除いた値にする", () => {
    const html = render("```ts:src/hello.ts\nconst a = 1;\n```\n");
    expect(html).toContain(
      '<figure class="code-file"><figcaption>src/hello.ts</figcaption><pre><code class="language-ts">const a = 1;',
    );
  });

  it("言語の無いファイル名付きのコードブロックは、言語のクラスを付けずに包む", () => {
    const html = render("```:notes.txt\nhi\n```\n");
    expect(html).toContain(
      '<figure class="code-file"><figcaption>notes.txt</figcaption><pre><code>hi',
    );
  });

  it("ファイル名の無いコードブロックは変えない", () => {
    const html = render("```ts\nconst a = 1;\n```\n");
    expect(html).toBe(
      '<pre><code class="language-ts">const a = 1;\n</code></pre>\n',
    );
  });

  it("言語もファイル名も無いコードブロックは変えない", () => {
    const html = render("```\nhi\n```\n");
    expect(html).toBe("<pre><code>hi\n</code></pre>\n");
  });

  it("言語の後ろの : にファイル名が続かないコードブロックは変えない", () => {
    const html = render("```ts:\nx\n```\n");
    expect(html).toBe('<pre><code class="language-ts:">x\n</code></pre>\n');
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
      '<figure class="code-file"><figcaption>C:\\work\\a.ts</figcaption><pre><code class="language-ts">x',
    );
  });
});
