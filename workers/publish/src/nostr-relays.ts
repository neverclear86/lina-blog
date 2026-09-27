/**
 * WebSocket exchanges with Nostr relays: reading the author's relay list (kind 10002) and
 * sending a signed event. Every connection is closed when its answer arrives, when the relay
 * fails, or when the time limit runs out, and no function here throws.
 */

/** Relays that the relay list is read from when `NOSTR_INDEX_RELAYS` is not set. */
export const DEFAULT_INDEX_RELAYS = [
  "wss://purplepag.es",
  "wss://relay.damus.io",
  "wss://yabu.me",
];

/**
 * Relays that {@link publishToRelays} sends to by default: the six simultaneous connections
 * of a Worker minus one for the bunker.
 */
const DEFAULT_MAX_RELAYS = 5;

/** Time limit of one relay connection in milliseconds, from opening to the answer. */
const DEFAULT_TIMEOUT_MS = 5_000;

const SUBSCRIPTION_ID = "relay-list";

/** Result of {@link fetchWriteRelays}. `message` explains a failure for the error body. */
export type WriteRelaysResult =
  | { ok: true; relays: string[] }
  | { ok: false; message: string };

/** Answer of one relay to `EVENT`. `message` is the relay's `OK` message or why it failed. */
export type RelayPublishResult = {
  relay: string;
  accepted: boolean;
  message: string;
};

/** Result of {@link publishToRelays}. `results` follows the order of the given relays. */
export type PublishResult =
  | { ok: true; results: RelayPublishResult[] }
  | { ok: false; message: string; results: RelayPublishResult[] };

type RelayListEvent = {
  id: string;
  pubkey: string;
  created_at: number;
  kind: number;
  tags: unknown[];
};

/**
 * Reads the relays to read the relay list from, as `NOSTR_INDEX_RELAYS` holds them.
 *
 * @param value Comma-separated relay URLs. Spaces around each URL and empty items are dropped.
 * @returns The URLs, or {@link DEFAULT_INDEX_RELAYS} when `value` is unset or has no URL.
 */
export function parseRelayUrls(value: string | undefined): string[] {
  const urls = (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item !== "");
  return urls.length > 0 ? urls : DEFAULT_INDEX_RELAYS;
}

/**
 * Finds the author's write relays in their newest relay list (kind 10002, NIP-65).
 *
 * Asks every relay in `relays` at once, so it opens as many connections as `relays` has. Events
 * whose `kind` or `pubkey` does not match are ignored; signatures are not checked. The newest
 * event is the one with the largest `created_at`, and on a tie the one with the smallest `id`.
 * An `r` tag is a write relay when it has no third item or the third item is `write`, and its
 * URL starts with `wss://` or `ws://`. Duplicate URLs are kept once, in the order of the tags.
 *
 * @param pubkey Author's public key in lowercase hex.
 * @param relays Relays to read from.
 * @param timeoutMs Time limit of each connection.
 * @returns The write relays (possibly none), or a failure when no relay returned a relay list.
 */
export async function fetchWriteRelays(
  pubkey: string,
  relays: string[],
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<WriteRelaysResult> {
  const events = (
    await Promise.all(
      relays.map((relay) => readRelayList(relay, pubkey, timeoutMs)),
    )
  ).flat();
  let newest: RelayListEvent | undefined;
  for (const event of events) {
    if (
      newest === undefined ||
      event.created_at > newest.created_at ||
      (event.created_at === newest.created_at && event.id < newest.id)
    ) {
      newest = event;
    }
  }
  if (newest === undefined) {
    return {
      ok: false,
      message: `No relay list (kind 10002) found for ${pubkey}.`,
    };
  }
  return { ok: true, relays: writeRelaysOf(newest) };
}

/**
 * Sends a signed event to relays and collects their `OK` answers.
 *
 * Only the first `maxRelays` relays are used, and they are all opened at once. A relay that
 * answers `OK` with `false`, fails, closes, or does not answer within `timeoutMs` counts as not
 * accepting the event.
 *
 * @param event Signed event; only its `id` is read, and it is sent as it is.
 * @param relays Relays to send to, in order of preference.
 * @param maxRelays Positive integer; how many of `relays` are sent to.
 * @param timeoutMs Time limit of each connection.
 * @returns Success when at least one relay accepted the event, and the answer of each relay
 *   that was sent to, in the order of `relays`.
 */
export async function publishToRelays(
  event: { id: string },
  relays: string[],
  maxRelays = DEFAULT_MAX_RELAYS,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<PublishResult> {
  const results = await Promise.all(
    relays
      .slice(0, maxRelays)
      .map((relay) => sendEvent(relay, event, timeoutMs)),
  );
  if (results.some((result) => result.accepted)) {
    return { ok: true, results };
  }
  return { ok: false, message: "No relay accepted the event.", results };
}

function readRelayList(
  relay: string,
  pubkey: string,
  timeoutMs: number,
): Promise<RelayListEvent[]> {
  const events: RelayListEvent[] = [];
  return exchange<RelayListEvent[]>(
    relay,
    ["REQ", SUBSCRIPTION_ID, { kinds: [10002], authors: [pubkey], limit: 1 }],
    timeoutMs,
    (message) => {
      if (message[0] === "EVENT") {
        if (isRelayListOf(message[2], pubkey)) events.push(message[2]);
        return undefined;
      }
      if (message[0] === "EOSE" || message[0] === "CLOSED") return events;
      return undefined;
    },
    () => events,
  );
}

function sendEvent(
  relay: string,
  event: { id: string },
  timeoutMs: number,
): Promise<RelayPublishResult> {
  return exchange<RelayPublishResult>(
    relay,
    ["EVENT", event],
    timeoutMs,
    (message) => {
      if (message[0] !== "OK" || message[1] !== event.id) return undefined;
      return {
        relay,
        accepted: message[2] === true,
        message: typeof message[3] === "string" ? message[3] : "",
      };
    },
    (reason) => ({ relay, accepted: false, message: reason }),
  );
}

function isRelayListOf(
  value: unknown,
  pubkey: string,
): value is RelayListEvent {
  if (typeof value !== "object" || value === null) return false;
  const event = value as Record<string, unknown>;
  return (
    event.kind === 10002 &&
    event.pubkey === pubkey &&
    typeof event.id === "string" &&
    typeof event.created_at === "number" &&
    Array.isArray(event.tags)
  );
}

function writeRelaysOf(event: RelayListEvent): string[] {
  const urls: string[] = [];
  for (const tag of event.tags) {
    if (!Array.isArray(tag) || tag[0] !== "r" || typeof tag[1] !== "string") {
      continue;
    }
    const url = tag[1];
    if (tag[2] !== undefined && tag[2] !== "write") continue;
    if (!/^wss?:\/\//.test(url) || urls.includes(url)) continue;
    urls.push(url);
  }
  return urls;
}

/**
 * Opens one connection, sends `request` once it is open, and passes every JSON array the relay
 * sends to `onMessage` until it returns a value. When the connection fails, closes, or runs out
 * of time first, the value comes from `onEnd` with the reason. The socket is closed either way.
 */
function exchange<T>(
  relay: string,
  request: unknown[],
  timeoutMs: number,
  onMessage: (message: unknown[]) => T | undefined,
  onEnd: (reason: string) => T,
): Promise<T> {
  return new Promise((resolve) => {
    let socket: WebSocket | undefined;
    let done = false;
    const finish = (value: T) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      try {
        socket?.close();
      } catch {
        // The socket may already be closed or never opened.
      }
      resolve(value);
    };
    const timer = setTimeout(
      () => finish(onEnd(`Timed out after ${timeoutMs} ms.`)),
      timeoutMs,
    );
    try {
      socket = new WebSocket(relay);
    } catch {
      finish(onEnd("Invalid relay URL."));
      return;
    }
    socket.addEventListener("open", () =>
      socket?.send(JSON.stringify(request)),
    );
    socket.addEventListener("message", (event) => {
      let message: unknown;
      try {
        message = JSON.parse(String(event.data));
      } catch {
        return;
      }
      if (!Array.isArray(message)) return;
      const value = onMessage(message);
      if (value !== undefined) finish(value);
    });
    socket.addEventListener("error", () => finish(onEnd("Connection failed.")));
    socket.addEventListener("close", () => finish(onEnd("Connection closed.")));
  });
}
