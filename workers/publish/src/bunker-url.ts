/**
 * The bunker URL of NIP-46 (`bunker://<remote signer pubkey>?relay=...&secret=...`) that the
 * Worker holds as the secret `NOSTR_BUNKER_URL`. It tells a client which remote signer to ask
 * for signatures, which relays to reach it on, and the one-time secret for `connect`.
 */

const SCHEME = "bunker://";

const PUBKEY_PATTERN = /^[0-9a-f]{64}$/;

/** Result of {@link parseBunkerUrl}. `message` explains a failure and never contains the URL. */
export type BunkerUrlResult =
  | { ok: true; pubkey: string; relays: string[]; secret: string | undefined }
  | { ok: false; message: string };

/**
 * Reads a bunker URL as `NOSTR_BUNKER_URL` holds it.
 *
 * Spaces around `value` are dropped. The part after `bunker://` and before `?` must be the
 * remote signer's public key in 64 lowercase hex digits. Every `relay` parameter must be a URL
 * that starts with `wss://` or `ws://` and has a host, and at least one is required. Other
 * parameters are ignored. The messages of a failure do not repeat any part of `value`, because
 * `secret` must not reach logs or responses.
 *
 * @param value The bunker URL, or `undefined` when the secret is not set.
 * @returns The remote signer's public key in hex, the relay URLs as given with duplicates
 *   dropped, in the order of the parameters, and the value of `secret` (`undefined` when it is
 *   missing or empty); or a failure.
 */
export function parseBunkerUrl(value: string | undefined): BunkerUrlResult {
  const text = (value ?? "").trim();
  if (text === "") return fail("The bunker URL is not set.");
  if (!text.startsWith(SCHEME)) {
    return fail(`The bunker URL must start with ${SCHEME}.`);
  }
  const rest = text.slice(SCHEME.length);
  const queryStart = rest.indexOf("?");
  const pubkey = queryStart === -1 ? rest : rest.slice(0, queryStart);
  if (!PUBKEY_PATTERN.test(pubkey)) {
    return fail(
      "The bunker URL must have a public key of 64 lowercase hex digits.",
    );
  }
  const params = new URLSearchParams(
    queryStart === -1 ? "" : rest.slice(queryStart + 1),
  );
  const relays: string[] = [];
  for (const relay of params.getAll("relay")) {
    if (!isRelayUrl(relay)) {
      return fail(
        "Every relay of the bunker URL must be a wss:// or ws:// URL.",
      );
    }
    if (!relays.includes(relay)) relays.push(relay);
  }
  if (relays.length === 0) return fail("The bunker URL must have a relay.");
  const secret = params.get("secret");
  return {
    ok: true,
    pubkey,
    relays,
    secret: secret === null || secret === "" ? undefined : secret,
  };
}

function fail(message: string): BunkerUrlResult {
  return { ok: false, message };
}

function isRelayUrl(value: string): boolean {
  return /^wss?:\/\//.test(value) && URL.canParse(value);
}
