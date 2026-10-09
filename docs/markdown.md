# 記事の本文の書き方

記事の本文は Markdown（GFM）で書き、アコーディオンは生の HTML で書く。
Markdown は Sätteri が HTML にし、`src/components/ArticleBody.astro` が見た目を付ける。
書いた記法の見た目は、`astro dev` を立てて `/dev/markdown/`（`src/markdown/sample.md` の例）で確かめられる。

## 共通の決まり

- 記事に書く HTML の行（`<details>`、`<summary>`、`</details>` など）と、Markdown の行の間には空行を置く。空行が無いと、Markdown の行は処理されずに文字のまま出る（`**太字**` が `**太字**` と出る）
- 見た目はこの文書に挙げたクラスで付ける。挙げていないクラスと、`class="win"` のようなデザインの内部のクラスは書かない
- `style` 属性、`<script>`、`onclick` などの `on` で始まる属性は書かない

## メッセージボックス

## アコーディオン

`<details>` と `<summary>` で書く。クラスは付けない。開閉はブラウザーが行い、JS は使わない。

```html
<details>
<summary>閉じているときに見える行</summary>

中身は Markdown で書ける。

</details>
```

- 最初から開いておくときは、`<details open>` と書く
- `<summary>` は必ず書く。中は HTML で書き、`**太字**` や `` `code` `` は文字のまま出るので、`<strong>` や `<code>` を使う
- `<summary>` の次の行、`</details>` の前の行、`</details>` の次の行は空行にする（共通の決まり）。`<details>` の次の行には `<summary>` をそのまま続ける
- 要約は 1 行から 2 行に収める。長いと折り返す
- 読み飛ばせる補足や長い手順に使う。読み飛ばされると困る内容は本文に書く
