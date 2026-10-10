import { markdownToHtml } from "satteri";
import { describe, expect, it } from "vitest";
import { tableFocusable, taskItemLabel } from "./a11y.ts";

async function render(markdown: string): Promise<string> {
  return (
    await markdownToHtml(markdown, {
      hastPlugins: [taskItemLabel, tableFocusable],
    })
  ).html;
}

describe("taskItemLabel", () => {
  it("チェックボックスに項目の文を aria-label として付ける", async () => {
    const html = await render("- [x] 脚注\n- [ ] 表\n");
    expect(html).toContain(
      '<input type="checkbox" checked disabled aria-label="脚注">',
    );
    expect(html).toContain('<input type="checkbox" disabled aria-label="表">');
  });

  it("リンクとコードの文字を含め、入れ子のリストの文字は含めない", async () => {
    const html = await render(
      "- [x] 親 [リンク](https://example.com) `code`\n  - [ ] 子\n",
    );
    expect(html).toContain('aria-label="親 リンク code"');
  });

  it("入れ子の項目には、その項目の文を付ける", async () => {
    const html = await render("- [x] 親\n  - [ ] 子\n");
    expect(html).toContain('aria-label="親"');
    expect(html).toContain('aria-label="子"');
  });

  it("項目の文の改行と連続する空白は 1 つの空白にする", async () => {
    const html = await render("- [ ] 一行目\n  二行目   三行目\n");
    expect(html).toContain('aria-label="一行目 二行目 三行目"');
  });

  it("空行で区切った項目（段落の中のチェックボックス）にも項目の文を aria-label として付ける", async () => {
    const html = await render("- [ ] 一つ目\n\n- [ ] 二つ目\n");
    expect(html).toContain('aria-label="一つ目"');
    expect(html).toContain('aria-label="二つ目"');
  });

  it("task-list-item のクラスを持たない li の input は変えない", async () => {
    const html = await render(
      '<ul><li><input type="checkbox"> 手書き</li></ul>\n',
    );
    expect(html).toContain("<input");
    expect(html).not.toContain("aria-label");
  });
});

describe("tableFocusable", () => {
  it("すべての table に tabindex=0 を付ける", async () => {
    const html = await render(
      "| a |\n| --- |\n| 1 |\n\n| b |\n| --- |\n| 2 |\n",
    );
    expect(html.match(/<table tabindex="0">/g)).toHaveLength(2);
  });
});
