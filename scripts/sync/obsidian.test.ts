import { describe, expect, it } from "vitest";
import { convertObsidianSyntax, type ResolveLink } from "./obsidian";

const resolve: ResolveLink = (name) => {
  if (name === "公開中の記事") {
    return { kind: "published", slug: "published-post-0001" };
  }
  if (name === "下書きの記事") {
    return { kind: "unpublished" };
  }
  return { kind: "not_article" };
};

const url = "https://ikili.pro/blog/published-post-0001";

const convert = (body: string) => convertObsidianSyntax(body, resolve);

describe("convertObsidianSyntax", () => {
  it("1 行の %%コメント%% を消す", () => {
    expect(convert("前%%メモ%%後")).toEqual({ ok: true, markdown: "前後" });
  });

  it("複数行にわたる %%コメント%% を消す", () => {
    expect(convert("前\n%%\n1 行目\n2 行目\n%%\n後")).toEqual({
      ok: true,
      markdown: "前\n\n後",
    });
  });

  it("コメントの中のリンクはエラーにしない", () => {
    expect(convert("%%[[私的なメモ]]%%本文")).toEqual({
      ok: true,
      markdown: "本文",
    });
  });

  it("閉じない %% をエラーにする", () => {
    expect(convert("本文\n%%メモ [[私的なメモ]]")).toEqual({
      ok: false,
      errors: [{ code: "unclosed_comment", source: "%%", line: 2 }],
    });
  });

  it("公開中の記事へのリンクを記事の URL にする", () => {
    expect(convert("[[公開中の記事]]")).toEqual({
      ok: true,
      markdown: `[公開中の記事](${url})`,
    });
  });

  it("表示の付いたリンクは表示を文字列にする", () => {
    expect(convert("[[公開中の記事|前の記事]]")).toEqual({
      ok: true,
      markdown: `[前の記事](${url})`,
    });
  });

  it("見出しへのリンクは見出しを落として記事の URL にする", () => {
    expect(convert("[[公開中の記事#まとめ]]")).toEqual({
      ok: true,
      markdown: `[公開中の記事](${url})`,
    });
  });

  it("表の中の \\| で区切ったリンクも表示を文字列にする", () => {
    expect(convert("| [[公開中の記事\\|前の記事]] |")).toEqual({
      ok: true,
      markdown: `| [前の記事](${url}) |`,
    });
  });

  it("記事でないノートへのリンクをエラーにする", () => {
    expect(convert("1 行目\n[[私的なメモ]]")).toEqual({
      ok: false,
      errors: [{ code: "not_article_link", source: "[[私的なメモ]]", line: 2 }],
    });
  });

  it("公開しない記事へのリンクをエラーにする", () => {
    expect(convert("[[下書きの記事|次回]]")).toEqual({
      ok: false,
      errors: [
        {
          code: "unpublished_link",
          source: "[[下書きの記事|次回]]",
          line: 1,
        },
      ],
    });
  });

  it("ノートの名前の無い見出しへのリンクをエラーにする", () => {
    expect(convert("[[#まとめ]]")).toEqual({
      ok: false,
      errors: [{ code: "heading_only_link", source: "[[#まとめ]]", line: 1 }],
    });
  });

  it("画像以外の埋め込みをエラーにする", () => {
    expect(convert("![[公開中の記事]]\n![[資料.pdf]]")).toEqual({
      ok: false,
      errors: [
        { code: "non_image_embed", source: "![[公開中の記事]]", line: 1 },
        { code: "non_image_embed", source: "![[資料.pdf]]", line: 2 },
      ],
    });
  });

  it("すべてのエラーを返す", () => {
    expect(convert("[[私的なメモ]] [[公開中の記事]] %%a")).toEqual({
      ok: false,
      errors: [
        { code: "not_article_link", source: "[[私的なメモ]]", line: 1 },
        { code: "unclosed_comment", source: "%%", line: 1 },
      ],
    });
  });

  it("画像の埋め込みを変えずに残す", () => {
    const body = ["avif", "bmp", "gif", "jpeg", "jpg", "png", "svg", "webp"]
      .map((extension) => `![[図.${extension}]]`)
      .join("\n");
    expect(convert(body)).toEqual({ ok: true, markdown: body });
  });

  it("拡張子の大文字小文字を区別せず、幅や見出しの付いた画像も残す", () => {
    const body = "![[図.PNG]] ![[図.png|300]] ![[図.png#x]]";
    expect(convert(body)).toEqual({ ok: true, markdown: body });
  });

  it("コードブロックの中の記法を変換しない", () => {
    const syntax = "[[私的なメモ]] %%メモ%% ![[資料.pdf]]";
    const body = `\`\`\`md\n${syntax}\n\`\`\`\n~~~\n${syntax}\n~~~`;
    expect(convert(body)).toEqual({ ok: true, markdown: body });
  });

  it("閉じないコードブロックは本文の末尾までをコードとする", () => {
    const body = "```\n[[私的なメモ]]";
    expect(convert(body)).toEqual({ ok: true, markdown: body });
  });

  it("インラインコードの中の記法を変換しない", () => {
    const body = "`[[私的なメモ]]` と ``%%a``";
    expect(convert(body)).toEqual({ ok: true, markdown: body });
  });

  it("表示に角括弧を含むリンクも記事でなければエラーにする", () => {
    expect(convert("[[私的なメモ|注[1]]]")).toEqual({
      ok: false,
      errors: [
        { code: "not_article_link", source: "[[私的なメモ|注[1]]", line: 1 },
      ],
    });
  });

  it("表示の角括弧をエスケープする", () => {
    expect(convert("[[公開中の記事|a]b]]")).toEqual({
      ok: true,
      markdown: `[a\\]b](${url})`,
    });
  });

  it("改行を含む二重の角括弧は記法として扱わない", () => {
    const body = "[[私的\nメモ]]";
    expect(convert(body)).toEqual({ ok: true, markdown: body });
  });

  it("別の記号や短いフェンスの行ではコードブロックを閉じない", () => {
    const body =
      "```\n~~~\n[[私的なメモ]]\n```\n\n````\n```\n[[私的なメモ]]\n````";
    expect(convert(body)).toEqual({ ok: true, markdown: body });
  });

  it("4 個以上の空白で字下げしたフェンスの後ろのリンクはエラーにする", () => {
    expect(convert("    ```\n[[私的なメモ]]\n```")).toEqual({
      ok: false,
      errors: [{ code: "not_article_link", source: "[[私的なメモ]]", line: 2 }],
    });
  });

  it("情報文字列にバッククォートを含む行はフェンスにしない", () => {
    expect(convert("```a`b\n[[私的なメモ]]")).toEqual({
      ok: false,
      errors: [{ code: "not_article_link", source: "[[私的なメモ]]", line: 2 }],
    });
  });

  it("空行をまたぐバッククォートの間のリンクもエラーにする", () => {
    expect(convert("文中の ` 記号。\n\n[[私的なメモ]]\n\n`x`")).toEqual({
      ok: false,
      errors: [{ code: "not_article_link", source: "[[私的なメモ]]", line: 3 }],
    });
  });

  it("フェンスの中のバッククォートと段落のバッククォートを対にしない", () => {
    expect(convert("a ` b\n```\n`\n```\n[[私的なメモ]]")).toEqual({
      ok: false,
      errors: [{ code: "not_article_link", source: "[[私的なメモ]]", line: 5 }],
    });
  });

  it("長さの違うバッククォートではインラインコードを閉じない", () => {
    const body = "``[[私的なメモ]]` と```[[公開中の記事]]``";
    expect(convert(body)).toEqual({ ok: true, markdown: body });
  });

  it("閉じないバッククォートの後の記法は変換する", () => {
    expect(convert("` [[公開中の記事]]")).toEqual({
      ok: true,
      markdown: `\` [公開中の記事](${url})`,
    });
  });
});
