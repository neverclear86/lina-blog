import { markdownToMdast } from "satteri";
import { describe, expect, it } from "vitest";
import { convertToZennSyntax } from "./zenn-syntax";

const ID = "dQw4w9WgXcQ";
const WATCH = `https://www.youtube.com/watch?v=${ID}`;

const M_URL = `https://m.youtube.com/watch?v=${ID}`;

/** A body with `block` as a paragraph between two other paragraphs. */
function between(block: string): string {
  return `前の段落\n\n${block}\n\n次の段落\n`;
}

/** The converted body of `markdown`; throws when the conversion fails. */
function convert(markdown: string): string {
  const result = convertToZennSyntax(markdown);
  if (!result.ok) throw new Error(result.message);
  return result.markdown;
}

/** The message of the failure for `markdown`; throws when the conversion succeeds. */
function failure(markdown: string): string {
  const result = convertToZennSyntax(markdown);
  if (result.ok) throw new Error("変換が成功した");
  return result.message;
}

describe("convertToZennSyntax の YouTube", () => {
  it.each([
    `https://m.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}&t=10s`,
    `https://youtu.be/${ID}?t=30`,
    `https://youtu.be/${ID}?v=AAAAAAAAAAA`,
    `<https://youtu.be/${ID}>`,
  ])(
    "%s だけの段落を、Zenn が埋め込む www.youtube.com の watch URL にする",
    (url) => {
      expect(convert(`前の段落\n\n${url}\n\n次の段落\n`)).toBe(
        `前の段落\n\n${WATCH}\n\n次の段落\n`,
      );
    },
  );

  it("本文の先頭と末尾の URL だけの行も変換する", () => {
    expect(convert(`https://m.youtube.com/watch?v=${ID}`)).toBe(WATCH);
  });

  it.each([
    ["youtu.be の URL", between(`https://youtu.be/${ID}`)],
    [
      "si の query が付いた youtu.be の URL",
      between(`https://youtu.be/${ID}?si=abc`),
    ],
    ["youtube.com の watch URL", between(`https://youtube.com/watch?v=${ID}`)],
    ["www.youtube.com の watch URL", between(WATCH)],
    ["文の行の次の行", `文の行\n${M_URL}\n\n次の段落\n`],
    ["文の行の前の行", `前の段落\n\n${M_URL}\n文の行\n`],
    ["文を伴う行", between(`${M_URL} を見る`)],
    ["字下げした行", between(`  ${M_URL}`)],
    ["ID が短い URL", between("https://m.youtube.com/watch?v=abc")],
    ["YouTube でない URL", between(`https://example.com/watch?v=${ID}`)],
    ["コードのスパンに入れた URL", between(`\`${M_URL}\``)],
    ["フェンスの中の行", between(`\`\`\`\n${M_URL}\n\`\`\``)],
  ])("%s は書き換えない", (_, markdown) => {
    expect(convert(markdown)).toBe(markdown);
  });
});

describe("convertToZennSyntax のコードブロックの info", () => {
  it.each([
    ["ts:src/hello.ts", "ts:src/hello.ts"],
    ["ts:src/hello.ts {1}", "ts:src/hello.ts"],
    ["ts:my file.ts", "ts:my"],
    ["diff:a.ts js", "diff js:a.ts"],
    ["diff:a.ts", "diff:a.ts"],
    ["diff:a.ts js x", "diff:a.ts"],
    ["diff js", "diff js"],
    ["ts", "ts"],
    ["ts:", "ts:"],
    ["diff: js", "diff: js"],
    ["", ""],
  ])("```%s は ```%s にする", (info, expected) => {
    expect(convert(`\`\`\`${info}\ncode\n\`\`\`\n`)).toBe(
      `\`\`\`${expected}\ncode\n\`\`\`\n`,
    );
  });

  it("サイト側の info の読み方は、最初の語が lang で残りが meta", () => {
    const codes = (markdown: string) => {
      const root = markdownToMdast(markdown);
      const [code] = "children" in root ? root.children : [];
      return code?.type === "code" ? [code.lang, code.meta] : [];
    };
    expect(codes("```ts:my file.ts\nx\n```")).toEqual(["ts:my", "file.ts"]);
    expect(codes("```diff:a.ts js\nx\n```")).toEqual(["diff:a.ts", "js"]);
  });

  it("チルダのフェンスと、リストの項目や引用の中のフェンスの info も変える", () => {
    const markdown = [
      "~~~ts:a.ts {1}",
      "x",
      "~~~",
      "",
      "- 項目",
      "  ```diff:b.ts js",
      "  x",
      "  ```",
      "",
      "> ```ts:c.ts {2}",
      "> x",
      "> ```",
      "",
    ].join("\n");
    expect(convert(markdown)).toBe(
      [
        "~~~ts:a.ts",
        "x",
        "~~~",
        "",
        "- 項目",
        "  ```diff js:b.ts",
        "  x",
        "  ```",
        "",
        "> ```ts:c.ts",
        "> x",
        "> ```",
        "",
      ].join("\n"),
    );
  });

  it("フェンスの中の行は、閉じるフェンスまで書き換えず HTML も調べない", () => {
    const markdown = [
      "````md",
      "```ts:a.ts {1}",
      "```",
      `https://m.youtube.com/watch?v=${ID}`,
      '<aside class="note">',
      "<div>",
      "````",
      "",
    ].join("\n");
    expect(convert(markdown)).toBe(markdown);
  });

  it("字下げのコードブロックの中のフェンス風の行は開きと読む", () => {
    expect(convert("para\n\n    ```ts:a.ts js\n    <div>\n")).toBe(
      "para\n\n    ```ts:a.ts\n    <div>\n",
    );
  });

  it("チルダのフェンスは、バッククォートの行では閉じない", () => {
    const markdown = "~~~\n```\n<div>\n~~~\n\n<kbd>x</kbd>\n";
    expect(failure(markdown)).toBe(
      "The body has HTML that Zenn cannot show: line 6: <kbd>x</kbd>.",
    );
  });
});

describe("convertToZennSyntax のメッセージボックスとアコーディオン", () => {
  it("note は :::message、warning は :::message alert にして、face を落とし、空行を消す", () => {
    const markdown = [
      '<aside class="note">',
      "",
      "注記。",
      "",
      "</aside>",
      "",
      '<aside class="warning face">',
      "警告。",
      "</aside>",
      "",
    ].join("\n");
    expect(convert(markdown)).toBe(
      [
        ":::message",
        "注記。",
        ":::",
        "",
        ":::message alert",
        "警告。",
        ":::",
        "",
      ].join("\n"),
    );
  });

  it("details は :::details の題にして、open は落とす", () => {
    const markdown = [
      "<details>",
      "<summary>Q&A の題</summary>",
      "",
      "中身。",
      "",
      "</details>",
      "",
      "<details open>",
      "<summary>開いた題</summary>",
      "中身。",
      "</details>",
      "",
    ].join("\n");
    expect(convert(markdown)).toBe(
      [
        ":::details Q&A の題",
        "中身。",
        ":::",
        "",
        ":::details 開いた題",
        "中身。",
        ":::",
        "",
      ].join("\n"),
    );
  });

  it("中身のコードブロックと YouTube の URL を、外と同じ規則で変換する", () => {
    const markdown = [
      '<aside class="note">',
      "",
      "```ts:a.ts {1}",
      "<div>",
      "```",
      "",
      `https://m.youtube.com/watch?v=${ID}`,
      "",
      "</aside>",
      "",
    ].join("\n");
    expect(convert(markdown)).toBe(
      [":::message", "```ts:a.ts", "<div>", "```", "", WATCH, ":::", ""].join(
        "\n",
      ),
    );
  });

  it("summary の strong と code は、タグを除いた文字を題にする", () => {
    const markdown =
      "<details>\n<summary><code>foo</code> の<strong>設定</strong></summary>\n中身\n</details>\n";
    expect(convert(markdown)).toBe(":::details foo の設定\n中身\n:::\n");
  });

  it.each([
    [
      "details を aside に入れる",
      '<aside class="note">\n<details>\n<summary>題</summary>\n</details>\n</aside>',
      "line 2: <details>",
    ],
    [
      "aside を aside に入れる",
      '<aside class="note">\n<aside class="warning">\n</aside>\n</aside>',
      'line 2: <aside class="warning">',
    ],
    [
      "閉じていない aside",
      '<aside class="note">\n中身',
      "line 1: <aside> is not closed",
    ],
    [
      "閉じていない details",
      "<details>\n<summary>題</summary>\n中身",
      "line 1: <details> is not closed",
    ],
    ["余分な </aside>", "中身\n</aside>", "line 2: </aside>"],
    [
      "種類が違う閉じタグ",
      '<aside class="note">\n中身\n</details>',
      "line 3: </details>",
    ],
    [
      "<details> の次が </details>",
      "<details>\n</details>",
      "line 1: <details> must be followed by a <summary> line",
    ],
    [
      "<details> の次が空行",
      "<details>\n\n<summary>題</summary>\n</details>",
      "line 1: <details> must be followed by a <summary> line",
    ],
    [
      "題が空",
      "<details>\n<summary></summary>\n</details>",
      "line 2: the <summary> of <details> must be plain text",
    ],
    [
      "題が <strong></strong> だけ",
      "<details>\n<summary><strong></strong></summary>\n</details>",
      "line 2: the <summary> of <details> must be plain text",
    ],
    [
      "題に <b> がある",
      "<details>\n<summary><b>題</b></summary>\n</details>",
      "line 2: the <summary> of <details> must be plain text",
    ],
    [
      "題に文字参照がある",
      "<details>\n<summary>A &amp; B</summary>\n</details>",
      "line 2: the <summary> of <details> must be plain text",
    ],
  ])("%s と公開を止める", (_, markdown, expected) => {
    expect(failure(markdown)).toContain(expected);
  });
});

describe("convertToZennSyntax の生の HTML", () => {
  it.each([
    ["div", "<div>中身</div>", "line 1: <div>中身</div>"],
    ["kbd", "押す <kbd>Ctrl</kbd>", "line 1: 押す <kbd>Ctrl</kbd>"],
    ["コメント", "<!-- メモ -->", "line 1: <!-- メモ -->"],
    ["閉じタグだけ", "</span>", "line 1: </span>"],
    ["複数行の属性", '<a\n  href="x">x', "line 1: <a"],
    [
      "エスケープした開きの後の <b>",
      "\\<div> と <b>",
      "line 1: \\<div> と <b>",
    ],
    ["閉じない `", "`<div>", "line 1: `<div>"],
    ["処理命令", '<?xml version="1.0"?>', 'line 1: <?xml version="1.0"?>'],
  ])("%s は公開を止め、行番号と行を示す", (_, markdown, expected) => {
    expect(failure(markdown)).toBe(
      `The body has HTML that Zenn cannot show: ${expected}.`,
    );
  });

  it("複数の行の指摘を、行の順に ; で区切る", () => {
    const markdown = [
      "<div>a</div>",
      "",
      "```html",
      "<ok>",
      "```",
      "",
      "<kbd>b</kbd>",
      "",
    ].join("\n");
    expect(failure(markdown)).toBe(
      "The body has HTML that Zenn cannot show: line 1: <div>a</div>; line 7: <kbd>b</kbd>.",
    );
  });

  it.each([
    ["<br>", "一行目<br>二行目"],
    ["大文字の <BR>", "一行目<BR>二行目"],
    ["autolink", "<https://example.com/a> と <a@b.example>"],
    ["コードのスパン", "`<div>` と ``a`<b>``"],
    ["複数行のコードのスパン", "`<div>\n</div>` の後"],
    ["エスケープした <", "\\<div>"],
    ["タグでない <", "a < b"],
    ["リストの中のフェンスの <div>", "- 項目\n  ```html\n  <div>\n  ```"],
    ["引用の中のフェンスの <div>", "> ```html\n> <div>\n> ```"],
  ])("%s は通す", (_, markdown) => {
    expect(convert(`${markdown}\n`)).toBe(`${markdown}\n`);
  });

  it("特別な記法の無い本文は変えない", () => {
    const markdown =
      "# 見出し\n\n本文 **強調** と [リンク](https://example.com)。\n\n- 項目\n";
    expect(convert(markdown)).toBe(markdown);
    expect(convert("")).toBe("");
  });
});
