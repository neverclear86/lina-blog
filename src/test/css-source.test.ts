import { describe, expect, it } from "vitest";
import {
  cssOfAstro,
  hasCondition,
  parseCss,
  rulesFor,
  valueIn,
} from "./css-source";

describe("parseCss", () => {
  it("空白と改行の書き方が違っても同じ規則になる", () => {
    const spread = parseCss(
      ".a ,\n .b { color :  red ;\n transition:\n color 0.2s,\n transform 0.2s;\n }",
    );
    const packed = parseCss(
      ".a,.b{color:red;transition:color 0.2s, transform 0.2s}",
    );
    expect(spread).toEqual(packed);
    expect(packed).toEqual([
      {
        selectors: [".a", ".b"],
        declarations: [
          { property: "color", value: "red" },
          { property: "transition", value: "color 0.2s, transform 0.2s" },
        ],
        conditions: [],
      },
    ]);
  });

  it("コメントは宣言の間でも { や ; を含んでも読み飛ばし、文字列の中の /* は残す", () => {
    const rules = parseCss(
      '/* .gone {} */ .a { /* } */ color: red; /* ; */ content: "/* kept */"; } .b { color: blue; }',
    );
    expect(rules.map((rule) => rule.selectors)).toEqual([[".a"], [".b"]]);
    expect(rules[0].declarations).toEqual([
      { property: "color", value: "red" },
      { property: "content", value: '"/* kept */"' },
    ]);
  });

  it("セレクタは括弧の外のカンマだけで分ける", () => {
    const [rule] = parseCss(
      ".a:is(:hover, :focus-visible),\n.b[data-x='1,2'] { color: red }",
    );
    expect(rule.selectors).toEqual([
      ".a:is(:hover, :focus-visible)",
      ".b[data-x='1,2']",
    ]);
  });

  it("文字列と括弧の中の ; は宣言を切らず、最後の ; は無くてよい", () => {
    const [rule] = parseCss(
      '.a { content: "a;b"; background: url(data:image/svg+xml;base64,AA); color: red }',
    );
    expect(rule.declarations).toEqual([
      { property: "content", value: '"a;b"' },
      { property: "background", value: "url(data:image/svg+xml;base64,AA)" },
      { property: "color", value: "red" },
    ]);
  });

  it("引用符のエスケープの後ろの ; も文字列の中として読む", () => {
    const [rule] = parseCss(String.raw`.a { content: "a\"; b"; color: red }`);
    expect(rule.declarations.map((d) => d.property)).toEqual([
      "content",
      "color",
    ]);
  });

  it("同じ性質の宣言は書いた順に残り、valueIn は最後を返す", () => {
    const [rule] = parseCss('.a { content: "+"; content: "+" / ""; }');
    expect(rule.declarations.map((d) => d.value)).toEqual(['"+"', '"+" / ""']);
    expect(valueIn(rule, "content")).toBe('"+" / ""');
    expect(valueIn(rule, "color")).toBeUndefined();
  });

  it("入れ子の at-rule は外側から条件に積み、ブロックの後ろの規則には引き継がない", () => {
    const rules = parseCss(
      ".a{} @supports (animation-timeline: view()) { @media screen { .b{} } .c{} } @keyframes spin { from{} to{} } .d{}",
    );
    const supports = "@supports (animation-timeline: view())";
    expect(rules.map((rule) => [rule.selectors[0], rule.conditions])).toEqual([
      [".a", []],
      [".b", [supports, "@media screen"]],
      [".c", [supports]],
      ["from", ["@keyframes spin"]],
      ["to", ["@keyframes spin"]],
      [".d", []],
    ]);
  });

  it("条件は書き方でなく値で引け、@media の順を入れ替えても同じ規則が引ける", () => {
    const narrow = "@media ( min-width:768px ) { .a { gap: 1px; } }";
    const wide = "@media (min-width: 900px) { .a { gap: 2px; } }";
    for (const css of [`${narrow} ${wide}`, `${wide} ${narrow}`]) {
      const rules = parseCss(css);
      const at768 = rules.filter((rule) =>
        hasCondition(rule, "@media (min-width: 768px)"),
      );
      expect(at768.map((rule) => valueIn(rule, "gap"))).toEqual(["1px"]);
      expect(
        rules.filter((rule) => hasCondition(rule, "@media (min-width:900px)")),
      ).toHaveLength(1);
    }
  });

  it("@font-face のように宣言だけの at-rule は規則として読む", () => {
    const rules = parseCss("@import 'x.css'; @font-face { font-family: X; }");
    expect(rules.map((rule) => rule.selectors)).toEqual([["@font-face"]]);
  });

  it("閉じていないブロックと、規則の中の規則は黙って読まず失敗する", () => {
    expect(() => parseCss(".a { color: red;")).toThrow(/not closed/);
    expect(() => parseCss(".a { color: red; .b { color: blue; } }")).toThrow(
      /Nested style rule/,
    );
  });
});

describe("rulesFor", () => {
  it("セレクタの空白の違いを無視して、その規則を書いた順に返す", () => {
    const rules = parseCss(".a  .b { x: 1 } .a .b, .c { x: 2 } .d { x: 3 }");
    expect(
      rulesFor(rules, ".a\n .b").map((rule) => valueIn(rule, "x")),
    ).toEqual(["1", "2"]);
    expect(rulesFor(rules, ".none")).toEqual([]);
  });
});

describe("cssOfAstro", () => {
  it("<style> の中だけを取り出し、属性付きも複数もつなげる", () => {
    const source = [
      "---",
      "const x = '.x { color: red }';",
      "---",
      '<p class="y">.y { color: red }</p>',
      "<style>.a { color: red }</style>",
      '<style is:global lang="css">.b { color: blue }</style>',
    ].join("\n");
    expect(parseCss(cssOfAstro(source)).map((rule) => rule.selectors)).toEqual([
      [".a"],
      [".b"],
    ]);
  });
});
