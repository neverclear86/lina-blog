import {
  defineHastPlugin,
  type HastPluginDefinition,
  markdownToHtml,
} from "satteri";
import { describe, expect, it } from "vitest";
import { tableAlignToClass } from "./table-align.ts";

async function render(
  markdown: string,
  before: HastPluginDefinition[] = [],
): Promise<string> {
  return (
    await markdownToHtml(markdown, {
      hastPlugins: [...before, tableAlignToClass],
    })
  ).html;
}

/** Hast plugin that gives every `td` the given `style`. */
function tdStyle(style: string): HastPluginDefinition {
  return defineHastPlugin({
    name: "td-style",
    element: {
      filter: ["td"],
      visit(node, ctx) {
        ctx.setProperty(node, "style", style);
      },
    },
  });
}

describe("tableAlignToClass", () => {
  it("左・中央・右の揃えを align-left・align-center・align-right のクラスにし、style 属性を消す", async () => {
    const html = await render(
      "| a | b | c |\n| :-- | :-: | --: |\n| 1 | 2 | 3 |\n",
    );
    expect(html).toContain('<th class="align-left">a</th>');
    expect(html).toContain('<td class="align-center">2</td>');
    expect(html).toContain('<td class="align-right">3</td>');
    expect(html).not.toContain("style=");
  });

  it("揃えを指定しない列のセルにはクラスを付けない", async () => {
    const html = await render("| a |\n| --- |\n| 1 |\n");
    expect(html).toContain("<th>a</th>");
    expect(html).toContain("<td>1</td>");
  });

  it("text-align 以外の style を持つセルは変えない", async () => {
    const html = await render("| a |\n| --- |\n| 1 |\n", [
      tdStyle("color: red"),
    ]);
    expect(html).toContain('<td style="color: red">1</td>');
  });

  it("text-align と他の宣言を併せ持つ style のセルは変えない", async () => {
    const html = await render("| a |\n| --- |\n| 1 |\n", [
      tdStyle("color: red; text-align: center"),
    ]);
    expect(html).toContain('<td style="color: red; text-align: center">1</td>');
    expect(html).not.toContain("align-center");
  });
});
