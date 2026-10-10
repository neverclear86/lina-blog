/**
 * Resolution of the images an article embeds, for the sync script. Rewrites each image reference
 * of the body to `image:<sha256>.<ext>` as `docs/publish-api.md` specifies and lists the images
 * to upload. Reads the Vault and never writes to it. The reading of the references and the
 * Markdown they are rewritten to are exported, so that a step before can check the body as it
 * will be rewritten.
 */
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join, posix } from "node:path";

/**
 * Extensions accepted by `PUT /images/{name}` and their `Content-Type`, from the table in
 * `docs/publish-api.md`. `jpeg` is not a key: it is renamed to `jpg` before the lookup.
 */
const CONTENT_TYPES: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

/**
 * An image to upload. `name` is `<sha256>.<ext>`: the SHA-256 of the file's bytes in lowercase
 * hexadecimal, and the extension lowercased with `jpeg` renamed to `jpg`. `path` is the file's
 * Vault-relative path with `/` separators, and `contentType` is the extension's entry in
 * `CONTENT_TYPES`.
 */
export type ImageUpload = { name: string; path: string; contentType: string };

/**
 * Why an image reference was rejected. `target` is the path or file name as the body wrote it,
 * after decoding. `not_found`: no file of the Vault matches. `unsupported_extension`: the
 * extension is missing or not in the table of `docs/publish-api.md`. `ambiguous`: a bare file
 * name matches files in several folders and none is in the article's folder; `candidates` lists
 * their paths, sorted.
 */
export type ImageError =
  | { code: "not_found"; target: string }
  | { code: "unsupported_extension"; target: string }
  | { code: "ambiguous"; target: string; candidates: string[] };

/**
 * Result of `resolveImages`: the rewritten body and the images it references, each image once in
 * order of first reference, or the errors of every rejected reference in body order.
 */
export type ImageResolution =
  | { ok: true; markdown: string; images: ImageUpload[] }
  | { ok: false; errors: ImageError[] };

/**
 * Input of `resolveImages`. `articlePath` and `vaultFiles` are Vault-relative with `/`
 * separators, and `vaultFiles` is what `listVaultFiles(vaultRoot)` returns.
 */
export type ResolveImagesInput = {
  markdown: string;
  articlePath: string;
  vaultRoot: string;
  vaultFiles: readonly string[];
};

/**
 * An image reference: its decoded target, the alt text to write, and the indices in the
 * Markdown passed to `mapImages` where the reference as written starts and ends.
 */
type ImageRef = { target: string; alt: string; start: number; end: number };

/**
 * The opening line of a fenced code block: up to 3 spaces, then 3 or more `` ` `` or `~`. A run
 * of `` ` `` opens a block only when no `` ` `` follows it on the line, since the info string of
 * a backtick fence cannot contain one.
 */
const FENCE = /^ {0,3}(`{3,}(?=[^`]*$)|~{3,})/;

/** A line made only of fence characters, which may close a fenced code block. */
const FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})[ \t]*$/;

/** A code span, an `![[target|label]]` embed or an `![alt](target "title")` image. */
const INLINE =
  /(?<!`)(`+)(?!`)(?:[^\n]|\n(?![ \t]*\r?\n))*?(?<!`)\1(?!`)|!\[\[([^\]\n]+)\]\]|!\[([^\]\n]*)\]\((<[^>\n]*>|[^)\s]+)(?:\s+(?:"[^"\n]*"|'[^'\n]*'|\([^)\n]*\)))?\)/g;

/** A label of `![[target|label]]` that sets the display size (`200`, `100x50`). */
const SIZE_LABEL = /^\d+(x\d+)?$/;

/**
 * Lists the regular files of the Vault as Vault-relative paths with `/` separators, sorted.
 * Folders and files whose name starts with `.` (such as `.obsidian` and `.trash`) are skipped and
 * symbolic links are not followed; names starting with `_` are kept, since image folders use them.
 *
 * @param vaultRoot The path of the Vault's root folder.
 * @returns The Vault-relative path of every file.
 */
export async function listVaultFiles(vaultRoot: string): Promise<string[]> {
  const files: string[] = [];
  const walk = async (dir: string): Promise<void> => {
    const entries = await readdir(join(vaultRoot, dir), {
      withFileTypes: true,
    });
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const path = dir === "" ? entry.name : posix.join(dir, entry.name);
      if (entry.isDirectory()) {
        await walk(path);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
  };
  await walk("");
  return files.sort();
}

/**
 * Calls `replace` for each image reference outside fenced code blocks and code spans, in body
 * order, and puts its return value in place of the reference; `null` keeps the reference as
 * written. A line whose run of `` ` `` is followed by another `` ` `` does not open a fenced
 * code block. A code span does not cross a blank line, whether lines end in `\n` or `\r\n`.
 * The target of `![alt](target)` ends at its first `)` unless enclosed in `<` and `>`; it loses
 * those brackets and a trailing title (`"title"`, `'title'` or `(title)`), and is
 * percent-decoded when it decodes. References whose target starts with `http:` or `https:` never
 * reach `replace`.
 */
export function mapImages(
  markdown: string,
  replace: (ref: ImageRef) => string | null,
): string {
  const rewrite = (text: string, base: number): string =>
    text.replace(
      INLINE,
      (
        match: string,
        ticks: string | undefined,
        embed: string | undefined,
        alt: string | undefined,
        rawTarget: string | undefined,
        offset: number,
      ) => {
        const start = base + offset;
        const end = start + match.length;
        if (ticks !== undefined) return match;
        if (embed !== undefined) {
          const bar = embed.indexOf("|");
          const target = bar === -1 ? embed : embed.slice(0, bar);
          const label = bar === -1 ? "" : embed.slice(bar + 1);
          const altText = SIZE_LABEL.test(label)
            ? ""
            : label.replace(/[\\[\]]/g, "\\$&");
          return replace({ target, alt: altText, start, end }) ?? match;
        }
        const raw = rawTarget ?? "";
        const unwrapped =
          raw.startsWith("<") && raw.endsWith(">") ? raw.slice(1, -1) : raw;
        if (/^https?:/i.test(unwrapped)) return match;
        return (
          replace({ target: decode(unwrapped), alt: alt ?? "", start, end }) ??
          match
        );
      },
    );

  const lines = markdown.match(/[^\n]*\n|[^\n]+$/g) ?? [];
  let out = "";
  let outside = "";
  let lineStart = 0;
  let fence: { char: string; length: number } | null = null;
  for (const line of lines) {
    const content = line.replace(/\r?\n$/, "");
    const thisStart = lineStart;
    lineStart += line.length;
    if (fence === null) {
      const open = FENCE.exec(content);
      if (open === null) {
        outside += line;
        continue;
      }
      out += rewrite(outside, thisStart - outside.length) + line;
      outside = "";
      fence = { char: open[1][0], length: open[1].length };
      continue;
    }
    out += line;
    const close = FENCE_CLOSE.exec(content);
    if (
      close !== null &&
      close[1][0] === fence.char &&
      close[1].length >= fence.length
    ) {
      fence = null;
    }
  }
  return out + rewrite(outside, markdown.length - outside.length);
}

/** The Markdown that an image reference is rewritten to: `![alt](image:<name>)`. */
export function imageMarkdown(alt: string, name: string): string {
  return `![${alt}](image:${name})`;
}

/** Percent-decodes a target, or returns it as written when it does not decode. */
function decode(target: string): string {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

/** Looks up one reference target by the rules of `resolveImages`, checking the extension first. */
function resolveTarget(
  target: string,
  articlePath: string,
  files: ReadonlySet<string>,
  vaultFiles: readonly string[],
): { ok: true; path: string; ext: string } | { ok: false; error: ImageError } {
  const fileName = target.slice(target.lastIndexOf("/") + 1);
  const dot = fileName.lastIndexOf(".");
  const lowered = dot === -1 ? "" : fileName.slice(dot + 1).toLowerCase();
  const ext = lowered === "jpeg" ? "jpg" : lowered;
  if (!Object.hasOwn(CONTENT_TYPES, ext)) {
    return { ok: false, error: { code: "unsupported_extension", target } };
  }

  const folder = posix.dirname(articlePath);
  const relative = posix.join(folder, target);
  const found = (path: string) => ({ ok: true as const, path, ext });
  const notFound = {
    ok: false as const,
    error: { code: "not_found" as const, target },
  };

  if (target.startsWith("./") || target.startsWith("../")) {
    return files.has(relative) ? found(relative) : notFound;
  }
  if (target.includes("/")) {
    const fromRoot = posix.normalize(target.replace(/^\/+/, ""));
    if (files.has(fromRoot)) return found(fromRoot);
    return files.has(relative) ? found(relative) : notFound;
  }
  if (files.has(relative)) return found(relative);
  const candidates = vaultFiles
    .filter((path) => posix.basename(path) === target)
    .sort();
  if (candidates.length === 1) return found(candidates[0]);
  if (candidates.length === 0) return notFound;
  return { ok: false, error: { code: "ambiguous", target, candidates } };
}

/**
 * Rewrites the image references of an article body to `![alt](image:<sha256>.<ext>)` and lists
 * the images they point to. References are `![[target]]`, `![[target|label]]` and
 * `![alt](target)`, the last one's target read as `mapImages` describes. A label that is a size
 * (`200`, `100x50`) is dropped and any other label becomes the alt text. Targets starting with
 * `http:` or `https:`, and references inside fenced code blocks and code spans, are left as
 * written.
 *
 * The extension is checked first: it must be one of `CONTENT_TYPES` after lowercasing and
 * renaming `jpeg` to `jpg`. A target is then looked up in `vaultFiles` only, so a path that
 * leaves the Vault is not found. Names are compared case-sensitively.
 * - Starting with `./` or `../`: relative to the article's folder.
 * - Containing `/`: from the Vault's root, else relative to the article's folder.
 * - A bare file name: the file of that name in the article's folder, else the only file of that
 *   name in the Vault; several such files are an `ambiguous` error.
 *
 * @param input The body, the article's path and the Vault's files.
 * @returns The rewritten body and the images, or every error when any reference is rejected.
 */
export async function resolveImages(
  input: ResolveImagesInput,
): Promise<ImageResolution> {
  const { markdown, articlePath, vaultRoot, vaultFiles } = input;
  const refs: ImageRef[] = [];
  mapImages(markdown, (ref) => {
    refs.push(ref);
    return null;
  });

  const files = new Set(vaultFiles);
  const errors: ImageError[] = [];
  const resolved: { path: string; ext: string }[] = [];
  for (const ref of refs) {
    const result = resolveTarget(ref.target, articlePath, files, vaultFiles);
    if (result.ok) {
      resolved.push(result);
    } else {
      errors.push(result.error);
    }
  }
  if (errors.length > 0) return { ok: false, errors };

  const names = new Map<string, string>();
  const images: ImageUpload[] = [];
  for (const { path, ext } of resolved) {
    if (names.has(path)) continue;
    const bytes = await readFile(join(vaultRoot, path));
    const name = `${createHash("sha256").update(bytes).digest("hex")}.${ext}`;
    names.set(path, name);
    if (!images.some((image) => image.name === name)) {
      images.push({ name, path, contentType: CONTENT_TYPES[ext] });
    }
  }

  let index = 0;
  const rewritten = mapImages(markdown, (ref) => {
    const { path } = resolved[index];
    index += 1;
    return imageMarkdown(ref.alt, names.get(path) ?? "");
  });
  return { ok: true, markdown: rewritten, images };
}
