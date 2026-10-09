import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../", import.meta.url);

/** The kinds of message box an article can write, as the class of an `<aside>`. */
const KINDS = ["note", "warning"];

/** The class an article adds after the kind to show the face at the left of the box. */
const FACE = "face";

/** Reads a file by its path from the repository root. */
function read(path: string): string {
  return readFileSync(new URL(path, ROOT), "utf8");
}

/** Returns the Markdown of the sample article without its fenced code and inline code. */
function sampleProse(): string {
  return read("src/markdown/sample.md")
    .replace(/^(`{3,}|~{3,})[\s\S]*?^\1[ \t]*$/gm, "")
    .replace(/`[^`\n]*`/g, "");
}

describe("サンプル記事のメッセージボックス", () => {
  it("サンプル記事は種類ごとに <aside> の例を持つ", () => {
    const prose = sampleProse();
    for (const kind of KINDS) {
      expect(prose).toContain(`<aside class="${kind}">`);
    }
  });

  it("サンプル記事の <aside> は種類のクラスと face だけを持ち、win などの内部の名前を書かない", () => {
    const tags = sampleProse().match(/<aside\b[^>]*>/g) ?? [];
    expect(tags.length).toBeGreaterThanOrEqual(KINDS.length);
    for (const tag of tags) {
      const classes = tag.match(/^<aside class="([^"]*)">$/)?.[1].split(/\s+/);
      expect(KINDS).toContain(classes?.[0]);
      expect(classes?.slice(1)).toEqual(
        classes && classes.length > 1 ? [FACE] : [],
      );
    }
  });

  it("サンプル記事は種類ごとに顔ありの <aside> の例を持つ", () => {
    const prose = sampleProse();
    for (const kind of KINDS) {
      expect(prose).toContain(`<aside class="${kind} ${FACE}">`);
    }
  });

  it("サンプル記事の生の HTML に style 属性、<script>、on で始まる属性が無い", () => {
    expect(sampleProse().match(/<script|\sstyle=|\son[a-z]+=/gi) ?? []).toEqual(
      [],
    );
  });

  it("docs/markdown.md の「メッセージボックス」の節がクラスの一覧に note と warning を載せる", () => {
    const section = read("docs/markdown.md").match(
      /^## メッセージボックス\n([\s\S]*?)(?=^## |(?![\s\S]))/m,
    )?.[1];
    expect(section).toBeDefined();
    const rows = (section ?? "")
      .split("\n")
      .filter((line) => line.startsWith("| `"));
    expect(rows.map((row) => row.split("|")[1].trim())).toEqual(
      KINDS.map((kind) => `\`${kind}\``),
    );
    expect(section).toContain(`<aside class="note ${FACE}">`);
  });
});
