/**
 * The messages of NIP-46 (Nostr Connect): a request to the remote signer as a kind 24133 event
 * with its JSON encrypted with NIP-44, and the signer's response read from such an event. The
 * WebSocket exchange with the relays is not here, so no function here touches the network.
 */
import { decrypt, encrypt, getConversationKey } from "nostr-tools/nip44";
import {
  finalizeEvent,
  getPublicKey,
  type NostrEvent,
  validateEvent,
  verifyEvent,
} from "nostr-tools/pure";
import { hexToBytes } from "nostr-tools/utils";

const NIP46_KIND = 24133;

/**
 * The longest plaintext in bytes that NIP-44 allows, because its length prefix is 2 bytes.
 * The nostr-no-su bunker drops a request longer than 65536 bytes without an answer.
 */
const MAX_PLAINTEXT_BYTES = 65535;

/**
 * The longest `content` read: the base64 length of the longest NIP-44 payload, which is the
 * version byte, the nonce, the padded plaintext with its 2-byte length, and the MAC.
 */
const MAX_CONTENT_LENGTH = 87472;

const HEX_PATTERN = /^[0-9a-f]{64}$/;

/*
 * Making a public key builds the table of multiples of the curve's base point that every
 * signature needs. Doing it when the module loads keeps that work out of the first request.
 */
getPublicKey(new Uint8Array(32).fill(1));

/** A NIP-46 request. `id` pairs it with its response. */
export type Nip46Request = {
  id: string;
  method: string;
  params: string[];
};

/** A NIP-46 response. `result` and `error` are `undefined` when the signer left them out. */
export type Nip46Response = {
  id: string;
  result: string | undefined;
  error: string | undefined;
};

/**
 * The keys for talking to one remote signer, made by {@link openNip46Session}. It holds the
 * secret client key and the conversation key, so it must not be logged.
 */
export type Nip46Session = {
  clientKey: Uint8Array;
  /** In lowercase hex. */
  clientPubkey: string;
  /** In lowercase hex. */
  signerPubkey: string;
  conversationKey: Uint8Array;
};

/** Result of the functions here. `message` explains a failure and never holds a key. */
export type Nip46Result<T> =
  | ({ ok: true } & T)
  | { ok: false; message: string };

/**
 * Derives the keys for talking to a remote signer: the client's public key and the NIP-44
 * conversation key. The conversation key costs one elliptic-curve multiplication, so one
 * session can be made per signer and reused for every message to it.
 *
 * @param clientKey NIP-46 client secret key, 64 lowercase hex characters.
 * @param signerPubkey Public key of the remote signer, 64 lowercase hex characters.
 * @returns The session, or a failure when a key is not 64 lowercase hex characters or is not
 *   a valid key. Never throws.
 */
export function openNip46Session(
  clientKey: string,
  signerPubkey: string,
): Nip46Result<{ session: Nip46Session }> {
  if (!HEX_PATTERN.test(clientKey)) {
    return fail("Client key is not 64 lowercase hex characters");
  }
  if (!HEX_PATTERN.test(signerPubkey)) {
    return fail("Signer public key is not 64 lowercase hex characters");
  }
  try {
    const key = hexToBytes(clientKey);
    return {
      ok: true,
      session: {
        clientKey: key,
        clientPubkey: getPublicKey(key),
        signerPubkey,
        conversationKey: getConversationKey(key, signerPubkey),
      },
    };
  } catch {
    return fail("Client key or signer public key is not a valid key");
  }
}

/** The JSON of a request, as the bunker decrypts it. */
function requestPlaintext(request: Nip46Request): string {
  return JSON.stringify({
    id: request.id,
    method: request.method,
    params: request.params,
  });
}

/**
 * Tells whether a request fits in one NIP-46 request: whether its JSON is at most 65535 bytes,
 * the limit that {@link buildNip46Request} fails beyond.
 */
export function fitsNip46Request(request: Nip46Request): boolean {
  return (
    new TextEncoder().encode(requestPlaintext(request)).length <=
    MAX_PLAINTEXT_BYTES
  );
}

/**
 * Builds the kind 24133 event that carries a NIP-46 request: the request as JSON, encrypted
 * with NIP-44, in `content`; one `p` tag with the signer's public key; signed with the client
 * key.
 *
 * @param session From {@link openNip46Session}.
 * @param request The request to send.
 * @param now The time the event is created. `created_at` is its UNIX time in seconds, rounded
 *   down.
 * @returns The signed event, or a failure when the request JSON is longer than 65535 bytes,
 *   the longest plaintext NIP-44 allows. Encryption throws only for an empty plaintext and
 *   signing only for an invalid key, so this does not throw for a session from
 *   {@link openNip46Session}.
 */
export function buildNip46Request(
  session: Nip46Session,
  request: Nip46Request,
  now: Date,
): Nip46Result<{ event: NostrEvent }> {
  const plaintext = requestPlaintext(request);
  const bytes = new TextEncoder().encode(plaintext).length;
  if (bytes > MAX_PLAINTEXT_BYTES) {
    return fail(
      `Request is ${bytes} bytes; NIP-44 allows ${MAX_PLAINTEXT_BYTES}`,
    );
  }
  const event = finalizeEvent(
    {
      kind: NIP46_KIND,
      created_at: Math.floor(now.getTime() / 1000),
      tags: [["p", session.signerPubkey]],
      content: encrypt(plaintext, session.conversationKey),
    },
    session.clientKey,
  );
  return { ok: true, event };
}

/**
 * Reads a NIP-46 response from a kind 24133 event received from a relay.
 *
 * The checks run in this order and the first to fail is the failure: the event has the
 * properties of an event; `kind` is 24133; `pubkey` is the signer's; `content` is not longer
 * than a NIP-44 payload can be; the signature is valid; `content` decrypts with NIP-44 (NIP-04
 * is not accepted); the plaintext is JSON; and the JSON is an object whose `id` is a non-empty
 * string and whose `result` and `error` are each a string, missing or `null`. The `p` tag is
 * not checked, because only the signer or the client can make a payload that decrypts.
 *
 * @param session From {@link openNip46Session}.
 * @param event The event as parsed from the relay's JSON, not yet trusted.
 * @returns The response, or a failure. Never throws.
 */
export function readNip46Response(
  session: Nip46Session,
  event: unknown,
): Nip46Result<{ response: Nip46Response }> {
  if (!validateEvent(event)) return fail("Not a well-formed event");
  if (event.kind !== NIP46_KIND) {
    return fail(`Event is kind ${event.kind}, not ${NIP46_KIND}`);
  }
  if (event.pubkey !== session.signerPubkey) {
    return fail("Event is not from the signer");
  }
  if (event.content.length > MAX_CONTENT_LENGTH) {
    return fail("Event content is too long");
  }
  if (!verifyEvent(event as NostrEvent)) {
    return fail("Event signature is not valid");
  }
  let body: unknown;
  try {
    body = JSON.parse(decrypt(event.content, session.conversationKey));
  } catch {
    return fail("Event content is not NIP-44 encrypted JSON");
  }
  if (typeof body !== "object" || body === null) {
    return fail("Response is not a JSON object");
  }
  const { id, result, error } = body as Record<string, unknown>;
  if (
    typeof id !== "string" ||
    id === "" ||
    !isText(result) ||
    !isText(error)
  ) {
    return fail("Response has an unexpected shape");
  }
  return {
    ok: true,
    response: {
      id,
      result: result ?? undefined,
      error: error ?? undefined,
    },
  };
}

/** Whether a field of a response is a string, missing or `null`. */
function isText(value: unknown): value is string | null | undefined {
  return value === undefined || value === null || typeof value === "string";
}

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}
