import { markdownToHtml } from "satteri";
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
    ["宛先の前の空白", `![a]( image:${A})`],
    ["<image:…> の宛先", `![a](<image:${A}>)`],
    ["参照定義", `![a][x]\n\n[x]: image:${A}\n`],
    ["改行を挟む参照定義", `![a][x]\n\n[x]:\nimage:${A}\n`],
    ["改行を挟むタイトル", `![a](image:${A}\n"図")`],
    ["自動リンク", `<image:${A}>`],
    ["リストの項目の参照定義", `![a][x]\n\n- [x]: image:${A}\n`],
    ["引用の中の参照定義", `> ![a][x]\n>\n> [x]: image:${A}\n`],
    ["HTML の src 属性", `<img src="image:${A}">`],
    [
      "HTML の srcset 属性の 2 番目の候補",
      `<img srcset="x.png 1x, image:${A} 2x">`,
    ],
    ["引用の中の改行を挟む参照定義", `> [x]:\n> image:${A}\n\n![a][x]\n`],
    ["引用の中の改行した宛先", `> ![a](\n> image:${A})\n`],
    ["ラベルに改行を含む参照定義", `[x\ny]: image:${A}\n\n![a][x y]\n`],
    ["HTML の引用符の無い src 属性", `<img src=image:${A}>`],
    ["HTML の poster 属性", `<video poster="image:${A}"></video>`],
    ["HTML の data 属性", `<object data="image:${A}"></object>`],
  ])("%s は invalid_markdown で拒む", (_, markdown) => {
    expect(rewriteImageRefs(markdown)).toEqual({
      ok: false,
      code: "invalid_markdown",
      message: `Image references must be ](image:<sha256>.<ext>): image:${A}.`,
    });
  });

  it("大文字の IMAGE: は invalid_markdown で拒み、書いたままを message に並べる", () => {
    expect(rewriteImageRefs(`![a](IMAGE:${A})`)).toEqual({
      ok: false,
      code: "invalid_markdown",
      message: `Image references must be ](image:<sha256>.<ext>): IMAGE:${A}.`,
    });
  });

  it("散文の image: とフェンスの中の形は拒まない", () => {
    const markdown = [
      "Docker の image: nginx を使う。",
      "",
      "`image:` と `image:<sha256>.<ext>` の形で書く。",
      "",
      "宛先を次のように書くと拒まれる。",
      "",
      "```",
      "](<image:x>)",
      "```",
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

  it("コードスパンの中の参照も差し替えて数える", () => {
    expect(
      rewriteImageRefs(`\`![a](image:${A})\` と ![b](image:${B})`),
    ).toEqual({
      ok: true,
      markdown: `\`![a](${URL_A})\` と ![b](${URL_B})`,
      names: [A, B],
    });
  });

  it("後ろにバッククォートのある ``` の行はフェンスにならない", () => {
    expect(rewriteImageRefs(`\`\`\`a\`b\n![a](image:${A})\n`)).toEqual({
      ok: true,
      markdown: `\`\`\`a\`b\n![a](${URL_A})\n`,
      names: [A],
    });
  });

  it.each([
    [
      "< で始まる行",
      `<div>\n\`\`\`\n</div>\n\n\`\`\`\n\n\`\`\`\n\n![a](image:${A})\n`,
    ],
    [
      "1〜3 個の空白で字下げしたフェンスの行",
      `  \`\`\`\n\n\`\`\`\n![a](image:${A})\n`,
    ],
  ])("%s の後ではフェンスを開かない", (_, markdown) => {
    expect(rewriteImageRefs(markdown)).toEqual({
      ok: true,
      markdown: markdown.replace(`image:${A}`, URL_A),
      names: [A],
    });
  });

  it("フェンスの中の < で始まる行の後でもフェンスを開く", () => {
    const markdown = "```\n<div>\n```\n\n```\n![a](image:x)\n```\n";
    expect(rewriteImageRefs(markdown)).toEqual({
      ok: true,
      markdown,
      names: [],
    });
  });

  it("frontmatter の行ではフェンスを開かず、フェンスを開かなくする行も見ない", () => {
    const frontmatter = "---\ndescription: |\n  <b>\n---\n\n";
    const code = "```\n![a](image:x)\n```\n\n";
    expect(rewriteImageRefs(`${frontmatter}${code}![b](image:${A})\n`)).toEqual(
      {
        ok: true,
        markdown: `${frontmatter}${code}![b](${URL_A})\n`,
        names: [A],
      },
    );
  });

  it.each([
    ["エスケープしたバッククォート", `\\\` x ![a](image:${A}) \`y\`\n`],
    ["見出しと次の段落", `# 見出し \`\n![a](image:${A}) \`\n`],
    ["リストの項目", `- a \`\n- ![a](image:${A}) \`\n`],
    ["表のセル", `| a | b |\n| - | - |\n| \` | ![a](image:${A}) \` |\n`],
    [
      "HTML のブロックの中の ``` の後",
      `<div>\n\`\`\`\n</div>\n\n\`\`\`\n\n\`\`\`\n\n![a](image:${A})\n`,
    ],
    [
      "字下げしたフェンスを閉じる ``` の後",
      `  \`\`\`\n\n\`\`\`\n![a](image:${A})\n`,
    ],
    ["srcset の 2 番目の候補", `<img srcset="x.png 1x, image:${A} 2x">\n`],
    ["引用の中の改行を挟む参照定義", `> [x]:\n> image:${A}\n\n![a][x]\n`],
    ["引用の中の改行した宛先", `> ![a](\n> image:${A})\n`],
    ["ラベルに改行を含む参照定義", `[x\ny]: image:${A}\n\n![a][x y]\n`],
    ["引用符の無い src 属性", `<img src=image:${A}>\n`],
    ["poster 属性", `<video poster="image:${A}"></video>\n`],
    ["data 属性", `<object data="image:${A}"></object>\n`],
  ])("%s の image: の宛先は描画に残らない", (_, markdown) => {
    const result = rewriteImageRefs(markdown);
    if (result.ok) {
      expect(
        markdownToHtml(result.markdown, {
          features: { gfm: true, smartPunctuation: true },
        }).html,
      ).not.toMatch(/=["']?(?:[^"'>]*[\s,])?image:/i);
    }
  });
});
