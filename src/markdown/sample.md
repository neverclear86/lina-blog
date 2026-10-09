# Markdown の記法のサンプル

記事の本文で使える記法を並べたページである。記法を足したら、ここにも例を足す。

## 脚注

脚注は本文の末尾にまとめて出る[^first]。同じ脚注を 2 か所から参照できる[^first]。名前の長い脚注も書ける[^long-name]。

## 表

| 左揃え | 中央揃え | 右揃え | 指定なし |
| :-- | :-: | --: | --- |
| Astro | 7 | 1,200 | 静的に生成する |
| Cloudflare Workers | 4 | 35 | 配信する |

列の多い表は、本文の幅に収まらないときに横にスクロールする。

| 項目 | 説明 | 既定値 | 型 | 必須 | 導入した版 | 備考 |
| --- | --- | --- | --- | :-: | --: | --- |
| `processor` | Markdown の処理系 | Sätteri | `MarkdownProcessor` | いいえ | 7.0 | 長い説明の文をここに置いて、列の幅が広がることを確かめる |

## コードブロックのファイル名

言語の後ろに `:` とファイル名を書くと、コードブロックの上にファイル名が出る。

```ts:src/hello.ts
export function hello(name: string): string {
  return `Hello, ${name}!`;
}
```

ファイル名だけを書くこともできる。

```:.gitignore
dist/
node_modules/
```

ファイル名を書かないコードブロックは、そのまま出る。

```sh
bun run build
```

## タスクリスト

- [x] 脚注
- [x] 表
- [ ] 残りの記法
  - [ ] 入れ子の項目

## YouTube の埋め込み

YouTube の動画の URL だけを書いた段落は、動画の埋め込みになる。

https://www.youtube.com/watch?v=jNQXAC9IVRw

動画の ID が 11 文字でない URL は、埋め込みにせずリンクのまま出す。

https://youtu.be/jNQXAC9IVR

## コードブロック

```ts
// 型の付いた関数
export function greet(name: string): string {
  return `Hello, ${name}!`;
}
```

```diff js
 const site = "ikili.pro";
-const title = "準備中";
+const title = "創好リナのブログ";
+console.log(`${site} の記事のタイトルは「${title}」で、この行は本文の列より長いので横にスクロールする`);
```

```sh
bun run build # ビルドする
```

言語を指定しないブロックと、一覧に無い言語のブロックは単色で出る。

```
plain text
```

```brainfuck
++++++++[>++++<-]>.
```

```ts
```

[^first]: 最初の脚注である。
[^long-name]: 名前を付けた脚注である。番号は出てきた順に振られる。
