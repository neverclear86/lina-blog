/**
 * Decides what the sync does with each article by comparing the articles in the Vault with the
 * articles that `GET /articles` lists as published. It reads nothing and sends nothing.
 */

/**
 * An article found in the Vault. `path` is the file's path in the Vault, used in reports.
 * Only an article with `published: true` has `hash`, the content hash of the `markdown` that
 * would be sent, because only those articles are validated and normalized.
 */
export type VaultArticleState =
  | { path: string; slug: string; published: true; hash: string }
  | { path: string; slug: string; published: false };

/**
 * One entry of `GET /articles`: a published article and its content hash. `hash` is `null`
 * while publishing the article has not finished.
 */
export type ListedArticle = { slug: string; hash: string | null };

/**
 * What the sync does with one slug.
 *
 * - `publish`: send the article, which is not published yet.
 * - `update`: send the article again, because the listed hash differs from its hash or is
 *   `null`.
 * - `unchanged`: nothing, because the listed hash equals its hash.
 * - `unpublish`: take the article down, because it has `published: false` but is listed.
 * - `draft`: nothing, because the article has `published: false` and is not listed.
 * - `missing`: report only. The listed article is not in the Vault, and it is not taken down.
 * - `duplicate`: report as an error. Several articles in the Vault have the slug, so none of
 *   them is sent or taken down.
 */
export type ArticleAction =
  | {
      kind: "publish" | "update" | "unchanged" | "unpublish" | "draft";
      slug: string;
      path: string;
    }
  | { kind: "missing"; slug: string }
  | { kind: "duplicate"; slug: string; paths: string[] };

/** Orders strings by UTF-16 code units with `<` and `>`, independent of the locale. */
function compareStrings(a: string, b: string): number {
  if (a < b) {
    return -1;
  }
  if (a > b) {
    return 1;
  }
  return 0;
}

/**
 * Compares the articles in the Vault with the listed published articles and decides the action
 * for each slug.
 *
 * - An article with `published: true` is `publish` when its slug is not listed, `unchanged`
 *   when the listed hash equals its hash, and `update` otherwise, including a listed `null`.
 * - An article with `published: false` is `unpublish` when its slug is listed, whatever the
 *   listed hash is, and `draft` otherwise.
 * - A listed slug that no article in the Vault has is `missing`. It is never `unpublish`.
 * - When several articles in the Vault have one slug, whatever their `published`, the slug is
 *   a single `duplicate` with their paths in ascending order. It is neither `missing` nor
 *   `unpublish`, even when it is listed.
 *
 * Slugs are compared as they are, case-sensitively. `listed` is expected to have each slug at
 * most once.
 *
 * @param vault The articles found in the Vault.
 * @param listed The articles that `GET /articles` returned.
 * @returns One action per slug, in ascending order of slug compared with `<` and `>`.
 */
export function diffArticles(
  vault: readonly VaultArticleState[],
  listed: readonly ListedArticle[],
): ArticleAction[] {
  const vaultBySlug = new Map<string, VaultArticleState[]>();
  for (const article of vault) {
    const articles = vaultBySlug.get(article.slug);
    if (articles) {
      articles.push(article);
    } else {
      vaultBySlug.set(article.slug, [article]);
    }
  }

  const listedHashes = new Map<string, string | null>();
  for (const entry of listed) {
    listedHashes.set(entry.slug, entry.hash);
  }

  const actions: ArticleAction[] = [];
  for (const [slug, articles] of vaultBySlug) {
    if (articles.length > 1) {
      const paths = articles
        .map((article) => article.path)
        .sort(compareStrings);
      actions.push({ kind: "duplicate", slug, paths });
      continue;
    }
    const article = articles[0];
    const isListed = listedHashes.has(slug);
    if (article.published) {
      const kind = !isListed
        ? "publish"
        : listedHashes.get(slug) === article.hash
          ? "unchanged"
          : "update";
      actions.push({ kind, slug, path: article.path });
    } else {
      actions.push({
        kind: isListed ? "unpublish" : "draft",
        slug,
        path: article.path,
      });
    }
  }

  for (const slug of listedHashes.keys()) {
    if (!vaultBySlug.has(slug)) {
      actions.push({ kind: "missing", slug });
    }
  }

  return actions.sort((a, b) => compareStrings(a.slug, b.slug));
}
