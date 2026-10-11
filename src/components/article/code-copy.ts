/**
 * The copy buttons of a post's page: the texts and the logic of the copy button of a code block
 * that do not touch the DOM, and `canCopy` and `copyText`, which the copy button at the end of
 * the post (`ArticleEnd.astro`) uses too. `ArticleBody.astro` puts the texts of the code block
 * button on `.article-body` as JSON and its script builds the buttons.
 */

/** Texts of the copy button and of the messages read out after a click. */
export interface CopyLabels {
  /** Accessible name of the button. */
  name: string;
  /** Text of the button while it waits for a click. */
  idle: string;
  /** Text of the button after the code was copied. */
  done: string;
  /** Text of the button after the copy failed. */
  fail: string;
  /** Message read out when the code was copied. */
  doneMessage: string;
  /** Message read out when the copy failed. */
  failMessage: string;
}

/** Result of a click on the copy button. */
export type CopyResult = "copied" | "failed";

const LABEL_KEYS = [
  "name",
  "idle",
  "done",
  "fail",
  "doneMessage",
  "failMessage",
] as const satisfies readonly (keyof CopyLabels)[];

/**
 * Parses the JSON of `CopyLabels` that `ArticleBody.astro` puts in `data-code-copy`. Returns
 * `undefined` for a missing value, text that is not JSON, JSON that is not an object, and an
 * object in which a key of `CopyLabels` is missing or not a string.
 */
export function parseCopyLabels(
  value: string | undefined,
): CopyLabels | undefined {
  if (value === undefined) {
    return undefined;
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    return undefined;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return undefined;
  }
  const record = parsed as Record<string, unknown>;
  if (!LABEL_KEYS.every((key) => typeof record[key] === "string")) {
    return undefined;
  }
  return Object.fromEntries(
    LABEL_KEYS.map((key) => [key, record[key]]),
  ) as unknown as CopyLabels;
}

/**
 * Whether a copy button works for `code`, the code of a code block or the address that the
 * button copies: the browser has a function that writes to the clipboard (`writeText` of
 * `navigator.clipboard`, which is missing outside a secure context), and `code` has something
 * other than whitespace.
 */
export function canCopy(writeText: unknown, code: string): boolean {
  return typeof writeText === "function" && code.trim() !== "";
}

/**
 * Writes `text` with `writeText` and returns `"copied"`. Returns `"failed"` when `writeText`
 * rejects or throws (the user denied the permission, or the document is not focused). It never
 * throws.
 */
export async function copyText(
  writeText: (text: string) => Promise<void>,
  text: string,
): Promise<CopyResult> {
  try {
    await writeText(text);
    return "copied";
  } catch {
    return "failed";
  }
}
