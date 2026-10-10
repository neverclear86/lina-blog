# 公開用 Worker の API の取り決め

記事の同期スクリプトと公開用 Worker の間の API を定める。
同期スクリプトと公開用 Worker の各段は、この文書を前提に作る。

## 概要

同期スクリプト（Hermes が実行する）は、Vault の記事と公開用 Worker の一覧を突き合わせ、差分だけを公開用 Worker に送る。
公開用 Worker は、画像の配置、本文の画像の URL の差し替え、GitHub へのコミット、Nostr への投稿、Zenn への転載を行う。
Worker の URL は、同期スクリプトが環境変数 `PUBLISH_URL` で受け取る。
要求と応答の JSON は UTF-8 で書く。

| メソッドとパス | 役割 | 節 |
| --- | --- | --- |
| `GET /articles` | 公開中の記事の一覧 | `## 公開中の記事の一覧` |
| `HEAD /images/{name}` | 画像の有無の確認 | `## 画像のアップロード` |
| `PUT /images/{name}` | 画像のアップロード | `## 画像のアップロード` |
| `PUT /articles/{slug}` | 記事の公開 | `## 記事の公開` |
| `DELETE /articles/{slug}` | 記事の取り下げ | `## 記事の取り下げ` |

同期スクリプトは記事を 1 本ずつ順に送り、並行して送らない。

## 認証

すべてのエンドポイントで `Authorization: Bearer <共有シークレット>` を要る。
共有シークレットは、Worker のシークレット `PUBLISH_TOKEN` と同期スクリプトの環境変数 `PUBLISH_TOKEN` に同じ値を置く。
Worker は受け取った値を共有シークレットと定数時間で比較する。
ヘッダーが無い、形式が違う、値が違うときは、401 `unauthorized` を返す。
Hermes に渡すのはこの共有シークレットだけである。
GitHub のトークンと Nostr のバンカーの接続情報は Worker にだけ置く。

## 画像のアップロード

画像は記事と別のリクエストで、1 枚ずつ送る。
`{name}` は `<sha256>.<ext>` の形である。
`<sha256>` は画像のバイト列の SHA-256 を小文字の 16 進 64 文字で表したもので、同期スクリプトが計算する。
使える拡張子と、`PUT` の `Content-Type` は次の表のとおりである。

| 拡張子 | `Content-Type` |
| --- | --- |
| `avif` | `image/avif` |
| `gif` | `image/gif` |
| `jpg` | `image/jpeg` |
| `png` | `image/png` |
| `webp` | `image/webp` |

表に無い拡張子（`jpeg`、`svg` を含む）と、拡張子に合わない `Content-Type` は、400 `invalid_request` で拒む。

`HEAD /images/{name}` は、画像が有れば 200 と、置いたときの `Content-Type`、`Cache-Control`、`ETag` を返し、無ければ 404 を返す（どちらも本文は無い）。
同期スクリプトは、404 のときだけ `PUT` する。

`PUT /images/{name}` の本文は、画像の生のバイト列である。
`Content-Length` を要り、無いとき（chunked の転送を含む）は 400 `invalid_request` で拒む（R2 は長さの分からない本文を受け取らない）。
Worker は本文を解析せず、そのまま R2 に流す。
Worker はハッシュを自分で計算しない。
R2 の `put` の `sha256` オプションにパスのハッシュを渡して照合させ、一致しない画像は 422 `hash_mismatch` で拒む。
R2 は一致しない画像を置かず、`put` がエラー（R2 のエラーコード 10037 `BadDigest`）を投げる。Worker はこれを 422 `hash_mismatch` にする。
新しく置いたときは 201、既に有るときは本文を読まずに 200 を返す。
どちらも、応答の本文は次の形である。

```json
{ "name": "<name>", "url": "https://img.ikili.pro/<name>" }
```

R2 のキーは `{name}` そのものである。
画像は、表の `Content-Type` と `Cache-Control: public, max-age=31536000, immutable` を付けて置く。
名前が内容のハッシュなので、同じ名前の画像の中身は変わらず、1 年の `immutable` でキャッシュできる。
画像は公開用 R2 バケット（`lina-blog-images`）のカスタムドメイン `https://img.ikili.pro` から、置いたときの `Content-Type` と `Cache-Control` で配信する。速度制限のある開発用の `r2.dev` の URL は使わない。
画像の形式とサイズの最適化を行うなら、同期スクリプトがハッシュを計算する前に行う。Worker は画像を変換しない（無料プランの CPU 時間に収めるため）。

## 記事の公開

要求は `PUT /articles/{slug}` で、`Content-Type: application/json`、本文は次の形である。

```json
{ "markdown": "<frontmatter と本文>" }
```

`markdown` は、`## 内容のハッシュ` の正規化を済ませたものである。
frontmatter は、ブログの frontmatter のスキーマ（`src/blog-schema.ts`）から `date` を除いたものである。
frontmatter は、`markdown` の 1 行目の `---` の行と、次の `---` だけの行の間に YAML で書く。
Worker は、サイトのビルド（Astro）と同じ `js-yaml` で読む。
閉じの `---` の行より前に `---` か `+++` で始まる行があるときは、Astro と区切りの位置が変わるので、frontmatter が無いものとして扱う。
frontmatter に `date` が有るときは、422 `invalid_frontmatter` で拒む。
Worker は段 3 で frontmatter の末尾に `date` の行を足すので、足すと YAML として読めなくなる frontmatter（`...` の行で終わるもの、マッピングを字下げしたもの、フロー形式の `{…}` で書いたもの）も、422 `invalid_frontmatter` で拒む。
frontmatter が無いとき、YAML のマッピングとして読めないとき、スキーマに合わないときも、同じ 422 `invalid_frontmatter` で拒む（検証は #49）。
frontmatter の `slug` がパスの `{slug}` と違うときは、422 `slug_mismatch` で拒む。
パスの `{slug}` の形は別に検査せず、slug の形でないパスも frontmatter の `slug` と違うので 422 `slug_mismatch` になる。

本文の画像は `![代替テキスト](image:<sha256>.<ext>)` の形で参照する。
参照先の画像は、先に `PUT /images/{name}` で置いておく。
Worker は、リンク先が `](image:<name>)` の形の参照（画像と、`[文字](image:<name>)` のリンク）だけを `https://img.ikili.pro/<sha256>.<ext>` に差し替える。
`image:` 以外の画像（外部の URL）は、そのまま残る。
`](image:<name>)` の形の参照のほかに、`image:`（大文字を含む）を、直前が英数字・`_`・`/`・`.`・`~`・`%`・`+`・`-` でなく、直後に空白・`)`・`>`・引用符・`` ` ``・`<` 以外の文字が続く形で書いた記事は、422 `invalid_markdown` で拒む（`]( image:<name>)`、`](<image:<name>>)`、参照定義、`<image:<name>>`、HTML の属性の値、URL のクエリの値を含む）。バックスラッシュのエスケープ（`image\:` など）と文字参照（`&#105;` など）は復号しない。
行頭から書いたフェンス（3 個以上の `` ` `` か `~`）で囲んだコードブロックの中の `image:` は、参照として数えず、差し替えない。
ただし、`<` で始まる行（行頭の 3 個までの空白を許す）か、1〜3 個の空白で字下げしたフェンスの行より後では、フェンスをコードブロックとして扱わない。
コードスパン、字下げしたコードブロック、リストの項目と引用の中のフェンスの中の `image:` は、ほかの本文と同じく差し替えるか拒むので、記法の例は行頭から書いたフェンスに入れる。
`image:` の参照が 21 種以上の記事は、422 `too_many_images` で拒む。
種の数は、同じ名前を 1 種とし、形の違う名前も含めて数える。
名前が「## 画像のアップロード」の `{name}` の形でない参照（`"title"` を付けたものを含む）は、422 `invalid_markdown` で拒む。
参照した画像が R2 に無いときは、422 `missing_image`（`step: "images"`）で拒む。
R2 から画像の有無を読めないときは、502 `upstream_error`（`step: "images"`）を返す。

成功したときは 200 を返す。
応答の本文の例を次に示す。

```json
{
  "slug": "hello-ikili-pro",
  "url": "https://ikili.pro/blog/hello-ikili-pro",
  "hash": "3a7bd3e2360a3d29eea436fcfb7e44c735d117c42d1c1835420b6b9942dd4f1b",
  "commit": "9fceb02d0ae598e95dc970b74767f19372d61af8",
  "nostr": {
    "eventId": "5c83da77af1dec6d7289834998ad7aafbd9e2191396d75ec3cc27f5a77226f36"
  },
  "zenn": { "commit": null }
}
```

| 項目 | 内容 |
| --- | --- |
| `slug` | 記事の slug |
| `url` | 記事の URL（`https://ikili.pro/blog/<slug>`） |
| `hash` | 内容のハッシュ |
| `commit` | 段 3 で作ったコミットの SHA。作らなかったときは `null` |
| `nostr.eventId` | kind 30023 のイベント ID（16 進 64 文字） |
| `zenn` | Zenn への転載の対象外なら `null`。対象なら `{"commit": "<SHA>" \| null}`（`null` はコミットを作らなかったとき） |

段 5 は、まだ実装していない（#68 で足す）。
それまでの Worker は段 4 の直後に段 6 を行い、`zenn` を転載の対象（「技術」タグの記事）なら `{"commit": null}`、対象外なら `null` にして 200 を返す。

## 内容のハッシュ

内容のハッシュは、`PUT /articles/{slug}` で送る `markdown` の文字列を UTF-8 のバイト列にし、その SHA-256 を小文字の 16 進 64 文字で表したものである。
Worker は受け取った `markdown` から計算する。
同期スクリプトは Vault だけから同じ値を計算できる。

含めるものは、frontmatter の `title`、`slug`、`emoji`、`tags`、`description`、`sponsor`、`topics` と、本文である。
含めないものは次の 2 つである。

- `date`（公開側が決める。送ると 422 `invalid_frontmatter`）
- Vault だけの項目（`id`、`aliases`、Obsidian の `tags`、`created`、`updated`、`published`）

正規化は、同期スクリプトが送る前に行う。

- 改行は LF にする
- BOM を付けない
- Unicode は NFC にする
- 末尾は改行 1 つにする
- frontmatter のキーは `title`、`slug`、`emoji`、`tags`、`description`、`sponsor`、`topics` の順に書く（`sponsor` の中は `name`、`url` の順）
- 値の無い任意の項目は書かない

Worker は正規化しない。
`\r` か BOM を含む `markdown` は、422 `invalid_markdown` で拒む。Nostr のイベントを包む NIP-46 の要求が 65535 バイトを超える記事も、段 3 の前に 422 `invalid_markdown` で拒む（本文の改行は 3 バイト、`"` と `\` は 4 バイトに数える）。
`updated` だけが変わった記事は、内容のハッシュが変わらないので再送されない。
画像の参照はハッシュを含むので、画像の中身が変わると参照の文字列が変わり、内容のハッシュも変わる。

## 公開中の記事の一覧

`GET /articles` は、200 と次の形の本文を返す。
`articles` は slug の昇順に並ぶ。

```json
{ "articles": [{ "slug": "<slug>", "hash": "<hex>" }] }
```

`hash` は内容のハッシュで、公開の途中で止まった記事では `null` になる。
同期スクリプトは、`null` を値が一致しないものとして扱う。
Vault で `published: true` の記事なら再送し、`published: false` の記事なら取り下げる。

一覧の出どころは、main の `src/content/published.json`（以下「公開の記録」）である。
「公開中」とは、公開の記録に slug が有ることを言う。
公開の記録の形は次のとおりである。

```json
{
  "articles": {
    "<slug>": {
      "hash": "<hex>",
      "date": "<YYYY-MM-DDTHH:MM:SSZ>",
      "images": ["<sha256>.<ext>"]
    }
  }
}
```

`hash` は内容のハッシュか `null`、`date` は公開日で UTC の秒までの `YYYY-MM-DDTHH:MM:SSZ` の形、`images` は記事が参照する画像の名前（`<sha256>.<ext>`）の一覧である。
キーは slug の昇順に並べ、書式は `JSON.stringify(値, null, 2)` の後に改行 1 つとする。
ファイルが無いときは、空の一覧とする。
記事のファイルと公開の記録は、GitHub の Git Data API で 1 つのコミットにして書き換える（手順は「## 処理の順序と再実行」の段 3）。
公開の記録は Worker だけが書き、人は手で直さない。
`GET /articles` は、GitHub から公開の記録を読めないとき、または公開の記録の形が違うときは、502 `upstream_error`（`step: "list"`）を返す。

## 処理の順序と再実行

`PUT /articles/{slug}` は、次の段を順に行う。

| 段 | 行うこと | 再実行したとき |
| --- | --- | --- |
| 0 | 要求を検証する（認証、`markdown`、frontmatter、画像の参照の数と形） | 副作用が無い |
| 1 | 参照した画像が R2 に有ることを確かめる | 副作用が無い |
| 2 | 本文の `image:` の参照を `https://img.ikili.pro/<name>` に差し替える。差し替えた記事の Nostr のイベントが 1 つの NIP-46 要求に収まることを確かめる | 副作用が無い |
| 3 | 記事のファイルと、公開の記録の項目（`hash` は `null`。完了した記事を同じ内容で送り直したときは今の値）を 1 つのコミットで書く。記事の `date` は公開の記録の `date` を使い、無ければ現在時刻（UTC、秒まで）を入れる | 内容が同じならコミットを作らない |
| 4 | Nostr に kind 30023 のイベントを投稿する | 同じ `d` タグのイベントで置き換わる。`published_at` は公開の記録の `date` を使う |
| 5 | Zenn に転載する（「技術」タグの記事だけ） | 内容が同じならコミットを作らない |
| 6 | 公開の記録の `hash` に内容のハッシュを書くコミットを作る（完了の記録） | 同じ値なら省く |

段 3 で公開の記録に項目を入れるので、サイトに出たのに一覧に無い記事は生じない。
段 6 まで成功するまで一覧は `hash` に `null` を返すので、途中で止まった記事は次の同期で再送される。

段 3 は GitHub の Git Data API で行う。
`refs/heads/main` の SHA を読み、その SHA で公開の記録と親の tree を読み、記事のファイル `src/content/blog/<slug>.md` と公開の記録を入れた tree と、その SHA を親にしたコミット（メッセージは `content: <slug> を公開する`）を作り、`main` を早送りだけで進める（`force: false`）。
記事のファイルは、段 2 で差し替えた `markdown` の frontmatter の閉じの `---` の行の直前に `date: <値>` の行を挿入したもので、ほかの行は変えない。
`date` の値は UTC の秒までの `YYYY-MM-DDTHH:MM:SSZ` の形で、公開の記録の項目にも同じ値を書く。
公開の記録の項目は `hash`、`date`、`images`（記事が参照する画像の名前を、最初に参照した順に並べたもの）にする。
`hash` は `null` にし、公開の記録の項目の `hash` がすでに内容のハッシュのとき（完了した記事を同じ内容で送り直したとき）だけ、その値を残す。
新しい tree が親の tree と同じときはコミットを作らず、応答の `commit` は `null` になる。
`main` が親から動いていて早送りにならないときは 409 `conflict`、GitHub に届かないとき、GitHub がほかの失敗を返したとき、公開の記録の形が違うときは 502 `upstream_error` を返し、どちらも `step` は `commit` である。
Worker に GitHub のトークンが無いときは、GitHub を呼ぶ前に 500 `misconfigured` を返す。

段 4 は、公開の記録の `date` を `published_at` にした kind 30023 のイベントをバンカー（NIP-46）に署名させる。
次に、署名したイベントの公開鍵の kind 10002 の write リレーを、`NOSTR_INDEX_RELAYS`（カンマ区切り。無ければ既定の 3 本）の先頭の 5 本から読み、先頭の 5 本までに投稿する。
1 本でも受理すれば成功で、`nostr.eventId` に署名済みイベントの ID を入れる。
署名の失敗、write リレーが見つからない、どのリレーも受理しないときは、502 `upstream_error`（`step: "nostr"`）を返す。
`NOSTR_CLIENT_KEY` と `NOSTR_BUNKER_URL` が無いか形が違うときは、段 3 より前に 500 `misconfigured` を返す。
段 4 で失敗した記事は、公開の記録の `hash` が `null` のまま（完了した記事を同じ内容で送り直したときは、今の値のまま）である。
再送すると段 3 からやり直し、段 4 が同じ `d` タグのイベントを投稿する。

段 6 は、`refs/heads/main` の SHA を読み直し、その SHA で公開の記録と親の tree を読み、その slug の項目の `hash` を内容のハッシュにした公開の記録だけを入れた tree と、その SHA を親にしたコミット（メッセージは `content: <slug> の公開を記録する`）を作り、`main` を早送りだけで進める。
項目の `hash` がすでに内容のハッシュのときは、コミットを作らない。
公開の記録にその slug の項目が無いとき（段 3 の後に別の要求が消したとき）と、`main` が親から動いていて早送りにならないときは 409 `conflict`、GitHub に届かないとき、GitHub がほかの失敗を返したとき、公開の記録の形が違うときは 502 `upstream_error` を返し、どちらも `step` は `record` である。
段 6 で失敗した記事は、公開の記録の `hash` が `null` のまま（項目が消えていたときは項目が無いまま）である。
同期スクリプトが同じ要求を再送すると段 3 からやり直し、段 3 が書く内容が `main` と同じならコミットを作らず、段 6 が完了の記録を書く。

途中で失敗したときは、同期スクリプトは同じリクエストを再送する。
どの段から再開するかは Worker が状態から判断し、同期スクリプトは段を指定しない。
並行した公開で GitHub の main の先頭が動いていたときは、409 `conflict` を返す。

## 記事の取り下げ

取り下げは `DELETE /articles/{slug}` で行う。
同期スクリプトは、Vault で `published: false` にした記事を一覧に見つけたときに呼ぶ（#14 の決定）。
要求と応答の形、公開の記録の扱い、処理の順序は #66 で決める。

## エラー

エラーの応答の本文は次の形である。

```json
{ "error": { "code": "<snake_case>", "message": "<人が読む説明>", "step": "<段>" } }
```

`step` は、公開の処理の段で失敗したときだけ付ける。
値は `images`、`commit`、`nostr`、`zenn`、`record` と、一覧の読み出しの `list` である。
409 と、`misconfigured` を除く 5xx は、同じリクエストを再送してよい。
それ以外の 4xx は、入力を直すまで再送しない。

| 状態 | `code` | 起きるとき | 再送 |
| --- | --- | --- | --- |
| 400 | `invalid_request` | JSON や画像の名前（パス）の形が違う、項目が無い、画像の拡張子や `Content-Type` が違う、画像の `Content-Length` が無い | しない |
| 401 | `unauthorized` | 認証が無い、形式か値が違う | しない |
| 404 | `not_found` | 無いパス（画像の `HEAD` は本文無しの 404） | しない |
| 409 | `conflict` | GitHub の先頭が並行した公開で動いた | する |
| 422 | `hash_mismatch` | 画像の中身がパスのハッシュと違う | しない |
| 422 | `invalid_markdown` | `\r` か BOM を含む、Nostr のイベントが 1 つの NIP-46 要求（65535 バイト）に収まらない、`image:` の参照の名前の形が違う、`image:` を `](image:<name>)` 以外の形で書いた | しない |
| 422 | `invalid_frontmatter` | frontmatter が無い、YAML のマッピングとして読めない、スキーマに合わない、`date` が有る、末尾に `date` の行を足すと YAML として読めない | しない |
| 422 | `slug_mismatch` | frontmatter の `slug` がパスと違う | しない |
| 422 | `missing_image` | 参照した画像が R2 に無い | 画像を置いてから |
| 422 | `too_many_images` | `image:` の参照が 21 種以上 | しない |
| 502 | `upstream_error` | R2、GitHub、Nostr のリレーやバンカーが失敗した | する |
| 500 | `misconfigured` | Worker に共有シークレット、GitHub のトークン、Nostr のクライアント鍵、バンカーの URL が設定されていないか、後ろの 2 つの形が違う | しない |
| 500 | `internal_error` | Worker の想定外の失敗 | する |

`missing_image` の `message` には、無かった画像の名前を並べる。

## 無料プランの制限

公開用 Worker は、Workers の無料プランの次の制限に収める（出典: https://developers.cloudflare.com/workers/platform/limits/ ）。

- CPU 時間は 1 リクエストあたり 10 ms（I/O の待ちを含まない）
- 外部への要求は 1 リクエストあたり 50 回（R2 への呼び出しを含む）
- 同時接続は 6
- 要求の本文は 100 MB まで
- メモリーは 128 MB

収め方は次のとおりである。

- 画像の本体を Worker で解析せず、ハッシュも Worker で計算しない（`request.body` を R2 に流し、照合は R2 に任せる）
- 内容のハッシュは、数十 KB の `markdown` の文字列だけから計算する
- 一覧は、公開の記録を 1 回読み出して作る
- 1 記事の `image:` の参照は 20 種までとし、段 1 の R2 の確認を 20 回以内にする
- GitHub、Nostr、Zenn への要求は、合わせて 30 回以内に収める。GitHub は段 3 と段 6 で 12 回、Nostr は WebSocket の接続が最大 11 本（バンカー 1、リレーの一覧の読み出し 5、投稿 5）で、接続も数える側に倒すと Zenn（#68）に使えるのは残りの 7 回である
- Nostr への接続は順に開く。バンカーの署名が終わってからリレーの一覧を読み、読み終えてから投稿する。各段は接続を閉じてから次の段を始めるので、同時に開く接続は 5 本までで、同時接続の 6 に収まる
