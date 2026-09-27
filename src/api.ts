import { type Context, Hono } from "hono";
import { secureHeaders } from "hono/secure-headers";
import {
  type ContactErrors,
  type ContactKind,
  validateContact,
} from "./contact";
import { buildContactMail, type ContactMail } from "./contact-mail";
import type { Locale } from "./i18n/locales";
import { negotiateLocale } from "./i18n/negotiate";
import { verifyTurnstile } from "./turnstile";
import { isCommandLineClient } from "./user-agent";

/**
 * Hono environment of the site Worker. `src/fetch.ts` passes the Worker's `env`. Secrets come
 * from `wrangler secret put` in production and from `.dev.vars` locally, so they may be unset.
 */
export type ApiEnv = {
  Bindings: {
    /** Workers Static Assets, serving the files that `astro build` writes to `dist/client/`. */
    ASSETS: { fetch(input: URL): Promise<Response> };
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
 * prefers (see `negotiateLocale`). `serveRoot` sets the `Vary` header of the response.
 */
function redirectToLocale(c: Context): Response {
  return c.redirect(`/${negotiateLocale(c.req.header("Accept-Language"))}/`);
}

// A `_headers` file applies to static assets only, not to responses from this Worker, so
// `secureHeaders()` adds Hono's default set (`Strict-Transport-Security`,
// `X-Content-Type-Options: nosniff`, `X-Frame-Options: SAMEORIGIN`, `Referrer-Policy:
// no-referrer` and others) to every response of `/`. It runs for `/` only, not for `/api/*`.
api.use("/", secureHeaders());

/** Path of the text art that `/` shows command-line clients above the text version. */
const ANSI_ART_PATH = "/ansi/color.txt";

/**
 * Returns the body of the static asset at `path`, fetched through the `ASSETS` binding with the
 * origin of the request. Returns `undefined` when the response is not 2xx or the fetch throws,
 * and logs the path with the status or the error name.
 */
async function fetchAsset(
  c: Context<ApiEnv>,
  path: string,
): Promise<string | undefined> {
  try {
    const res = await c.env.ASSETS.fetch(new URL(path, c.req.url));
    if (!res.ok) {
      console.error(`root: ${path} answered ${res.status}`);
      return undefined;
    }
    return await res.text();
  } catch (error) {
    console.error(
      `root: ${path} failed (${error instanceof Error ? error.name : typeof error})`,
    );
    return undefined;
  }
}

/** Text that `/` returns with 503 when the text version cannot be fetched, by locale. */
const TEXT_UNAVAILABLE: Record<Locale, (top: string) => string> = {
  ja: (top) =>
    `ikili.pro\nテキスト版を表示できませんでした。ブラウザで ${top} を開いてください。\n`,
  en: (top) =>
    `ikili.pro\nThe text version is unavailable. Open ${top} in a browser.\n`,
};

/**
 * Answers command-line clients at `/` with `text/plain`: the text art at `ANSI_ART_PATH`, a
 * blank line, then the text version `/text/<locale>.txt` in the locale that `Accept-Language`
 * prefers (see `negotiateLocale`), both fetched by `fetchAsset`. Without the text art, the text
 * version alone is returned with 200. Without the text version, `TEXT_UNAVAILABLE` is returned
 * with 503.
 */
async function serveText(c: Context<ApiEnv>): Promise<Response> {
  const locale = negotiateLocale(c.req.header("Accept-Language"));
  const [art, text] = await Promise.all([
    fetchAsset(c, ANSI_ART_PATH),
    fetchAsset(c, `/text/${locale}.txt`),
  ]);
  if (text === undefined) {
    return c.text(
      TEXT_UNAVAILABLE[locale](new URL(`/${locale}/`, c.req.url).href),
      503,
    );
  }
  return c.text(art === undefined ? text : `${art}\n${text}`);
}

/**
 * Answers `/`. Command-line clients such as curl (see `isCommandLineClient`) get `serveText`,
 * and other clients are redirected by `redirectToLocale`. The response depends on both request
 * headers, so it carries `Vary: User-Agent, Accept-Language`.
 */
async function serveRoot(c: Context<ApiEnv>): Promise<Response> {
  c.header("Vary", "User-Agent, Accept-Language");
  if (isCommandLineClient(c.req.header("User-Agent"))) {
    return await serveText(c);
  }
  return redirectToLocale(c);
}

// `/` must not have a page in `src/pages/`: the adapter would serve it before this route.
api.get("/", serveRoot);

export default api;
