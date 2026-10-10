import { decrypt, encrypt, getConversationKey } from "nostr-tools/nip44";
import {
  type EventTemplate,
  finalizeEvent,
  getPublicKey,
  type NostrEvent,
  verifyEvent,
} from "nostr-tools/pure";
import { hexToBytes } from "nostr-tools/utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openNip46Session } from "./nip46-message";
import { type SignResult, signEventWithBunker } from "./nip46-signer";

type SocketHandler = (request: unknown[], socket: FakeRelaySocket) => void;

/**
 * Stand-in for the global `WebSocket` that never reaches the network. What the client sends
 * goes to `handler`. A URL containing `broken` fails with `error`, one containing `closing` is
 * closed by the relay before it opens, and one containing `throwing` opens but its `send`
 * throws for an `EVENT`.
 */
class FakeRelaySocket extends EventTarget {
  static handler: SocketHandler | undefined;
  static sockets: FakeRelaySocket[] = [];
  static openCount = 0;

  readonly url: string;
  readonly sent: unknown[][] = [];
  closed = false;

  constructor(url: string) {
    super();
    if (!/^wss?:\/\//.test(url)) {
      throw new SyntaxError(`Invalid URL: ${url}`);
    }
    this.url = url;
    FakeRelaySocket.sockets.push(this);
    FakeRelaySocket.openCount += 1;
    queueMicrotask(() => {
      if (url.includes("broken")) {
        this.dispatchEvent(new Event("error"));
      } else if (url.includes("closing")) {
        this.dispatchEvent(new Event("close"));
      } else {
        this.dispatchEvent(new Event("open"));
      }
    });
  }

  send(data: string): void {
    const request = JSON.parse(data) as unknown[];
    if (this.url.includes("throwing") && request[0] === "EVENT") {
      throw new Error("send failed");
    }
    this.sent.push(request);
    FakeRelaySocket.handler?.(request, this);
  }

  reply(message: unknown): void {
    this.replyRaw(JSON.stringify(message));
  }

  replyRaw(data: string): void {
    queueMicrotask(() => {
      if (!this.closed) {
        this.dispatchEvent(new MessageEvent("message", { data }));
      }
    });
  }

  /** The relay drops the connection. */
  shut(): void {
    if (this.closed) return;
    this.closed = true;
    FakeRelaySocket.openCount -= 1;
    this.dispatchEvent(new Event("error"));
    this.dispatchEvent(new Event("close"));
  }

  close(): void {
    if (this.closed) return;
    this.closed = true;
    FakeRelaySocket.openCount -= 1;
  }

  static reset(): void {
    FakeRelaySocket.handler = undefined;
    FakeRelaySocket.sockets = [];
    FakeRelaySocket.openCount = 0;
  }
}

const CLIENT_KEY = "01".repeat(32);
const SIGNER_KEY = "02".repeat(32);
const THIRD_KEY = "03".repeat(32);
const SIGNER_PUBKEY = getPublicKey(hexToBytes(SIGNER_KEY));
const CLIENT_PUBKEY = getPublicKey(hexToBytes(CLIENT_KEY));
const NOW = new Date(1_700_000_000_999);
const RELAY = "wss://bunker.example";
const SECRET = "s3cret";

const DRAFT: EventTemplate = {
  kind: 30023,
  created_at: 1_700_000_000,
  tags: [["d", "hello"]],
  content: "body",
};

type Request = { id: string; method: string; params: string[] };

/** What the mock bunker does with `sign_event`: an answer, or `undefined` for none. */
type Signing = (
  draft: EventTemplate,
) => { result?: string; error?: string } | undefined;

type BunkerOptions = {
  /** Whether the client is already known, so that it needs no `connect`. */
  known?: boolean;
  secret?: string;
  signing?: Signing;
  /** The relay refuses every request with `OK false` and this reason. */
  relayRefuses?: string;
  /** The relay drops the connection right after the first answer. */
  closeAfterAnswer?: boolean;
  /** Each answer is preceded by messages that are not the answer. */
  noise?: boolean;
};

function signWith(key: string, draft: EventTemplate): NostrEvent {
  return finalizeEvent(draft, hexToBytes(key));
}

/**
 * Makes the sockets answer like the nostr-no-su bunker: the request is decrypted with the
 * signer's key, recorded in `requests`, and answered only when the socket has subscribed. A
 * client that is not known is answered `unauthorized` until it sends `connect` with the secret.
 */
function startBunker(options: BunkerOptions = {}): { requests: Request[] } {
  const requests: Request[] = [];
  const subscribed = new Set<FakeRelaySocket>();
  let known = options.known ?? true;
  const signing: Signing =
    options.signing ??
    ((draft) => ({ result: JSON.stringify(signWith(SIGNER_KEY, draft)) }));
  const conversationKey = getConversationKey(
    hexToBytes(SIGNER_KEY),
    CLIENT_PUBKEY,
  );
  const response = (body: unknown): NostrEvent =>
    signWith(SIGNER_KEY, {
      kind: 24133,
      created_at: 1_700_000_001,
      tags: [["p", CLIENT_PUBKEY]],
      content: encrypt(JSON.stringify(body), conversationKey),
    });

  FakeRelaySocket.handler = (message, socket) => {
    if (message[0] === "REQ") {
      subscribed.add(socket);
      return;
    }
    const event = message[1] as NostrEvent;
    if (options.relayRefuses !== undefined) {
      socket.reply(["OK", event.id, false, options.relayRefuses]);
      return;
    }
    socket.reply(["OK", event.id, true, ""]);
    const request = JSON.parse(decrypt(event.content, conversationKey));
    requests.push(request);
    let answer: { result?: string; error?: string } | undefined;
    if (request.method === "connect") {
      const [signer, secret] = request.params;
      if (signer === SIGNER_PUBKEY && secret === (options.secret ?? "")) {
        known = true;
        answer = { result: "ack" };
      } else {
        answer = { error: "invalid secret" };
      }
    } else if (!known) {
      answer = { error: "unauthorized: send connect first" };
    } else if (request.method === "get_public_key") {
      answer = { result: SIGNER_PUBKEY };
    } else {
      answer = signing(JSON.parse(request.params[0]));
    }
    if (answer === undefined || !subscribed.has(socket)) return;
    if (options.noise) {
      socket.reply([
        "EVENT",
        "nip46",
        response({ id: "another-request", result: "ack" }),
      ]);
      socket.reply(["EVENT", "nip46", { kind: 24133, content: "unreadable" }]);
      socket.reply(["OK", "f".repeat(64), false, "another event"]);
      socket.replyRaw("not json");
      socket.replyRaw('{"not":"an array"}');
    }
    socket.reply(["EVENT", "nip46", response({ id: request.id, ...answer })]);
    if (options.closeAfterAnswer) queueMicrotask(() => socket.shut());
  };
  return { requests };
}

function sign(
  options: {
    relays?: string[];
    secret?: string | undefined;
    timeoutMs?: number | undefined;
    template?: EventTemplate;
  } = {},
): Promise<SignResult> {
  const opened = openNip46Session(CLIENT_KEY, SIGNER_PUBKEY);
  if (!opened.ok) throw new Error(opened.message);
  return signEventWithBunker(options.template ?? DRAFT, {
    session: opened.session,
    relays: options.relays ?? [RELAY],
    secret: "secret" in options ? options.secret : SECRET,
    now: NOW,
    timeoutMs: options.timeoutMs,
  });
}

function methods(bunker: { requests: Request[] }): string[] {
  return bunker.requests.map((request) => request.method);
}

beforeEach(() => {
  FakeRelaySocket.reset();
  vi.useFakeTimers();
  vi.stubGlobal("WebSocket", FakeRelaySocket);
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("signEventWithBunker", () => {
  it("知られた client には get_public_key と sign_event だけを送り、署名済みのイベントを返す", async () => {
    const bunker = startBunker();
    const result = await sign();
    if (!result.ok) throw new Error(result.message);
    expect(verifyEvent(result.event)).toBe(true);
    expect(result.event.pubkey).toBe(SIGNER_PUBKEY);
    expect(result.event.content).toBe("body");
    expect(methods(bunker)).toEqual(["get_public_key", "sign_event"]);
    expect(FakeRelaySocket.sockets[0].sent[0]).toEqual([
      "REQ",
      "nip46",
      { kinds: [24133], authors: [SIGNER_PUBKEY], "#p": [CLIENT_PUBKEY] },
    ]);
    expect(FakeRelaySocket.openCount).toBe(0);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("unauthorized なら secret と署名の権限で connect を送り、get_public_key をやり直す", async () => {
    const bunker = startBunker({ known: false, secret: SECRET });
    const result = await sign();
    expect(result.ok).toBe(true);
    expect(methods(bunker)).toEqual([
      "get_public_key",
      "connect",
      "get_public_key",
      "sign_event",
    ]);
    expect(bunker.requests[1].params).toEqual([
      SIGNER_PUBKEY,
      SECRET,
      "sign_event:30023",
    ]);
  });

  it("bunker URL に secret が無いときは connect の secret を空文字にする", async () => {
    const bunker = startBunker({ known: false });
    const result = await sign({ secret: undefined });
    expect(result.ok).toBe(true);
    expect(bunker.requests[1].params[1]).toBe("");
  });

  it("connect を断られたら、署名を求めずに失敗にする", async () => {
    const bunker = startBunker({ known: false, secret: "another" });
    expect(await sign()).toEqual({
      ok: false,
      message: "connect: invalid secret",
    });
    expect(methods(bunker)).toEqual(["get_public_key", "connect"]);
    expect(FakeRelaySocket.openCount).toBe(0);
  });

  it("sign_event の error 応答は失敗にし、connect を送らない", async () => {
    const bunker = startBunker({
      signing: () => ({ error: "permission denied: sign_event:30023" }),
    });
    expect(await sign()).toEqual({
      ok: false,
      message: "sign_event: permission denied: sign_event:30023",
    });
    expect(methods(bunker)).toEqual(["get_public_key", "sign_event"]);
  });

  it.each([
    [undefined, 10_000],
    [2_000, 2_000],
  ])(
    "応答しないバンカーは timeoutMs=%j（%j ms）で失敗にして閉じる",
    async (timeoutMs, limit) => {
      startBunker({ signing: () => undefined });
      let settled: SignResult | undefined;
      const pending = sign({ timeoutMs }).then((result) => {
        settled = result;
      });
      await vi.advanceTimersByTimeAsync(limit - 1);
      expect(settled).toBeUndefined();
      await vi.advanceTimersByTimeAsync(1);
      await pending;
      expect(settled).toEqual({
        ok: false,
        message: `sign_event: Timed out after ${limit} ms.`,
      });
      expect(FakeRelaySocket.openCount).toBe(0);
      expect(vi.getTimerCount()).toBe(0);
    },
  );

  it("get_public_key と別の鍵で署名されたイベントは失敗にする", async () => {
    startBunker({
      signing: (draft) => ({
        result: JSON.stringify(signWith(THIRD_KEY, draft)),
      }),
    });
    expect(await sign()).toEqual({
      ok: false,
      message:
        "sign_event: The event is signed by another key than get_public_key",
    });
  });

  it("署名が合わないイベントは失敗にする", async () => {
    startBunker({
      signing: (draft) => ({
        result: JSON.stringify({
          ...signWith(SIGNER_KEY, draft),
          content: "changed",
        }),
      }),
    });
    expect(await sign()).toEqual({
      ok: false,
      message: "sign_event: The signed event is not valid",
    });
  });

  it.each([
    ["JSON でない文字列", "not json", "sign_event: The result is not JSON"],
    ["null", "null", "sign_event: The signed event is not valid"],
    [
      "イベントの形でないオブジェクト",
      '{"kind":30023}',
      "sign_event: The signed event is not valid",
    ],
  ])("result が %s なら失敗にする", async (_name, result, message) => {
    startBunker({ signing: () => ({ result }) });
    expect(await sign()).toEqual({ ok: false, message });
  });

  it("他の id への応答と読めないイベントは読み飛ばし、自分の要求への応答を使う", async () => {
    startBunker({ noise: true });
    const result = await sign();
    expect(result.ok).toBe(true);
  });

  it("1 件が 65535 バイトを超える要求は送らずに失敗にする", async () => {
    const bunker = startBunker();
    const result = await sign({
      template: { ...DRAFT, content: "a".repeat(70_000) },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toMatch(
      /^sign_event: Request is \d+ bytes; NIP-44 allows 65535$/,
    );
    expect(methods(bunker)).toEqual(["get_public_key"]);
  });

  it("リレーが要求を OK false で断ったら、その文を添えて待たずに失敗にする", async () => {
    startBunker({ relayRefuses: "rate-limited: slow down" });
    expect(await sign()).toEqual({
      ok: false,
      message:
        "get_public_key: The relay did not accept the request: rate-limited: slow down",
    });
    expect(FakeRelaySocket.openCount).toBe(0);
  });

  it("リレーが購読を CLOSED したら失敗にする", async () => {
    FakeRelaySocket.handler = (message, socket) => {
      if (message[0] === "REQ") {
        socket.reply(["CLOSED", message[1], "auth-required: sign in"]);
      }
    };
    expect(await sign()).toEqual({
      ok: false,
      message:
        "get_public_key: The relay closed the subscription: auth-required: sign in",
    });
    expect(FakeRelaySocket.openCount).toBe(0);
  });

  it("応答の直後に接続が壊れたら、次の要求は送らず、最初の理由で失敗にする", async () => {
    const bunker = startBunker({ known: false, closeAfterAnswer: true });
    expect(await sign()).toEqual({
      ok: false,
      message: "connect: Connection failed.",
    });
    expect(methods(bunker)).toEqual(["get_public_key"]);
  });

  it.each([
    ["壊れた接続", "wss://broken.example", "Connection failed."],
    ["閉じられる接続", "wss://closing.example", "Connection closed."],
    ["ws でない URL", "https://bunker.example", "Invalid relay URL."],
  ])("%s には届かず、%s で失敗にする", async (_name, relay, message) => {
    const bunker = startBunker();
    expect(await sign({ relays: [relay] })).toEqual({ ok: false, message });
    expect(bunker.requests).toEqual([]);
    expect(FakeRelaySocket.openCount).toBe(0);
  });

  it("要求の送信が投げたら、接続の失敗にして閉じる", async () => {
    startBunker();
    const result = await sign({ relays: ["wss://throwing.example"] });
    expect(result).toEqual({
      ok: false,
      message: "get_public_key: Connection failed.",
    });
    expect(FakeRelaySocket.sockets[0].closed).toBe(true);
  });

  it("リレーが複数でも最初の 1 つだけにつなぐ", async () => {
    startBunker();
    const result = await sign({
      relays: [RELAY, "wss://second.example", "wss://third.example"],
    });
    expect(result.ok).toBe(true);
    expect(FakeRelaySocket.sockets.map((socket) => socket.url)).toEqual([
      RELAY,
    ]);
  });

  it("要求ごとに別の id を送る", async () => {
    const bunker = startBunker({ known: false, secret: SECRET });
    await sign();
    const ids = bunker.requests.map((request) => request.id);
    expect(ids).toHaveLength(4);
    expect(new Set(ids).size).toBe(4);
  });
});
