/**
 * The sync of Vault articles to the publish Worker: reads the Vault, converts and hashes each
 * article with `published: true`, compares them with `GET /articles`, and sends the changes one
 * article at a time. The Vault is only read, never written.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import {
  createPublishClient,
  type PublishClient,
  type PublishClientOptions,
  type PublishError,
  readPublishConfig,
} from "./client";
import {
  type ArticleAction,
  diffArticles,
  type VaultArticleState,
} from "./diff";
import { type ImageError, listVaultFiles, resolveImages } from "./images";
import { buildMarkdown, hashMarkdown } from "./markdown";
import {
  convertObsidianSyntax,
  type LinkTarget,
  type ObsidianError,
  type ResolveLink,
} from "./obsidian";
import { scanVault, type VaultArticle } from "./vault";

/** Most images one article may reference; the publish Worker rejects more with 422. */
const MAX_IMAGES_PER_ARTICLE = 20;

/** The destination of an inline link, or of a link reference definition that is not a footnote. */
const LINK_DESTINATION =
  /\]\(\s*(<[^>\n]*>|[^\s)>]+)|^ {0,3}\[(?!\^)(?:\\.|[^\\\]\n])+\]:[ \t]*(?:\n[ \t]*)?(<[^>\n]*>|[^\s<>]+)/gm;

/** A URL scheme such as https: or mailto:. */
const URL_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/**
 * What the sync did, or would do under `--dry-run`, with one article. `action` is an action of
 * `diffArticles`, or `error` when the article could not be checked or sent; a slug that several
 * articles share is an `error` for each of them. `missing` is a published article that is not in
 * the Vault, reported and not taken down. `errors` is empty unless `action` is `error`.
 */
export type ArticleReport = {
  action:
    | "publish"
    | "update"
    | "unchanged"
    | "unpublish"
    | "draft"
    | "missing"
    | "error";
  slug: string | null;
  path: string | null;
  updated: string | null;
  errors: string[];
};

/**
 * The output of one sync. `ok` is `true` when `fatal` is `null` and no article is an `error`.
 * `fatal` tells why the sync stopped before comparing, and then `articles` is empty.
 */
export type SyncReport = {
  dryRun: boolean;
  ok: boolean;
  fatal: string | null;
  articles: ArticleReport[];
};

/** Input of `runSync`: the Vault root, the client of the publish Worker, and `--dry-run`. */
export type SyncOptions = {
  vaultRoot: string;
  client: PublishClient;
  dryRun: boolean;
};

/** An article with `published: true` that is converted, with what is sent for it. */
type ReadyArticle = {
  path: string;
  updated: string | null;
  slug: string;
  markdown: string;
  images: { name: string; path: string }[];
};

/**
 * Looks up `[[link]]` names among the scanned articles. A trailing `.md` is ignored. A name with
 * `/` is matched against the Vault-relative path without `.md`, and any other name against the
 * file name; case matters. One article with `published: true` that passed validation is
 * `published`; any other article, or a name that several articles have, is `unpublished`. A
 * name that is not an article is `not_article`.
 */
export function createLinkResolver(
  articles: readonly VaultArticle[],
): ResolveLink {
  return (name: string): LinkTarget => {
    const key = name.replace(/\.md$/, "");
    const candidates = articles.filter((article) =>
      key.includes("/")
        ? article.path.replace(/\.md$/, "") === key
        : article.name === key,
    );
    if (candidates.length === 0) {
      return { kind: "not_article" };
    }
    const [article] = candidates;
    if (candidates.length === 1 && article.kind === "ready") {
      return { kind: "published", slug: article.frontmatter.slug };
    }
    return { kind: "unpublished" };
  };
}

/** Writes a failed request of the publish Worker as one error of a report. */
function formatPublishError(label: string, error: PublishError): string {
  const status = error.status === null ? "no response" : error.status;
  const step = error.step === undefined ? "" : ` (step ${error.step})`;
  return `${label} failed: ${status} ${error.code}${step}: ${error.message}`;
}

/** Writes an error of `convertObsidianSyntax` as one error of a report. */
function formatObsidianError(error: ObsidianError): string {
  return `${error.code}: ${error.source} (line ${error.line})`;
}

/** Writes an error of `resolveImages` as one error of a report. */
function formatImageError(error: ImageError): string {
  if (error.code === "ambiguous") {
    return `ambiguous: ${error.target} (${error.candidates.join(", ")})`;
  }
  return `${error.code}: ${error.target}`;
}

/**
 * Lists the link destinations that are relative paths in an article body as `buildMarkdown`
 * writes it (LF, no BOM), such as `../notes/memo.md` in `[memo](../notes/memo.md)` or in the
 * definition `[memo]: memo.md`. Only what follows `](` or a definition label is read, whatever
 * the link text looks like. A destination that is empty, has a scheme, or starts with `/` or
 * `#` is left alone, and so are images converted to `image:`. Code is not skipped.
 */
function findMarkdownLinks(markdown: string): string[] {
  const destinations: string[] = [];
  for (const match of markdown.matchAll(LINK_DESTINATION)) {
    const written = match[1] ?? match[2];
    const destination = written.startsWith("<")
      ? written.slice(1, -1)
      : written;
    if (
      destination !== "" &&
      !URL_SCHEME.test(destination) &&
      !destination.startsWith("/") &&
      !destination.startsWith("#")
    ) {
      destinations.push(destination);
    }
  }
  return destinations;
}

/** Uploads the images of one article, then publishes it; stops at the first failure. */
async function sendArticle(
  options: SyncOptions,
  article: ReadyArticle,
): Promise<string | null> {
  for (const image of article.images) {
    let bytes: Uint8Array<ArrayBuffer>;
    try {
      bytes = await readFile(join(options.vaultRoot, image.path));
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      return `image ${image.name} failed: could not read ${image.path}: ${reason}`;
    }
    const uploaded = await options.client.uploadImage(image.name, bytes);
    if (!uploaded.ok) {
      return formatPublishError(`image ${image.name}`, uploaded.error);
    }
  }
  const put = await options.client.putArticle(article.slug, article.markdown);
  return put.ok
    ? null
    : formatPublishError(`PUT /articles/${article.slug}`, put.error);
}

/** The report of a sync that stopped before comparing. */
function fatalReport(dryRun: boolean, fatal: string): SyncReport {
  return { dryRun, ok: false, fatal, articles: [] };
}

/**
 * Syncs the Vault with the publish Worker and reports each article.
 *
 * Articles with `published: true` are converted, their images resolved and their content hashed
 * before `GET /articles`. An article that fails validation, conversion (including a relative
 * Markdown link), image resolution (including more than 20 images) or a request becomes an
 * `error` and the others go on. For `publish` and `update`, each image is
 * uploaded before `PUT /articles/{slug}`, which is not sent when an upload fails; `unpublish`
 * sends `DELETE /articles/{slug}`. Articles are sent one at a time. With `dryRun`, only
 * `GET /articles` is sent.
 *
 * @returns The report. It never throws; a failure that stops the sync is in `fatal`.
 */
export async function runSync(options: SyncOptions): Promise<SyncReport> {
  const { vaultRoot, client, dryRun } = options;

  let scanned: VaultArticle[];
  let vaultFiles: string[];
  try {
    scanned = scanVault(vaultRoot);
    vaultFiles = await listVaultFiles(vaultRoot);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return fatalReport(dryRun, `Could not read the Vault: ${reason}`);
  }

  const resolve = createLinkResolver(scanned);
  const staged: ArticleReport[] = [];
  const states: VaultArticleState[] = [];
  const ready = new Map<string, ReadyArticle>();
  const failedSlugs = new Map<string, string[]>();
  const updatedOf = new Map<string, string | null>();

  for (const article of scanned) {
    const updated = article.updated ?? null;
    updatedOf.set(article.path, updated);
    const fail = (errors: string[], slug: string | null = null): void => {
      staged.push({
        action: "error",
        slug,
        path: article.path,
        updated,
        errors,
      });
    };

    if (article.kind === "invalid" || article.kind === "unreadable") {
      fail(article.errors.map((message) => `frontmatter: ${message}`));
      continue;
    }
    if (article.kind === "draft") {
      if (article.slug === undefined) {
        staged.push({
          action: "draft",
          slug: null,
          path: article.path,
          updated,
          errors: [],
        });
      } else {
        states.push({
          path: article.path,
          slug: article.slug,
          published: false,
        });
      }
      continue;
    }

    const { slug } = article.frontmatter;
    const failWithSlug = (errors: string[]): void => {
      fail(errors, slug);
      failedSlugs.set(slug, [...(failedSlugs.get(slug) ?? []), article.path]);
    };

    const converted = convertObsidianSyntax(article.body, resolve);
    if (!converted.ok) {
      failWithSlug(converted.errors.map(formatObsidianError));
      continue;
    }
    let resolved: Awaited<ReturnType<typeof resolveImages>>;
    try {
      resolved = await resolveImages({
        markdown: converted.markdown,
        articlePath: article.path,
        vaultRoot,
        vaultFiles,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      failWithSlug([`unreadable_image: ${reason}`]);
      continue;
    }
    if (!resolved.ok) {
      failWithSlug(resolved.errors.map(formatImageError));
      continue;
    }
    const markdown = buildMarkdown(article.frontmatter, resolved.markdown);
    const bodyStart = buildMarkdown(article.frontmatter, "").length;
    const errors = [
      ...(resolved.images.length > MAX_IMAGES_PER_ARTICLE
        ? [
            `too_many_images: ${resolved.images.length} images (at most ${MAX_IMAGES_PER_ARTICLE})`,
          ]
        : []),
      ...findMarkdownLinks(markdown.slice(bodyStart)).map(
        (destination) => `markdown_link: ${destination}`,
      ),
    ];
    if (errors.length > 0) {
      failWithSlug(errors);
      continue;
    }

    ready.set(article.path, {
      path: article.path,
      updated,
      slug,
      markdown,
      images: resolved.images,
    });
    states.push({
      path: article.path,
      slug,
      published: true,
      hash: hashMarkdown(markdown),
    });
  }

  const listed = await client.listArticles();
  if (!listed.ok) {
    return fatalReport(
      dryRun,
      formatPublishError("GET /articles", listed.error),
    );
  }

  const reports: ArticleReport[] = [...staged];
  const report = (
    action: ArticleReport["action"],
    slug: string | null,
    path: string | null,
    errors: string[] = [],
  ): void => {
    reports.push({
      action,
      slug,
      path,
      updated: path === null ? null : (updatedOf.get(path) ?? null),
      errors,
    });
  };

  for (const action of diffArticles(states, listed.value)) {
    const failedPaths = failedSlugs.get(action.slug);
    if (action.kind === "missing") {
      if (failedPaths === undefined) {
        report("missing", action.slug, null);
      }
    } else if (action.kind === "duplicate") {
      for (const path of action.paths) {
        const others = action.paths.filter((other) => other !== path);
        report("error", action.slug, path, [
          `duplicate_slug: ${action.slug} is also used by ${others.join(", ")}`,
        ]);
      }
    } else if (failedPaths !== undefined) {
      report("error", action.slug, action.path, [
        `duplicate_slug: ${action.slug} is also used by ${failedPaths.join(", ")}`,
      ]);
    } else {
      reports.push(await carryOut(options, action, ready, updatedOf));
    }
  }

  return {
    dryRun,
    ok: reports.every((entry) => entry.action !== "error"),
    fatal: null,
    articles: reports,
  };
}

/** Sends what `action` needs unless `dryRun`, and returns its report. */
async function carryOut(
  options: SyncOptions,
  action: Exclude<ArticleAction, { kind: "missing" | "duplicate" }>,
  ready: ReadonlyMap<string, ReadyArticle>,
  updatedOf: ReadonlyMap<string, string | null>,
): Promise<ArticleReport> {
  const entry = (errors: string[] = []): ArticleReport => ({
    action: errors.length > 0 ? "error" : action.kind,
    slug: action.slug,
    path: action.path,
    updated: updatedOf.get(action.path) ?? null,
    errors,
  });
  if (
    options.dryRun ||
    action.kind === "unchanged" ||
    action.kind === "draft"
  ) {
    return entry();
  }
  if (action.kind === "unpublish") {
    const deleted = await options.client.deleteArticle(action.slug);
    return entry(
      deleted.ok
        ? []
        : [
            formatPublishError(
              `DELETE /articles/${action.slug}`,
              deleted.error,
            ),
          ],
    );
  }
  const article = ready.get(action.path);
  if (article === undefined) {
    return entry();
  }
  const failure = await sendArticle(options, article);
  return entry(failure === null ? [] : [failure]);
}

/**
 * Runs the sync command: `--vault <path>` is the Vault root, `--dry-run` sends nothing but
 * `GET /articles`, and `PUBLISH_URL` and `PUBLISH_TOKEN` in `env` locate the publish Worker.
 *
 * @param args The command-line arguments after the script path.
 * @param env The environment variables.
 * @param clientOptions The `fetch` and the resend delays of the client; tests pass stubs.
 * @returns The report as indented JSON with a final line break, and the exit code: 0 when the
 *   report is `ok`, 1 otherwise.
 */
export async function syncCommand(
  args: readonly string[],
  env: Record<string, string | undefined>,
  clientOptions: PublishClientOptions = {},
): Promise<{ output: string; exitCode: number }> {
  const finish = (report: SyncReport) => ({
    output: `${JSON.stringify(report, null, 2)}\n`,
    exitCode: report.ok ? 0 : 1,
  });

  let values: { vault?: string; "dry-run"?: boolean };
  try {
    ({ values } = parseArgs({
      args: [...args],
      options: {
        vault: { type: "string" },
        "dry-run": { type: "boolean" },
      },
      strict: true,
      allowPositionals: false,
    }));
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return finish(fatalReport(false, reason));
  }
  const dryRun = values["dry-run"] ?? false;
  if (!values.vault) {
    return finish(
      fatalReport(dryRun, "Pass the Vault root with --vault <path>."),
    );
  }

  let client: PublishClient;
  try {
    client = createPublishClient(readPublishConfig(env), clientOptions);
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    return finish(fatalReport(dryRun, reason));
  }
  return finish(await runSync({ vaultRoot: values.vault, client, dryRun }));
}
