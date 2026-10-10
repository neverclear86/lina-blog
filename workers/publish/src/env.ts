import type { ImageBucket } from "./images";

/**
 * Hono environment of the publish Worker. Secrets come from `wrangler secret put` in
 * production and from `workers/publish/.dev.vars` in `wrangler dev`. `GITHUB_API_URL` is set
 * only in `.dev.vars`, to call a local mock instead of GitHub.
 * `NOSTR_INDEX_RELAYS` is not a secret and is left unset to use the default relays; set it in
 * `vars` of `wrangler.jsonc` or in `.dev.vars`. `IMAGES` is the R2 bucket
 * bound in `wrangler.jsonc`, which `wrangler dev` simulates locally.
 */
export type PublishEnv = {
  Bindings: {
    /** Shared secret that clients send as `Authorization: Bearer <secret>`. */
    PUBLISH_TOKEN?: string;
    /**
     * GitHub token that reads and writes the contents of this repository. A fine-grained token
     * needs the permission "Contents: Read and write".
     */
    GITHUB_TOKEN?: string;
    /** Base URL of the GitHub API; `https://api.github.com` when not set. */
    GITHUB_API_URL?: string;
    /** Private key of this Worker as a NIP-46 client, in 64 lowercase hex digits. */
    NOSTR_CLIENT_KEY?: string;
    /** Bunker URL issued by nostr-no-su, which `parseBunkerUrl` reads. It contains a secret. */
    NOSTR_BUNKER_URL?: string;
    /** Relays that the author's relay list is read from, comma-separated; the first 5 are used. */
    NOSTR_INDEX_RELAYS?: string;
    /** Public image bucket (R2), served at https://img.ikili.pro. */
    IMAGES: ImageBucket;
  };
};
