import { describe, expect, it } from "vitest";
import { rewriteImageRefs } from "./image-refs";

const A = `${"a".repeat(64)}.png`;
const B = `${"b".repeat(64)}.webp`;
const URL_A = `https://img.ikili.pro/${A}`;
const URL_B = `https://img.ikili.pro/${B}`;

/** A distinct valid name for each number, the number written as 64 hexadecimal digits. */
function nameOf(number: number): string {
  return `${number.toString(16).padStart(64, "0")}.png`;
}

/** A body that references each of `names` once, one image per paragraph. */
function bodyOf(names: string[]): string {
  return names.map((name) => `![図](image:${name})\n`).join("\n");
}

describe("rewriteImageRefs", () => {
  it("image: の参照だけを差し替え、ほかの文字は変えない", () => {
    const markdown = [
      "---",
      'title: "画像の記事"',
      "tags: [技術]",
      "---",
      "",
      "本文の図は次のとおり。",
      "",
      `![図 1](image:${A})`,
      "",
      `外部の画像 ![外部](https://example.com/a.png) と、もう一度 ![図 1 (再掲)](image:${A})。`,
      "",
    ].join("\n");
    expect(rewriteImageRefs(markdown)).toEqual({
      ok: true,
      markdown: [
        "---",
        'title: "画像の記事"',
        "tags: [技術]",
        "---",
        "",
        "本文の図は次のとおり。",
        "",
        `![図 1](${URL_A})`,
        "",
        `外部の画像 ![外部](https://example.com/a.png) と、もう一度 ![図 1 (再掲)](${URL_A})。`,
        "",
      ].join("\n"),
      names: [A],
    });
  });

  it("名前を重複を除いて出てきた順に返す", () => {
    const result = rewriteImageRefs(bodyOf([B, A, B]));
    expect(result).toEqual({
      ok: true,
      markdown: bodyOf([B, A, B])
        .replaceAll(`image:${A}`, URL_A)
        .replaceAll(`image:${B}`, URL_B),
      names: [B, A],
    });
  });

  it("リンク先が image: のリンクも差し替える", () => {
    expect(rewriteImageRefs(`[元画像](image:${A})`)).toEqual({
      ok: true,
      markdown: `[元画像](${URL_A})`,
      names: [A],
    });
  });

  it("20 種の参照は受け付ける", () => {
    const names = Array.from({ length: 20 }, (_, index) => nameOf(index));
    const result = rewriteImageRefs(bodyOf([...names, names[0]]));
    expect(result.ok).toBe(true);
    expect(result.ok && result.names).toEqual(names);
  });

  it("21 種の参照は too_many_images で拒む", () => {
    const names = Array.from({ length: 21 }, (_, index) => nameOf(index));
    expect(rewriteImageRefs(bodyOf(names))).toEqual({
      ok: false,
      code: "too_many_images",
      message: "The body references 21 images; at most 20 are allowed.",
    });
  });

  it("正しい名前 20 種と形の違う名前 1 種は too_many_images で拒む", () => {
    const names = Array.from({ length: 20 }, (_, index) => nameOf(index));
    expect(rewriteImageRefs(bodyOf([...names, "z.png"]))).toEqual({
      ok: false,
      code: "too_many_images",
      message: "The body references 21 images; at most 20 are allowed.",
    });
  });

  it.each([
    ["大文字", `${"A".repeat(64)}.png`],
    ["63 文字", `${"a".repeat(63)}.png`],
    ["jpeg", `${"a".repeat(64)}.jpeg`],
    ["svg", `${"a".repeat(64)}.svg`],
    ["title 付き", `${A} "図"`],
    ["空", ""],
  ])(
    "%s の名前は invalid_markdown で拒み、名前を message に並べる",
    (_, name) => {
      expect(rewriteImageRefs(`![図](image:${name})`)).toEqual({
        ok: false,
        code: "invalid_markdown",
        message: `Image references must be ](image:<sha256>.<ext>): ${name}.`,
      });
    },
  );

  it("invalid_markdown の message には形の違う名前だけを出てきた順に並べる", () => {
    expect(rewriteImageRefs(bodyOf([A, "z.png", B, "y.png"]))).toEqual({
      ok: false,
      code: "invalid_markdown",
      message:
        "Image references must be ](image:<sha256>.<ext>): z.png, y.png.",
    });
  });

  it.each([
    ["宛先の前の空白", `![a]( image:${A})`, `]( image:${A}`],
    ["<image:…> の宛先", `![a](<image:${A}>)`, `](<image:${A}`],
    ["参照定義", `![a][x]\n\n[x]: image:${A}\n`, `[x]: image:${A}`],
    ["改行を挟む参照定義", `![a][x]\n\n[x]:\nimage:${A}\n`, `[x]:\nimage:${A}`],
    ["改行を挟むタイトル", `![a](image:${A}\n"図")`, `](image:${A}`],
    ["自動リンク", `<image:${A}>`, `<image:${A}`],
    ["IMAGE:", `![a](IMAGE:${A})`, `](IMAGE:${A}`],
    [
      "リストの項目の参照定義",
      `![a][x]\n\n- [x]: image:${A}\n`,
      `- [x]: image:${A}`,
    ],
    [
      "引用の中の参照定義",
      `> ![a][x]\n>\n> [x]: image:${A}\n`,
      `> [x]: image:${A}`,
    ],
    ["HTML の src 属性", `<img src="image:${A}">`, `src="image:${A}`],
  ])("%s は invalid_markdown で拒む", (_, markdown, part) => {
    expect(rewriteImageRefs(markdown)).toEqual({
      ok: false,
      code: "invalid_markdown",
      message: `Image references must be ](image:<sha256>.<ext>): ${part}.`,
    });
  });

  it("散文の image: とコードの中の形は拒まない", () => {
    const markdown = [
      "Docker の image: nginx を使う。",
      "",
      "宛先を `](<image:x>)` と書くと拒まれる。",
      "",
      "![a](https://example.com/image:x.png)",
      "",
    ].join("\n");
    expect(rewriteImageRefs(markdown)).toEqual({
      ok: true,
      markdown,
      names: [],
    });
  });

  it.each([
    ["``` のフェンス", "```\n", "```\n"],
    ["~~~ のフェンス", "~~~\n", "~~~\n"],
    ["字下げした閉じのフェンス", "```\n", "   ```\n"],
  ])("%s の中の参照は数えず変えない", (_, open, close) => {
    const inside = `${open}![a](image:x)\n\n![b](image:${B})\n${close}`;
    expect(rewriteImageRefs(`${inside}\n![c](image:${A})\n`)).toEqual({
      ok: true,
      markdown: `${inside}\n![c](${URL_A})\n`,
      names: [A],
    });
  });

  it("~~~ のフェンスは ``` の行では閉じない", () => {
    const markdown = `~~~\n\`\`\`\n\n![a](image:${A})\n~~~\n`;
    expect(rewriteImageRefs(markdown)).toEqual({
      ok: true,
      markdown,
      names: [],
    });
  });

  it("フェンスは開きより短い行では閉じない", () => {
    const markdown = `\`\`\`\`\n\`\`\`\n\n![a](image:${A})\n\`\`\`\`\n`;
    expect(rewriteImageRefs(markdown)).toEqual({
      ok: true,
      markdown,
      names: [],
    });
  });

  it("後ろに文字のある行ではフェンスは閉じない", () => {
    const markdown = `\`\`\`\n\`\`\` x\n\n![a](image:${A})\n\`\`\`\n`;
    expect(rewriteImageRefs(markdown)).toEqual({
      ok: true,
      markdown,
      names: [],
    });
  });

  it("閉じの無いフェンスは本文の末尾まで続く", () => {
    const markdown = `\`\`\`\n\n![a](image:${A})\n`;
    expect(rewriteImageRefs(markdown)).toEqual({
      ok: true,
      markdown,
      names: [],
    });
  });

  it("4 個の空白で字下げした ``` はフェンスにならない", () => {
    expect(rewriteImageRefs(`    \`\`\`\n\n![a](image:${A})\n`)).toEqual({
      ok: true,
      markdown: `    \`\`\`\n\n![a](${URL_A})\n`,
      names: [A],
    });
  });

  it("コードスパンの中の参照は数えず変えない", () => {
    expect(rewriteImageRefs(`\`![a](image:x)\` と ![b](image:${B})`)).toEqual({
      ok: true,
      markdown: `\`![a](image:x)\` と ![b](${URL_B})`,
      names: [B],
    });
  });

  it("コードスパンは同じ長さのバッククォートの連なりでだけ閉じる", () => {
    const markdown = "``a ` ![](image:x)``";
    expect(rewriteImageRefs(markdown)).toEqual({
      ok: true,
      markdown,
      names: [],
    });
  });

  it("閉じの無いバッククォートの連なりは素の文字として扱う", () => {
    expect(rewriteImageRefs(`\`a ![](image:${A})`)).toEqual({
      ok: true,
      markdown: `\`a ![](${URL_A})`,
      names: [A],
    });
  });

  it("空行をまたぐバッククォートはコードスパンにならない", () => {
    expect(rewriteImageRefs(`\`a\n\n![](image:${A}) \``)).toEqual({
      ok: true,
      markdown: `\`a\n\n![](${URL_A}) \``,
      names: [A],
    });
  });

  it("frontmatter の閉じの --- をまたぐバッククォートはコードスパンにならない", () => {
    const markdown = `---\ntitle: a\`b\n---\n![a](image:${A}) \`\n`;
    expect(rewriteImageRefs(markdown)).toEqual({
      ok: true,
      markdown: `---\ntitle: a\`b\n---\n![a](${URL_A}) \`\n`,
      names: [A],
    });
  });
});
