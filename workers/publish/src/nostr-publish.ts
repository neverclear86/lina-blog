/**
 * Posting to Nostr from the Worker: reading the Nostr settings, checking that an article's
 * event fits one request to the bunker, posting the kind 30023 event of an article (step 4
 * of publishing), and sending a signed event to the author's write relays. The bunker URL's
 * remote signer (NIP-46) signs, and the write relays are in the author's relay list (kind
 * 10002). No function here throws.
 */
import type { NostrEvent } from "nostr-tools/pure";
import type { ArticleEventTemplate } from "./article-event";
import { parseBunkerUrl } from "./bunker-url";
import {
  fitsNip46Request,
  type Nip46Session,
  openNip46Session,
} from "./nip46-message";
import { signEventWithBunker } from "./nip46-signer";
import {
  fetchWriteRelays,
  parseRelayUrls,
  publishToRelays,
} from "./nostr-relays";

/**
 * Most relays that a step opens at once: the relays that the relay list is read from, and the
 * relays that the event is sent to. The steps run one after another, and each closes its
 * connections before the next step opens any, so no more than this many are open at a time,
 * within the 6 simultaneous connections of a Worker.
 */
export const NOSTR_MAX_RELAYS = 5;

/** Longest relay message kept in the message of a failure, in characters. */
const MAX_RELAY_MESSAGE = 100;

/**
 * Permissions that the Worker asks the bunker for in `connect`: signing articles (kind 30023)
 * and deletion requests (kind 5). A signer keeps the permissions of a client's first `connect`
 * and does not change them on a later one, so every path asks for both.
 */
export const NOSTR_SIGN_PERMISSIONS = "sign_event:30023,sign_event:5";

/** What posting to Nostr needs, made from the secrets by {@link readNostrConfig}. */
export type NostrConfig = {
  session: Nip46Session;
  bunkerRelays: string[];
  secret: string | undefined;
  indexRelays: string[];
};

/** Result of {@link readNostrConfig}. `message` explains a failure and never holds a secret. */
export type NostrConfigResult =
  | { ok: true; config: NostrConfig }
  | { ok: false; message: string };

/** Result of posting to Nostr. `message` explains a failure for the error body. */
export type NostrPublishResult =
  | { ok: true; eventId: string }
  | { ok: false; message: string };

/**
 * Reads the Nostr settings of the Worker. Fails when `NOSTR_BUNKER_URL` or `NOSTR_CLIENT_KEY`
 * is not set or not valid (see `parseBunkerUrl` and `openNip46Session`). The relay list is
 * read from the first {@link NOSTR_MAX_RELAYS} relays of `NOSTR_INDEX_RELAYS`.
 *
 * @param env The bindings `NOSTR_CLIENT_KEY`, `NOSTR_BUNKER_URL` and `NOSTR_INDEX_RELAYS`.
 * @returns The settings, or a failure. It never throws.
 */
export function readNostrConfig(env: {
  NOSTR_CLIENT_KEY?: string;
  NOSTR_BUNKER_URL?: string;
  NOSTR_INDEX_RELAYS?: string;
}): NostrConfigResult {
  const bunker = parseBunkerUrl(env.NOSTR_BUNKER_URL);
  if (!bunker.ok) return bunker;
  if (!env.NOSTR_CLIENT_KEY) {
    return { ok: false, message: "NOSTR_CLIENT_KEY is not set." };
  }
  const opened = openNip46Session(env.NOSTR_CLIENT_KEY, bunker.pubkey);
  if (!opened.ok) return opened;
  return {
    ok: true,
    config: {
      session: opened.session,
      bunkerRelays: bunker.relays,
      secret: bunker.secret,
      indexRelays: parseRelayUrls(env.NOSTR_INDEX_RELAYS).slice(
        0,
        NOSTR_MAX_RELAYS,
      ),
    },
  };
}

/**
 * Tells whether the bunker can be asked to sign an event: whether the `sign_event` request that
 * carries it fits in one NIP-46 request. The event is JSON inside the JSON of the request, so
 * a line break of the content takes 3 bytes, and a `"` or a `\` takes 4.
 *
 * @param template The event before signing.
 * @returns `false` when the request would be longer than 65535 bytes.
 */
export function fitsBunkerRequest(template: ArticleEventTemplate): boolean {
  return fitsNip46Request({
    id: "00000000-0000-0000-0000-000000000000",
    method: "sign_event",
    params: [JSON.stringify(template)],
  });
}

/**
 * Signs an article's event through the bunker and posts it to the author's write relays.
 *
 * The steps run one after another, so that the connections are never open together: the
 * bunker signs (and `get_public_key` tells the author's public key, which may differ from the
 * remote signer's), and the signed event goes to {@link postSignedEvent}.
 *
 * @param template The event before signing.
 * @param config From {@link readNostrConfig}.
 * @param now The time the requests to the bunker are created.
 * @returns The ID of the signed event, or a failure of one of the steps.
 */
export async function publishToNostr(
  template: ArticleEventTemplate,
  config: NostrConfig,
  now: Date,
): Promise<NostrPublishResult> {
  const signed = await signEventWithBunker(template, {
    session: config.session,
    relays: config.bunkerRelays,
    secret: config.secret,
    perms: NOSTR_SIGN_PERMISSIONS,
    now,
  });
  if (!signed.ok) {
    return { ok: false, message: `Signing failed: ${signed.message}` };
  }
  return postSignedEvent(signed.event, config);
}

/**
 * Sends a signed event to the write relays in the author's relay list: the relay list of
 * `event.pubkey` is read, and the event is sent to its first {@link NOSTR_MAX_RELAYS} write
 * relays. One relay accepting it is a success.
 *
 * @param event The signed event.
 * @param config From {@link readNostrConfig}.
 * @returns The ID of the event, or a failure of one of the steps.
 */
export async function postSignedEvent(
  event: NostrEvent,
  config: NostrConfig,
): Promise<NostrPublishResult> {
  const listed = await fetchWriteRelays(event.pubkey, config.indexRelays);
  if (!listed.ok) return listed;
  if (listed.relays.length === 0) {
    return {
      ok: false,
      message: `The relay list of ${event.pubkey} has no write relay.`,
    };
  }
  const posted = await publishToRelays(event, listed.relays, NOSTR_MAX_RELAYS);
  if (!posted.ok) {
    const reasons = posted.results
      .map(
        (result) =>
          `${result.relay}: ${result.message.slice(0, MAX_RELAY_MESSAGE)}`,
      )
      .join("; ");
    return { ok: false, message: `${posted.message} ${reasons}` };
  }
  return { ok: true, eventId: event.id };
}
