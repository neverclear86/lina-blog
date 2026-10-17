/** Cloudflare's endpoint that checks a Turnstile token against the secret key. */
const SITEVERIFY_URL =
  "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Result of {@link verifyTurnstile}. Every failure has `ok: false`, and `reason` tells the
 * failures apart so that the caller can choose its response:
 * - `missing-token`: the request carried no token, so siteverify was not called.
 * - `rejected`: siteverify answered that the token did not pass. `errorCodes` holds its
 *   `error-codes` (empty when it sent none). They describe the token and the secret key,
 *   not the visitor, so they can be logged.
 * - `unavailable`: siteverify could not be reached, answered with a non-2xx status, or sent
 *   a body that is not JSON.
 */
export type TurnstileVerification =
  | { ok: true }
  | { ok: false; reason: "missing-token" }
  | { ok: false; reason: "rejected"; errorCodes: string[] }
  | { ok: false; reason: "unavailable" };

/**
 * Verifies a Turnstile token by posting it to siteverify with the secret key and, when given,
 * the visitor's IP address. Only a response with `success: true` counts as passed.
 *
 * @param input.token The `cf-turnstile-response` value sent by the form. `undefined`, `null`
 *   and the empty string count as missing.
 * @param input.secret The Turnstile secret key.
 * @param input.remoteIp The visitor's IP address, sent as `remoteip` when given.
 * @param fetchImpl The `fetch` to call. It is called as a plain function, never as a method,
 *   because workerd rejects `fetch` called with another `this`. Tests pass a stub so that
 *   they never reach the network.
 * @returns `{ ok: true }` when the token passed, otherwise one of the failures described in
 *   {@link TurnstileVerification}. It never throws.
 */
export async function verifyTurnstile(
  {
    token,
    secret,
    remoteIp,
  }: { token: string | null | undefined; secret: string; remoteIp?: string },
  fetchImpl: typeof fetch = fetch,
): Promise<TurnstileVerification> {
  if (!token) {
    return { ok: false, reason: "missing-token" };
  }

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp) {
    body.set("remoteip", remoteIp);
  }

  let data: unknown;
  try {
    const res = await fetchImpl(SITEVERIFY_URL, { method: "POST", body });
    if (!res.ok) {
      return { ok: false, reason: "unavailable" };
    }
    data = await res.json();
  } catch {
    return { ok: false, reason: "unavailable" };
  }

  const result = (data ?? {}) as { success?: unknown; "error-codes"?: unknown };
  if (result.success === true) {
    return { ok: true };
  }
  const codes = result["error-codes"];
  const errorCodes = Array.isArray(codes)
    ? codes.filter((code): code is string => typeof code === "string")
    : [];
  return { ok: false, reason: "rejected", errorCodes };
}
