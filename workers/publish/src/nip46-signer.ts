/**
 * Asking the remote signer of a bunker URL (NIP-46) to sign an event: one WebSocket connection
 * to its relay, over which the requests built by `nip46-message.ts` go out and the responses
 * come back. The connection is closed when the signed event is returned, when anything fails,
 * and when the time limit runs out, and no function here throws.
 */
import {
  type EventTemplate,
  type NostrEvent,
  validateEvent,
  verifyEvent,
} from "nostr-tools/pure";
import {
  buildNip46Request,
  type Nip46Result,
  type Nip46Session,
  readNip46Response,
} from "./nip46-message";

/** Time limit of one signing in milliseconds, from opening the connection to the result. */
const DEFAULT_TIMEOUT_MS = 10_000;

const SUBSCRIPTION_ID = "nip46";

/** Key of the wait for the connection to open (a request `id` is never empty). */
const OPENING = "";

/** Result of {@link signEventWithBunker}. `message` explains a failure for the error body. */
export type SignResult = Nip46Result<{ event: NostrEvent }>;

/** Answer to one request. `bunkerError` is set only when the signer answered with an error. */
type Reply =
  | { ok: true; result: string }
  | { ok: false; message: string; bunkerError?: string };

type Link = {
  opened: Promise<Reply>;
  call: (method: string, params: string[]) => Promise<Reply>;
  close: () => void;
};

/**
 * Has the remote signer sign an event, over the relay of the bunker URL.
 *
 * Connects to the first relay only, because a signer answers on every relay it listens to and
 * each extra connection would bring a duplicate of every response to verify. Subscribes to the
 * signer's responses to the client, then asks `get_public_key` for the user's public key and
 * `sign_event` for the signature. When the signer answers `get_public_key` with an error that
 * starts with `unauthorized`, it does not know this client yet: sends `connect` with the secret
 * and the permission to sign this kind, and asks `get_public_key` again. A client that the
 * signer already knows is never sent `connect`.
 *
 * A response that is not from the signer, is not valid, or answers another request is skipped.
 * A failure is returned when the connection or the relay fails, the signer answers with an
 * error (also a `connect` that needs approval), the time runs out, or the signed event is not
 * a valid event of the public key from `get_public_key`.
 *
 * @param template The event to sign, without `pubkey`, `id` and `sig`. It is sent as it is, so
 *   its JSON must fit one NIP-46 request (65535 bytes).
 * @param options.session From `openNip46Session`; it holds the signer's public key.
 * @param options.relays Relay URLs of the bunker URL, at least one. Only the first is used.
 * @param options.secret `secret` of the bunker URL, or `undefined` when it has none.
 * @param options.now The time the requests are created, within 10 minutes past and 60 seconds
 *   ahead of the signer's clock.
 * @param options.timeoutMs Time limit of the whole signing.
 * @returns The signed event, or a failure.
 */
export async function signEventWithBunker(
  template: EventTemplate,
  options: {
    session: Nip46Session;
    relays: string[];
    secret: string | undefined;
    now: Date;
    timeoutMs?: number;
  },
): Promise<SignResult> {
  const { session, relays, secret, now } = options;
  const link = openLink(
    relays[0],
    session,
    now,
    options.timeoutMs ?? DEFAULT_TIMEOUT_MS,
  );
  try {
    const result = await signOver(link, template, session, secret);
    return result.ok ? result : fail(result.message);
  } finally {
    link.close();
  }
}

/** The requests of {@link signEventWithBunker}. */
async function signOver(
  link: Link,
  template: EventTemplate,
  session: Nip46Session,
  secret: string | undefined,
): Promise<SignResult> {
  const opened = await link.opened;
  if (!opened.ok) return opened;
  let pubkey = await link.call("get_public_key", []);
  if (!pubkey.ok && pubkey.bunkerError?.startsWith("unauthorized")) {
    const connected = await link.call("connect", [
      session.signerPubkey,
      secret ?? "",
      `sign_event:${template.kind}`,
    ]);
    if (!connected.ok) return connected;
    pubkey = await link.call("get_public_key", []);
  }
  if (!pubkey.ok) return pubkey;
  const signed = await link.call("sign_event", [JSON.stringify(template)]);
  if (!signed.ok) return signed;
  return readSignedEvent(signed.result, pubkey.result);
}

/** Checks the `result` of `sign_event`: a valid event of `pubkey`. */
function readSignedEvent(text: string, pubkey: string): SignResult {
  let event: unknown;
  try {
    event = JSON.parse(text);
  } catch {
    return fail("sign_event: The result is not JSON");
  }
  if (!validateEvent(event) || !verifyEvent(event as NostrEvent)) {
    return fail("sign_event: The signed event is not valid");
  }
  if (event.pubkey !== pubkey) {
    return fail(
      "sign_event: The event is signed by another key than get_public_key",
    );
  }
  return { ok: true, event: event as NostrEvent };
}

/**
 * Opens the connection to `relay` and subscribes once it is open. A request waits for its
 * response, one at a time. Once the link has failed, closed, or run out of `timeoutMs`, every
 * wait fails with the first reason.
 */
function openLink(
  relay: string,
  session: Nip46Session,
  now: Date,
  timeoutMs: number,
): Link {
  let waiting:
    | { key: string; eventId: string; resolve: (reply: Reply) => void }
    | undefined;
  let down: string | undefined;
  const wait = (key: string, eventId = ""): Promise<Reply> =>
    new Promise((resolve) => {
      if (down === undefined) waiting = { key, eventId, resolve };
      else resolve({ ok: false, message: down });
    });
  const answer = (key: string, reply: Reply) => {
    if (waiting?.key !== key) return;
    const { resolve } = waiting;
    waiting = undefined;
    resolve(reply);
  };
  const breakLink = (message: string) => {
    down ??= message;
    if (waiting !== undefined) {
      answer(waiting.key, { ok: false, message: down });
    }
  };
  const timer = setTimeout(
    () => breakLink(`Timed out after ${timeoutMs} ms.`),
    timeoutMs,
  );
  let socket: WebSocket | undefined;
  try {
    socket = new WebSocket(relay);
  } catch {
    breakLink("Invalid relay URL.");
  }
  const opened = wait(OPENING);
  socket?.addEventListener("open", () => {
    socket?.send(
      JSON.stringify([
        "REQ",
        SUBSCRIPTION_ID,
        {
          kinds: [24133],
          authors: [session.signerPubkey],
          "#p": [session.clientPubkey],
        },
      ]),
    );
    answer(OPENING, { ok: true, result: "" });
  });
  socket?.addEventListener("message", (event) => {
    let message: unknown;
    try {
      message = JSON.parse(String(event.data));
    } catch {
      return;
    }
    if (!Array.isArray(message)) return;
    if (message[0] === "CLOSED" && message[1] === SUBSCRIPTION_ID) {
      breakLink(
        `The relay closed the subscription: ${String(message[2] ?? "")}`,
      );
    } else if (
      message[0] === "OK" &&
      message[2] === false &&
      waiting !== undefined &&
      message[1] === waiting.eventId
    ) {
      answer(waiting.key, {
        ok: false,
        message: `The relay did not accept the request: ${String(message[3] ?? "")}`,
      });
    } else if (message[0] === "EVENT" && message[1] === SUBSCRIPTION_ID) {
      const read = readNip46Response(session, message[2]);
      if (!read.ok) return;
      const { id, result, error } = read.response;
      answer(
        id,
        error === undefined
          ? { ok: true, result: result ?? "" }
          : { ok: false, message: error, bunkerError: error },
      );
    }
  });
  socket?.addEventListener("error", () => breakLink("Connection failed."));
  socket?.addEventListener("close", () => breakLink("Connection closed."));
  return {
    opened,
    call: async (method, params) => {
      const id = crypto.randomUUID();
      const built = buildNip46Request(session, { id, method, params }, now);
      if (!built.ok) {
        return { ok: false, message: `${method}: ${built.message}` };
      }
      const reply = wait(id, built.event.id);
      if (down === undefined) {
        try {
          socket?.send(JSON.stringify(["EVENT", built.event]));
        } catch {
          breakLink("Connection failed.");
        }
      }
      const settled = await reply;
      return settled.ok
        ? settled
        : { ...settled, message: `${method}: ${settled.message}` };
    },
    close: () => {
      clearTimeout(timer);
      try {
        socket?.close();
      } catch {
        // The socket may already be closed or never opened.
      }
    },
  };
}

function fail(message: string): { ok: false; message: string } {
  return { ok: false, message };
}
