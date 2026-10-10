/**
 * Withdrawing an article from Nostr: asking for the deletion (NIP-09) of its kind 30023
 * event. The request is signed by the bunker and sent like the article itself. No function
 * here throws.
 */
import { buildDeletionEvent } from "./article-event";
import { getBunkerPublicKey, signEventWithBunker } from "./nip46-signer";
import {
  NOSTR_SIGN_PERMISSIONS,
  type NostrConfig,
  type NostrPublishResult,
  postSignedEvent,
} from "./nostr-publish";

/**
 * Signs a NIP-09 deletion request for the kind 30023 event of the article `slug` through
 * the bunker, and sends it to the author's write relays.
 *
 * One after another, the bunker tells the author's public key (the `a` tag of the request
 * needs it before signing), signs the request, and the signed request goes to
 * {@link postSignedEvent}. Two connections to the bunker are opened, one at a time.
 *
 * @param slug The slug of the article to withdraw.
 * @param config From `readNostrConfig`.
 * @param now The time the requests are created.
 * @returns The ID of the deletion request, or a failure of one of the steps.
 */
export async function requestNostrDeletion(
  slug: string,
  config: NostrConfig,
  now: Date,
): Promise<NostrPublishResult> {
  const bunker = {
    session: config.session,
    relays: config.bunkerRelays,
    secret: config.secret,
    perms: NOSTR_SIGN_PERMISSIONS,
    now,
  };
  const author = await getBunkerPublicKey(bunker);
  if (!author.ok) {
    return {
      ok: false,
      message: `Getting the public key failed: ${author.message}`,
    };
  }
  const signed = await signEventWithBunker(
    buildDeletionEvent({ pubkey: author.pubkey, slug, now }),
    bunker,
  );
  if (!signed.ok) {
    return { ok: false, message: `Signing failed: ${signed.message}` };
  }
  return postSignedEvent(signed.event, config);
}
