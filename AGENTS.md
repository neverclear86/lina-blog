# lina-blog

創好リナ（バーチャルイキリプログラマ）の個人サイト兼ブログ ikili.pro のリポジトリ。Astro 7 でほぼ全ページを静的に生成し、Cloudflare Workers（Static Assets と、`src/fetch.ts` の Hono）で配信する。記事の公開は、サイトとは別の Worker（`workers/publish/`、Hono）が受け持つ。計画は GitHub の issue（Epic #1〜#10）にある。

## 開発

dev サーバーは背景で立てる。

```
astro dev --background
```

背景のサーバーは `astro dev stop`、`astro dev status`、`astro dev logs` で扱う。

公開用 Worker（`workers/publish/`）は `bun run dev:publish`（`wrangler dev`）で立てる。シークレットは `workers/publish/.dev.vars.example` を `workers/publish/.dev.vars` に写して置く。`wrangler dev` は背景に回らないので、エージェントが立てるときは `timeout` と `--port` を付ける。

## ドキュメント

Astro のドキュメント: https://docs.astro.build

関係する作業の前に、次のガイドを読む。

- [ページ、動的ルート、ミドルウェアの追加](https://docs.astro.build/en/guides/routing/)
- [Astro のコンポーネント](https://docs.astro.build/en/basics/astro-components/)
- [React、Vue、Svelte などのフレームワークのコンポーネント](https://docs.astro.build/en/guides/framework-components/)
- [コンテンツの追加と管理](https://docs.astro.build/en/guides/content-collections/)
- [スタイルと Tailwind](https://docs.astro.build/en/guides/styling/)
- [多言語対応](https://docs.astro.build/en/guides/internationalization/)

## issue ワークフロー

- issue を番号で頼まれたら、スキル `issue-workflow`（`.claude/skills/issue-workflow/`）で進める。
- PR を作る前の検査は `.claude/agents/issue-implementer.md` の「PR を作る前の検査」にある。`package.json` のスクリプトと食い違わないようにする。
- `.claude/issue-workflow-kit.json` はワークフローの導入の記録である。ワークフローは生成されたファイルを手で直さず、ユーザーレベルのスキル `issue-workflow-kit` の「更新」で更新する。
