# Markdown の記法のサンプル

記事の本文で使える記法を並べたページである。記法を足したら、ここにも例を足す。

## 見出しと段落

段落の間は空行で区切る。本文の中の[リンク](https://ikili.pro/)には下線が付き、`inline code` は地と枠で区別し、**太字**にはマーカーが引かれる。

長い URL も本文の幅で折り返す: https://example.com/?token=0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef

### 小見出し（h3）

h3 は節の中の区切りに使う。

#### さらに小さい見出し（h4）

h4 は本文と同じ大きさで、太さで区別する。

## リスト

- 箇条書きの項目
- 入れ子の箇条書き
  - 入れ子の項目
  - もう 1 つの入れ子の項目
- 最後の項目

1. 番号付きの項目
2. 入れ子を含む項目
   1. 入れ子の番号付きの項目
3. 最後の項目

- 段落を含む項目

  項目の中の 2 つ目の段落

- 次の項目

## 引用

> 引用は左の罫と文字の色で本文と区別する。
>
> 2 つ目の段落も同じ罫の中に入る。

## 画像

画像は本文の幅を超えず、縦横の比を保って縮む。

![立ち姿の創好リナ](../assets/lina-standing.webp)

## 区切り線

区切り線の前の段落。

---

区切り線の後の段落。

## アコーディオン

`<details>` と `<summary>` を書くと、開閉できる窓になる。

<details>
<summary>閉じた例（<code>code</code> と <strong>太字</strong> を含む要約）</summary>

中身は Markdown で書ける。**太字**、`inline code`、[リンク](https://ikili.pro/)、リストも使える。

- 1 つ目の項目
- 2 つ目の項目

</details>

<details open>
<summary>最初から開いている例</summary>

`open` を付けると、最初から開いた状態で出る。中にコードブロックも置ける。

```sh
bun run build
```

</details>

<details>
<summary>要約が長いと折り返す。長い要約の例として、本文の幅を超える長さの文をここに置いて、2 行以上になることを確かめる</summary>

折り返した要約でも、印は右端に残る。

</details>

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

## コードブロックの題の帯

言語の後ろに `:` とファイル名を書くと、コードブロックの題の帯にファイル名が出る。

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

ファイル名を書かないコードブロックの題の帯には、書いた言語が出る。

```sh
bun run build
```

ファイル名が長いときは、題の帯の中で折り返す。

```ts:src/components/articles/very-long-directory-name/another-long-directory-name/hello-world-example.ts
export const hello = "world";
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
export function greet(name: string, times = 3): string {
  return `Hello, ${name}!`.repeat(times);
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
