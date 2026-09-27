import { readdirSync, readFileSync } from "node:fs";
import { join, posix } from "node:path";
import type { z } from "astro/zod";
import { parse } from "yaml";
import { blogSchema } from "../../src/blog-schema";

/**
 * Frontmatter of an article sent to the publishing Worker: the blog schema without `date`,
 * which `docs/publish-api.md` leaves to the publishing side.
 */
const articleSchema = blogSchema.omit({ date: true });

/** Frontmatter of a `published: true` article after mapping and validation. */
export type ArticleFrontmatter = z.infer<typeof articleSchema>;

/**
 * What every scanned article has: the path relative to the Vault root with `/` separators, the
 * file name without `.md`, the text after the frontmatter as it is in the file, and the Vault's
 * `updated` property when it is a string.
 */
type ArticleFile = {
  path: string;
  name: string;
  body: string;
  updated: string | undefined;
};

/**
 * One Markdown file under `articles/` in the Vault.
 *
 * - `draft`: `published` is not `true`, so the frontmatter is not validated. `slug` is the
 *   Vault's `slug` when it is a string.
 * - `ready`: `published: true` and the mapped frontmatter matches the schema.
 * - `invalid`: `published: true` and the mapped frontmatter does not match the schema.
 * - `unreadable`: the frontmatter is not YAML or not a mapping, so `published` is unknown.
 */
export type VaultArticle =
  | (ArticleFile & {
      kind: "draft";
      published: false;
      slug: string | undefined;
    })
  | (ArticleFile & {
      kind: "ready";
      published: true;
      frontmatter: ArticleFrontmatter;
    })
  | (ArticleFile & { kind: "invalid"; published: true; errors: string[] })
  | (ArticleFile & {
      kind: "unreadable";
      published: undefined;
      errors: string[];
    });

/** A frontmatter block at the very start of a file (after an optional BOM), LF or CRLF. */
const FRONTMATTER = /^﻿?---\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

/** Properties that Obsidian or the sync workflow uses and the blog frontmatter does not. */
const OBSIDIAN_ONLY_KEYS = [
  "tags",
  "id",
  "aliases",
  "created",
  "updated",
  "published",
  "category",
];

/**
 * Reads the articles in `<root>/articles/` of an Obsidian Vault, sorted by path.
 *
 * Files and folders whose name starts with `_` are skipped at any depth, and symbolic links are
 * not followed. A frontmatter that does not match the schema or is not YAML becomes the result of
 * that article and does not stop the scan. The Vault is only read, never written.
 *
 * @param root The Vault root.
 * @throws When `<root>/articles/`, a folder under it or an article file cannot be read.
 */
export function scanVault(root: string): VaultArticle[] {
  return listArticlePaths(root, "articles").map((path) =>
    readArticle(root, path),
  );
}

/**
 * Returns the `.md` files under `dir`, relative to `root` and sorted, skipping every file and
 * folder whose name starts with `_`.
 */
function listArticlePaths(root: string, dir: string): string[] {
  const paths: string[] = [];
  for (const entry of readdirSync(join(root, dir), { withFileTypes: true })) {
    if (entry.name.startsWith("_")) continue;
    const path = posix.join(dir, entry.name);
    if (entry.isDirectory()) {
      paths.push(...listArticlePaths(root, path));
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      paths.push(path);
    }
  }
  return paths.sort();
}

/** Reads one article and maps and validates its frontmatter when it is `published: true`. */
function readArticle(root: string, path: string): VaultArticle {
  const text = readFileSync(join(root, path), "utf8");
  const name = posix.basename(path, ".md");
  const match = FRONTMATTER.exec(text);
  const yaml = match?.[1] ?? "";
  const body = match ? text.slice(match[0].length) : text.replace(/^﻿/, "");

  let parsed: unknown;
  try {
    parsed = parse(yaml);
  } catch (error) {
    return {
      kind: "unreadable",
      path,
      name,
      body,
      updated: undefined,
      published: undefined,
      errors: [error instanceof Error ? error.message : String(error)],
    };
  }
  if (parsed === null || parsed === undefined) parsed = {};
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    return {
      kind: "unreadable",
      path,
      name,
      body,
      updated: undefined,
      published: undefined,
      errors: ["The frontmatter is not a mapping."],
    };
  }
  const props = parsed as Record<string, unknown>;
  const updated = typeof props.updated === "string" ? props.updated : undefined;
  const file = { path, name, body, updated };

  if (props.published !== true) {
    const slug = typeof props.slug === "string" ? props.slug : undefined;
    return { ...file, kind: "draft", published: false, slug };
  }
  const result = articleSchema.safeParse(toBlogFrontmatter(props, name));
  if (result.success) {
    return {
      ...file,
      kind: "ready",
      published: true,
      frontmatter: result.data,
    };
  }
  return {
    ...file,
    kind: "invalid",
    published: true,
    errors: result.error.issues.map(
      (issue) => `${issue.path.join(".")}: ${issue.message}`,
    ),
  };
}

/**
 * Maps Obsidian properties to the blog frontmatter.
 *
 * `category` (a string or a list) becomes `tags`, and a missing or blank `title` becomes the file
 * name. Obsidian's own `tags`, `id`, `aliases`, `created`, `updated` and `published` are dropped.
 * `date` is not created.
 */
function toBlogFrontmatter(
  props: Record<string, unknown>,
  name: string,
): Record<string, unknown> {
  const mapped: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(props)) {
    if (!OBSIDIAN_ONLY_KEYS.includes(key)) mapped[key] = value;
  }
  const { title, category } = props;
  if (title == null || (typeof title === "string" && title.trim() === "")) {
    mapped.title = name;
  }
  if (category !== undefined) {
    mapped.tags = typeof category === "string" ? [category] : category;
  }
  return mapped;
}
