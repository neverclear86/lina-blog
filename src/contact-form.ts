/**
 * What the contact form shows: the state before and after a submission, the text of its status
 * line and the text under a rejected field, and the size of the Turnstile widget. No DOM access,
 * so a browser script can call these functions and Vitest can test them directly.
 * `POST /api/contact` answers with a `ContactResponse` of `src/api.ts`.
 */
import {
  CONTACT_LIMITS,
  type ContactErrorCode,
  type ContactErrors,
  type ContactField,
  validateContact,
} from "./contact";
import type { Locale } from "./i18n/locales";
import { translate, type UiKey } from "./i18n/ui";

/**
 * What the contact form shows. Before a request, `contactStateBeforeSend` returns `invalid`,
 * `unavailable` when the Turnstile widget failed to load, `waiting` while its token is not issued
 * yet, or `sending` when the request can go. After it, `contactStateFromFetch` returns `sent`,
 * `invalid`, `turnstile`, `failed` or `network`. `idle` is the state before any submission.
 * `invalid` carries the error code of each rejected field, from `validateContact` or from a 400
 * response.
 */
export type ContactFormState =
  | { state: "idle" }
  | { state: "invalid"; fields: ContactErrors }
  | { state: "waiting" }
  | { state: "sending" }
  | { state: "sent" }
  | { state: "turnstile" }
  | { state: "failed" }
  | { state: "network" }
  | { state: "unavailable" };

// Field names and error codes that a 400 response may carry, as in src/contact.ts.
const FIELDS: readonly ContactField[] = ["kind", "name", "email", "message"];
const CODES: readonly ContactErrorCode[] = [
  "required",
  "invalid",
  "too_long",
  "newline",
];

/** Whether `value` is a non-null object, such as a parsed JSON object. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Keeps the entries of a 400 response's `fields` whose key is a field and whose value is a
 * code; anything but an object keeps none.
 */
function pickErrors(raw: unknown): ContactErrors {
  const errors: ContactErrors = {};
  if (!isRecord(raw)) return errors;
  for (const field of FIELDS) {
    const code = raw[field];
    if (CODES.includes(code as ContactErrorCode)) {
      errors[field] = code as ContactErrorCode;
    }
  }
  return errors;
}

/**
 * Maps a parsed response body to a state by its `ok` and `error`; the status code is not read.
 * Anything that is not a `ContactResponse` counts as `failed`.
 */
function contactStateFromBody(body: unknown): ContactFormState {
  if (!isRecord(body)) return { state: "failed" };
  if (body.ok === true) return { state: "sent" };
  if (body.error === "invalid") {
    const fields = pickErrors(body.fields);
    return Object.keys(fields).length > 0
      ? { state: "invalid", fields }
      : { state: "failed" };
  }
  if (body.error === "turnstile") return { state: "turnstile" };
  return { state: "failed" };
}

/**
 * Awaits a `fetch` of `POST /api/contact` and returns the state to show. A rejected `pending`
 * (the request never got a response) is `network`. Otherwise the JSON body decides, whatever the
 * status code: `{ ok: true }` is `sent`; `error: "invalid"` is `invalid` with the known fields
 * and codes of `fields`, or `failed` when none is left; `error: "turnstile"` is `turnstile`;
 * `error: "failed"`, any other body and a body that is not JSON are `failed`.
 */
export async function contactStateFromFetch(
  pending: Promise<Response>,
): Promise<ContactFormState> {
  let response: Response;
  try {
    response = await pending;
  } catch {
    return { state: "network" };
  }
  const body: unknown = await response.json().catch(() => undefined);
  return contactStateFromBody(body);
}

/** UI string key of the status line for each state; `idle` shows nothing. */
const STATE_KEYS: Record<Exclude<ContactFormState["state"], "idle">, UiKey> = {
  invalid: "contact.status.invalid",
  waiting: "contact.status.waiting",
  sending: "contact.status.sending",
  sent: "contact.status.sent",
  turnstile: "contact.status.turnstile",
  failed: "contact.status.failed",
  network: "contact.status.network",
  unavailable: "contact.status.unavailable",
};

/** Returns the status line text for `state` in `locale`: empty for `idle`. */
export function contactStateMessage(
  locale: Locale,
  state: ContactFormState,
): string {
  if (state.state === "idle") return "";
  return translate(locale, STATE_KEYS[state.state]);
}

/**
 * Returns the text shown under `field` for `code` in `locale`. `kind` is a select, so
 * `required` asks to choose one and every other code asks to choose one of the options. For
 * the other fields, `invalid` asks for an email address on `email` and for a valid value on
 * `name` and `message`, and `too_long` states the limit from `CONTACT_LIMITS`.
 */
export function contactFieldMessage(
  locale: Locale,
  field: ContactField,
  code: ContactErrorCode,
): string {
  if (field === "kind") {
    return translate(
      locale,
      code === "required"
        ? "contact.error.requiredChoice"
        : "contact.error.invalidChoice",
    );
  }
  switch (code) {
    case "required":
      return translate(locale, "contact.error.required");
    case "invalid":
      return translate(
        locale,
        field === "email"
          ? "contact.error.invalidEmail"
          : "contact.error.invalid",
      );
    case "too_long":
      return translate(locale, "contact.error.tooLong").replace(
        "{max}",
        String(CONTACT_LIMITS[field]),
      );
    case "newline":
      return translate(locale, "contact.error.newline");
  }
}

/**
 * What the page knows about the Turnstile widget when the visitor submits: whether it failed to
 * load, and its current token (`undefined` or empty until one is issued and after it expires).
 */
export interface TurnstileStatus {
  failed: boolean;
  token: string | undefined;
}

/**
 * Decides, before any request, what a submission of `values` shows. Rejected fields come first
 * and give `invalid` with the code of each; then a widget that failed to load gives
 * `unavailable`, and a missing or empty token gives `waiting`. Otherwise the form can be sent
 * and the state is `sending`. `values` are the form's entries, such as
 * `Object.fromEntries(new FormData(form))`; keys other than the fields are ignored.
 */
export function contactStateBeforeSend(
  values: Record<string, unknown>,
  turnstile: TurnstileStatus,
): ContactFormState {
  const validation = validateContact(values);
  if (!validation.ok) return { state: "invalid", fields: validation.errors };
  if (turnstile.failed) return { state: "unavailable" };
  if (!turnstile.token) return { state: "waiting" };
  return { state: "sending" };
}

/** Narrowest width, in CSS pixels, of the Turnstile widget with `size: "flexible"`. */
const TURNSTILE_FLEXIBLE_MIN_WIDTH = 300;

/**
 * Returns the Turnstile `size` for a container `width` px wide: `flexible` when the flexible
 * widget fits, otherwise `compact`.
 */
export function turnstileSize(width: number): "flexible" | "compact" {
  return width >= TURNSTILE_FLEXIBLE_MIN_WIDTH ? "flexible" : "compact";
}
