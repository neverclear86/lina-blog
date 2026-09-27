---
title: 表示確認用の記事
slug: dev-preview-sample
date: 2026-01-01
tags: [技術]
emoji: 🧪
topics: [astro]
sponsor:
  name: 表示確認用のスポンサー
  url: https://example.com/
description: 記事ページの見た目を確かめるための記事である。astro dev でだけ読み込まれ、本番のビルドには含まれない。
---

この記事は記事ページの見た目を確かめるために置いてある。
`astro dev` でだけ読み込まれ、`astro build` の出力には含まれない。

## 見出し 2

本文の段落である。**強調**、*斜体*、`インラインのコード`、[リンク](https://example.com/) を含む。

### 見出し 3

- 箇条書きの 1 項目め
- 箇条書きの 2 項目め
  - 入れ子の項目

1. 番号付きの 1 項目め
2. 番号付きの 2 項目め

> 引用のブロックである。

```ts
const greeting = (name: string): string => `Hello, ${name}!`;
```

| 列 1 | 列 2 |
| --- | --- |
| 値 1 | 値 2 |
