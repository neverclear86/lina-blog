import { mkdir, mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { listVaultFiles, resolveImages } from "./images";

/** `printf 'fixture-a' | sha256sum` */
const HASH_A =
  "06ada57c26aa5cf429e9f2c0a99e3e4a42daecd45fc4c955d7c1399ab4227ae8";
/** `printf 'fixture-b' | sha256sum` */
const HASH_B =
  "e0ef56d6eb603d9ffe87e74c28b8210b0ea93839e2ea4fb64f1fc2c66e95e391";

const FILES: Record<string, string> = {
  "articles/post.md": "",
  "articles/_img/a.png": "fixture-a",
  "articles/copy.png": "fixture-a",
  "articles/Upper.PNG": "fixture-a",
  "articles/local.gif": "fixture-a",
  "articles/_attachments/b.jpeg": "fixture-a",
  "x/same.png": "fixture-a",
  ".obsidian/hidden.png": "fixture-a",
  "_attachments/b.jpeg": "fixture-b",
  "_attachments/space name.png": "fixture-b",
  "unused.webp": "fixture-b",
  "y/same.png": "fixture-b",
  "other/local.gif": "fixture-b",
  "note.svg": "<svg/>",
};

let vaultRoot: string;
let vaultFiles: string[];

beforeAll(async () => {
  vaultRoot = await mkdtemp(join(tmpdir(), "vault-"));
  for (const [path, text] of Object.entries(FILES)) {
    await mkdir(dirname(join(vaultRoot, path)), { recursive: true });
    await writeFile(join(vaultRoot, path), text);
  }
  await symlink(
    join(vaultRoot, "articles/_img/a.png"),
    join(vaultRoot, "articles/link.png"),
  );
  vaultFiles = await listVaultFiles(vaultRoot);
});

afterAll(async () => {
  await rm(vaultRoot, { recursive: true, force: true });
});

/** Resolves the images of `markdown` as the body of `articles/post.md`. */
function resolve(markdown: string) {
  return resolveImages({
    markdown,
    articlePath: "articles/post.md",
    vaultRoot,
    vaultFiles,
  });
}

/** Resolves `markdown` and returns the rewritten body, failing when the resolution fails. */
async function rewrite(markdown: string): Promise<string> {
  const result = await resolve(markdown);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return result.markdown;
}

describe("listVaultFiles", () => {
  it("ドットで始まるフォルダーを除き、_ で始まるフォルダーを含めて並べる", () => {
    expect(vaultFiles).toEqual([
      "_attachments/b.jpeg",
      "_attachments/space name.png",
      "articles/Upper.PNG",
      "articles/_attachments/b.jpeg",
      "articles/_img/a.png",
      "articles/copy.png",
      "articles/local.gif",
      "articles/post.md",
      "note.svg",
      "other/local.gif",
      "unused.webp",
      "x/same.png",
      "y/same.png",
    ]);
    expect(vaultFiles).toEqual([...vaultFiles].sort());
  });
});

describe("resolveImages", () => {
  it("ファイル名だけの埋め込みを _ で始まるフォルダーの画像に解決する", async () => {
    expect(await resolve("前 ![[a.png]] 後\n")).toEqual({
      ok: true,
      markdown: `前 ![](image:${HASH_A}.png) 後\n`,
      images: [
        {
          name: `${HASH_A}.png`,
          path: "articles/_img/a.png",
          contentType: "image/png",
        },
      ],
    });
  });

  it("相対パスの画像を解決し、jpeg を jpg にする", async () => {
    expect(await resolve("![図](../_attachments/b.jpeg)")).toEqual({
      ok: true,
      markdown: `![図](image:${HASH_B}.jpg)`,
      images: [
        {
          name: `${HASH_B}.jpg`,
          path: "_attachments/b.jpeg",
          contentType: "image/jpeg",
        },
      ],
    });
  });

  it("/ を含むパスは Vault のルートからを先に、記事のフォルダーからを後に解決する", async () => {
    expect(await rewrite("![[_attachments/b.jpeg]] ![[_img/a.png]]")).toBe(
      `![](image:${HASH_B}.jpg) ![](image:${HASH_A}.png)`,
    );
  });

  it("山括弧とパーセントエンコードのパスを解決する", async () => {
    expect(
      await rewrite(
        "![](<../_attachments/space name.png>) ![](../_attachments/space%20name.png)",
      ),
    ).toBe(`![](image:${HASH_B}.png) ![](image:${HASH_B}.png)`);
  });

  it("大文字の拡張子を小文字にする", async () => {
    expect(await resolve("![[Upper.PNG]]")).toEqual({
      ok: true,
      markdown: `![](image:${HASH_A}.png)`,
      images: [
        {
          name: `${HASH_A}.png`,
          path: "articles/Upper.PNG",
          contentType: "image/png",
        },
      ],
    });
  });

  it("参照されていない画像は一覧に入れず、同じ画像は 1 回だけ入れる", async () => {
    const result = await resolve("![[a.png]] ![[a.png]] ![](copy.png)");
    expect(result.ok && result.images).toEqual([
      {
        name: `${HASH_A}.png`,
        path: "articles/_img/a.png",
        contentType: "image/png",
      },
    ]);
  });

  it("幅の指定は捨て、それ以外の文字列は代替テキストにする", async () => {
    expect(
      await rewrite("![[a.png|200]] ![[a.png|100x50]] ![[a.png|[図]]"),
    ).toBe(
      `![](image:${HASH_A}.png) ![](image:${HASH_A}.png) ![\\[図](image:${HASH_A}.png)`,
    );
  });

  it("http と https の画像は変えない", async () => {
    const markdown =
      "![a](https://example.com/a.png) ![b](HTTP://example.com/b.svg)";
    expect(await resolve(markdown)).toEqual({
      ok: true,
      markdown,
      images: [],
    });
  });

  it("コードブロックとインラインコードの中の記法は変えない", async () => {
    const markdown = [
      "```md",
      "![[missing.png]]",
      "```",
      "",
      "~~~~",
      "![](missing.png)",
      "~~~~",
      "",
      "文中の `![[missing.png]]` と ``![](`x`.svg)`` の例",
      "",
    ].join("\n");
    expect(await resolve(markdown)).toEqual({
      ok: true,
      markdown,
      images: [],
    });
  });

  it("見つからない画像と Vault の外を指すパスをエラーにする", async () => {
    expect(
      await resolve(
        "![[missing.png]] ![](../../a.png) ![[z/a.png]] ![](./unused.webp)",
      ),
    ).toEqual({
      ok: false,
      errors: [
        { code: "not_found", target: "missing.png" },
        { code: "not_found", target: "../../a.png" },
        { code: "not_found", target: "z/a.png" },
        { code: "not_found", target: "./unused.webp" },
      ],
    });
  });

  it("表に無い拡張子と拡張子の無い埋め込みをエラーにする", async () => {
    expect(await resolve("![[note.svg]] ![](../note.svg) ![[ノート]]")).toEqual(
      {
        ok: false,
        errors: [
          { code: "unsupported_extension", target: "note.svg" },
          { code: "unsupported_extension", target: "../note.svg" },
          { code: "unsupported_extension", target: "ノート" },
        ],
      },
    );
  });

  it("同名の候補が複数あるファイル名はエラーにする", async () => {
    expect(await resolve("![[same.png]]")).toEqual({
      ok: false,
      errors: [
        {
          code: "ambiguous",
          target: "same.png",
          candidates: ["x/same.png", "y/same.png"],
        },
      ],
    });
  });

  it("同名の候補が複数あっても記事と同じフォルダーの画像を選ぶ", async () => {
    const result = await resolve("![[local.gif]]");
    expect(result.ok && result.images).toEqual([
      {
        name: `${HASH_A}.gif`,
        path: "articles/local.gif",
        contentType: "image/gif",
      },
    ]);
  });

  it("3 つの形のタイトルを捨てて画像を解決する", async () => {
    expect(
      await rewrite(
        [
          '![図](../_attachments/b.jpeg "題")',
          "![図](../_attachments/b.jpeg '題')",
          "![図](../_attachments/b.jpeg (題))",
        ].join(" "),
      ),
    ).toBe(
      [
        `![図](image:${HASH_B}.jpg)`,
        `![図](image:${HASH_B}.jpg)`,
        `![図](image:${HASH_B}.jpg)`,
      ].join(" "),
    );
  });

  it("空行をまたぐバッククォートの間の参照も解決する", async () => {
    expect(await rewrite("a ` b\n\n![[a.png]]\n\nc ` d")).toBe(
      `a \` b\n\n![](image:${HASH_A}.png)\n\nc \` d`,
    );
  });

  it("先頭の / を外して Vault のルートから解決する", async () => {
    expect(await rewrite("![](/_attachments/b.jpeg)")).toBe(
      `![](image:${HASH_B}.jpg)`,
    );
  });

  it("パーセントエンコードが壊れたパスは書かれたまま引く", async () => {
    expect(await resolve("![](bad%zz.png)")).toEqual({
      ok: false,
      errors: [{ code: "not_found", target: "bad%zz.png" }],
    });
  });

  it("大文字と小文字が違うファイル名は見つからない", async () => {
    expect(await resolve("![[upper.png]]")).toEqual({
      ok: false,
      errors: [{ code: "not_found", target: "upper.png" }],
    });
  });

  it("数字で始まる代替テキストは幅とみなさない", async () => {
    expect(await rewrite("![[a.png|2024年の図]]")).toBe(
      `![2024年の図](image:${HASH_A}.png)`,
    );
  });

  it("別の記号や短いフェンスの行ではコードブロックを閉じない", async () => {
    const markdown =
      "~~~~\n`````\n![[missing.png]]\n~~~~\n\n````\n```\n![[missing.png]]\n````\n";
    expect(await resolve(markdown)).toEqual({
      ok: true,
      markdown,
      images: [],
    });
  });

  it("閉じないフェンスは本文の最後までコードブロックにする", async () => {
    const markdown = "```\n![[missing.png]]\n";
    expect(await resolve(markdown)).toEqual({
      ok: true,
      markdown,
      images: [],
    });
  });

  it("行の後ろにバッククォートがある行はフェンスとみなさない", async () => {
    expect(
      await rewrite(
        "```bash``` を使う\n\n![[a.png]]\n\n``` `x` ```\n![[a.png]]\n",
      ),
    ).toBe(
      `\`\`\`bash\`\`\` を使う\n\n![](image:${HASH_A}.png)\n\n\`\`\` \`x\` \`\`\`\n![](image:${HASH_A}.png)\n`,
    );
  });

  it("チルダのフェンスは情報文字列にバッククォートがあっても開く", async () => {
    const markdown = "~~~ `x`\n![[missing.png]]\n~~~\n";
    expect(await resolve(markdown)).toEqual({
      ok: true,
      markdown,
      images: [],
    });
  });

  it("CRLF の空行もまたがずにバッククォートの間の参照を解決する", async () => {
    expect(await rewrite("a\r\n`b\r\n\r\n![[a.png]] c`\r\n")).toBe(
      `a\r\n\`b\r\n\r\n![](image:${HASH_A}.png) c\`\r\n`,
    );
  });
});
