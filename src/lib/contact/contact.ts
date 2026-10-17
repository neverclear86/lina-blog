/**
 * Validation of the contact form input.
 * Pure functions only, so a Hono route can call them and Vitest can test them directly.
 */

/**
 * Values of the form's "ご用件" select, in display order: a work request, a collaboration offer
 * and anything else. Display labels are not part of this module.
 */
export const CONTACT_KINDS = ["work", "collab", "other"] as const;

export type ContactKind = (typeof CONTACT_KINDS)[number];

/**
 * Maximum lengths in UTF-16 code units, counted the way the `maxlength` attribute counts them
 * (after line breaks are normalized to LF). 254 is the longest address that fits an SMTP path.
 */
export const CONTACT_LIMITS = { name: 100, email: 254, message: 5000 } as const;

/** Names of the form fields that `validateContact` reads; other keys of the input are ignored. */
export type ContactField = "kind" | "name" | "email" | "message";

/**
 * Validated input. Line breaks are LF and surrounding whitespace is trimmed; `name` and `email`
 * are single-line, so they are safe to place in mail headers.
 */
export interface ContactInput {
  kind: ContactKind;
  name: string;
  email: string;
  message: string;
}

/**
 * Why a field was rejected. `required`: missing or blank. `invalid`: not a string, a `kind`
 * outside `CONTACT_KINDS`, or a malformed `email`. `too_long`: over `CONTACT_LIMITS`.
 * `newline`: a line break inside `name` or `email`, which would break a mail header.
 */
export type ContactErrorCode = "required" | "invalid" | "too_long" | "newline";

/**
 * One error code per rejected field, keyed by field name; valid fields have no key.
 * Holds codes only, no display text, so the caller turns each code into a localized message.
 */
export type ContactErrors = Partial<Record<ContactField, ContactErrorCode>>;

/** Result of `validateContact`: the validated input, or the errors of every rejected field. */
export type ContactValidation =
  | { ok: true; value: ContactInput }
  | { ok: false; errors: ContactErrors };

/**
 * The HTML standard's "valid email address" pattern, the same check as
 * `<input type="email">`.
 */
const EMAIL_PATTERN =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Checks one text field: presence, type, blankness after normalizing line breaks to LF and
 * trimming, line breaks when `singleLine`, and length against `max`.
 */
function checkText(
  raw: unknown,
  max: number,
  singleLine: boolean,
): { value: string } | { error: ContactErrorCode } {
  if (raw === undefined || raw === null) return { error: "required" };
  if (typeof raw !== "string") return { error: "invalid" };
  const value = raw.replace(/\r\n?/g, "\n").trim();
  if (value === "") return { error: "required" };
  if (singleLine && value.includes("\n")) return { error: "newline" };
  if (value.length > max) return { error: "too_long" };
  return { value };
}

function isContactKind(value: unknown): value is ContactKind {
  return (
    typeof value === "string" &&
    (CONTACT_KINDS as readonly string[]).includes(value)
  );
}

/**
 * Validates the contact form input and returns the normalized values or per-field errors.
 * Every field is checked, so all errors are reported at once. For `name`, `email` and
 * `message`, the first matching rule wins: missing is `required`, a non-string is `invalid`,
 * blank after normalizing line breaks to LF and trimming is `required`, a line break in `name`
 * or `email` is `newline`, over the limit is `too_long`, and an `email` that is not a valid
 * address as defined by the HTML standard's `type=email` is `invalid`.
 */
export function validateContact(
  raw: Record<string, unknown>,
): ContactValidation {
  const errors: ContactErrors = {};

  const kind = raw.kind;
  if (kind === undefined || kind === null || kind === "") {
    errors.kind = "required";
  } else if (!isContactKind(kind)) {
    errors.kind = "invalid";
  }

  const name = checkText(raw.name, CONTACT_LIMITS.name, true);
  if ("error" in name) errors.name = name.error;

  const email = checkText(raw.email, CONTACT_LIMITS.email, true);
  if ("error" in email) {
    errors.email = email.error;
  } else if (!EMAIL_PATTERN.test(email.value)) {
    errors.email = "invalid";
  }

  const message = checkText(raw.message, CONTACT_LIMITS.message, false);
  if ("error" in message) errors.message = message.error;

  if (
    Object.keys(errors).length > 0 ||
    !isContactKind(kind) ||
    "error" in name ||
    "error" in email ||
    "error" in message
  ) {
    return { ok: false, errors };
  }
  return {
    ok: true,
    value: {
      kind,
      name: name.value,
      email: email.value,
      message: message.value,
    },
  };
}
