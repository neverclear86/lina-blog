import { type Context, Hono } from "hono";
import {
  type ContactErrors,
  type ContactKind,
  validateContact,
} from "./contact";
import { buildContactMail, type ContactMail } from "./contact-mail";
import { negotiateLocale } from "./i18n/negotiate";
import { verifyTurnstile } from "./turnstile";

/**
 * Hono environment of the site Worker. `src/fetch.ts` passes the Worker's `env`. Secrets come
 * from `wrangler secret put` in production and from `.dev.vars` locally, so they may be unset.
 */
export type ApiEnv = {
  Bindings: {
    /** The `send_email` binding in `wrangler.jsonc` that sends the notification. */
    CONTACT_MAIL: { send(message: ContactMail): Promise<unknown> };
    /** Recipient of the contact form notification. */
    CONTACT_MAIL_TO?: string;
    /** Turnstile secret key for siteverify. */
    TURNSTILE_SECRET_KEY?: string;
  };
};

/**
 * JSON body of every `POST /api/contact` response. `invalid` (400) carries the error code of
 * each rejected field; `turnstile` (403) means the Turnstile token was missing or rejected;
 * `failed` (503 when siteverify is unreachable, 500 when a secret is unset or sending fails)
 * means nothing was sent.
 */
export type ContactResponse =
  | { ok: true }
  | { ok: false; error: "invalid"; fields: ContactErrors }
  | { ok: false; error: "turnstile" }
  | { ok: false; error: "failed" };

/** Labels of the "ご用件" values in the notification mail, which is written in Japanese. */
const CONTACT_KIND_LABELS: Record<ContactKind, string> = {
  work: "お仕事のご相談",
  collab: "コラボのお誘い",
  other: "その他",
};

/**
 * Routes that the Worker handles itself, mounted by `src/fetch.ts` before the Astro handlers.
 * Kept separate from the Astro pipeline so it can be tested with `app.request()`; tests pass
 * the bindings as its third argument.
 */
const api = new Hono<ApiEnv>();

api.get("/api/health", (c) => c.json({ ok: true }));

// Validates the form, verifies the Turnstile token, then sends the notification, and answers
// at the first failure. Logs hold fixed text, Turnstile error codes and error names only.
api.post("/api/contact", async (c) => {
  const raw: Record<string, unknown> = await c.req
    .parseBody()
    .catch(() => ({}));
  const validation = validateContact(raw);
  if (!validation.ok) {
    return c.json<ContactResponse>(
      { ok: false, error: "invalid", fields: validation.errors },
      400,
    );
  }

  const secret = c.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    console.error("contact: TURNSTILE_SECRET_KEY is not set");
    return c.json<ContactResponse>({ ok: false, error: "failed" }, 500);
  }

  const token = raw["cf-turnstile-response"];
  const check = await verifyTurnstile({
    token: typeof token === "string" ? token : undefined,
    secret,
    remoteIp: c.req.header("CF-Connecting-IP"),
  });
  if (!check.ok) {
    if (check.reason === "unavailable") {
      console.error("contact: siteverify is unavailable");
      return c.json<ContactResponse>({ ok: false, error: "failed" }, 503);
    }
    if (check.reason === "rejected") {
      console.warn(
        `contact: turnstile rejected (${check.errorCodes.join(", ")})`,
      );
    }
    return c.json<ContactResponse>({ ok: false, error: "turnstile" }, 403);
  }

  const { kind, name, email, message } = validation.value;
  try {
    const mail = buildContactMail(
      { topic: CONTACT_KIND_LABELS[kind], name, email, message },
      c.env.CONTACT_MAIL_TO ?? "",
    );
    await c.env.CONTACT_MAIL.send(mail);
  } catch (error) {
    console.error(
      `contact: send failed (${error instanceof Error ? error.name : typeof error})`,
    );
    return c.json<ContactResponse>({ ok: false, error: "failed" }, 500);
  }
  return c.json<ContactResponse>({ ok: true }, 200);
});

/**
 * Redirects to `/<locale>/`, the top page of the locale that the request's `Accept-Language`
 * prefers (see `negotiateLocale`). The response depends on that header, so it carries
 * `Vary: Accept-Language`.
 */
function redirectToLocale(c: Context): Response {
  c.header("Vary", "Accept-Language");
  return c.redirect(`/${negotiateLocale(c.req.header("Accept-Language"))}/`);
}

// `/` must not have a page in `src/pages/`: the adapter would serve it before this route.
api.get("/", redirectToLocale);

export default api;
