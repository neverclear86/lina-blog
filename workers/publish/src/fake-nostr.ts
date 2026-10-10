/**
 * Test double for the global `WebSocket`: a NIP-46 bunker and the relays of Nostr, none of
 * which reach the network. Tests install {@link FakeNostrSocket} with
 * `vi.stubGlobal("WebSocket", FakeNostrSocket)`, call `nostr.reset()` before each test, and
 * read what happened from {@link nostr}. The Worker never imports this file.
 *
 * The relay {@link BUNKER_RELAY} is the bunker's: it answers `get_public_key` with the author's
 * key and signs `sign_event` with it, so the author's key differs from the remote signer's.
 * Every other relay answers a `REQ` of kind 10002 with the author's relay list and an `EVENT`
 * with `OK`.
 */
import { decrypt, encrypt, getConversationKey } from "nostr-tools/nip44";
import { finalizeEvent, getPublicKey, type NostrEvent } from "nostr-tools/pure";
import { hexToBytes } from "nostr-tools/utils";

/** The Worker's NIP-46 client key (`NOSTR_CLIENT_KEY`). */
export const CLIENT_KEY = "01".repeat(32);
/** The key of the remote signer in the bunker URL. */
export const SIGNER_KEY = "02".repeat(32);
/** The key that signs the articles, which `get_public_key` tells. */
export const AUTHOR_KEY = "03".repeat(32);
export const CLIENT_PUBKEY = getPublicKey(hexToBytes(CLIENT_KEY));
export const SIGNER_PUBKEY = getPublicKey(hexToBytes(SIGNER_KEY));
export const AUTHOR_PUBKEY = getPublicKey(hexToBytes(AUTHOR_KEY));

/** The relay of the bunker URL. */
export const BUNKER_RELAY = "wss://bunker.example";

/** The bunker URL that the Worker is configured with in tests. */
export const BUNKER_URL = `bunker://${SIGNER_PUBKEY}?relay=${BUNKER_RELAY}&secret=s3cret`;

/** The author's write relays that a test starts with. */
export const WRITE_RELAYS = ["wss://write-a.example", "wss://write-b.example"];

const CONVERSATION_KEY = getConversationKey(
  hexToBytes(SIGNER_KEY),
  CLIENT_PUBKEY,
);

/** What the fake bunker and relays are told to do, and what they saw. */
class NostrState {
  /** Write relays of the author's relay list, or `null` when no relay has a list. */
  writeRelays: string[] | null = WRITE_RELAYS;
  /** Whether a relay accepts the event, by URL; a relay not listed accepts. */
  accepts: Record<string, boolean> = {};
  /** Message of the `OK` a relay answers an event with, by URL. */
  okMessages: Record<string, string> = {};
  /** The bunker answers `sign_event` with this error. */
  signError: string | undefined;
  /** URLs of the sockets in the order they were opened. */
  urls: string[] = [];
  /** The `REQ` filters that the relays were asked with, by URL. */
  queries: { relay: string; filter: Record<string, unknown> }[] = [];
  /** The events that the relays received, in order. */
  posted: { relay: string; event: NostrEvent }[] = [];
  /** The methods that the bunker received, in order. */
  methods: string[] = [];
  /** How many sockets are open now. */
  open = 0;
  /** The most sockets that were open at once. */
  peak = 0;
  /** Called when a relay receives an event to post. */
  onPost: (() => void) | undefined;

  reset(): void {
    this.writeRelays = WRITE_RELAYS;
    this.accepts = {};
    this.okMessages = {};
    this.signError = undefined;
    this.urls = [];
    this.queries = [];
    this.posted = [];
    this.methods = [];
    this.open = 0;
    this.peak = 0;
    this.onPost = undefined;
  }
}

export const nostr = new NostrState();

export class FakeNostrSocket extends EventTarget {
  readonly url: string;
  closed = false;

  constructor(url: string) {
    super();
    if (!/^wss?:\/\//.test(url)) {
      throw new SyntaxError(`Invalid URL: ${url}`);
    }
    this.url = url;
    nostr.urls.push(url);
    nostr.open += 1;
    nostr.peak = Math.max(nostr.peak, nostr.open);
    queueMicrotask(() => this.dispatchEvent(new Event("open")));
  }

  send(data: string): void {
    const request = JSON.parse(data) as unknown[];
    if (this.url === BUNKER_RELAY) {
      this.serveBunker(request);
    } else {
      this.serveRelay(request);
    }
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    nostr.open -= 1;
  }

  private reply(message: unknown): void {
    queueMicrotask(() => {
      if (!this.closed) {
        this.dispatchEvent(
          new MessageEvent("message", { data: JSON.stringify(message) }),
        );
      }
    });
  }

  private serveRelay(request: unknown[]): void {
    if (request[0] === "REQ") {
      const filter = request[2] as { authors?: string[] };
      nostr.queries.push({ relay: this.url, filter });
      if (nostr.writeRelays !== null && filter.authors?.[0] === AUTHOR_PUBKEY) {
        this.reply([
          "EVENT",
          request[1],
          {
            id: "1".repeat(64),
            pubkey: AUTHOR_PUBKEY,
            created_at: 100,
            kind: 10002,
            tags: nostr.writeRelays.map((relay) => ["r", relay]),
          },
        ]);
      }
      this.reply(["EOSE", request[1]]);
    } else if (request[0] === "EVENT") {
      const event = request[1] as NostrEvent;
      nostr.posted.push({ relay: this.url, event });
      nostr.onPost?.();
      this.reply([
        "OK",
        event.id,
        nostr.accepts[this.url] ?? true,
        nostr.okMessages[this.url] ?? "",
      ]);
    }
  }

  private serveBunker(request: unknown[]): void {
    if (request[0] !== "EVENT") return;
    const event = request[1] as NostrEvent;
    this.reply(["OK", event.id, true, ""]);
    const call = JSON.parse(decrypt(event.content, CONVERSATION_KEY)) as {
      id: string;
      method: string;
      params: string[];
    };
    nostr.methods.push(call.method);
    let body: { result?: string; error?: string };
    if (call.method === "get_public_key") {
      body = { result: AUTHOR_PUBKEY };
    } else if (nostr.signError !== undefined) {
      body = { error: nostr.signError };
    } else {
      const signed = finalizeEvent(
        JSON.parse(call.params[0]),
        hexToBytes(AUTHOR_KEY),
      );
      body = { result: JSON.stringify(signed) };
    }
    this.reply([
      "EVENT",
      "nip46",
      finalizeEvent(
        {
          kind: 24133,
          created_at: 1_700_000_001,
          tags: [["p", CLIENT_PUBKEY]],
          content: encrypt(
            JSON.stringify({ id: call.id, ...body }),
            CONVERSATION_KEY,
          ),
        },
        hexToBytes(SIGNER_KEY),
      ),
    ]);
  }
}
