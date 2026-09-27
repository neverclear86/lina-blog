import type { ImageBucket } from "./images";

/**
 * Hono environment of the publish Worker. Secrets come from `wrangler secret put` in
 * production and from `workers/publish/.dev.vars` in `wrangler dev`. `GITHUB_API_URL` is set
 * only in `.dev.vars`, to read from a local mock instead of GitHub. `IMAGES` is the R2 bucket
 * bound in `wrangler.jsonc`, which `wrangler dev` simulates locally.
 */
export type PublishEnv = {
  Bindings: {
    /** Shared secret that clients send as `Authorization: Bearer <secret>`. */
    PUBLISH_TOKEN?: string;
    /** GitHub token that reads the contents of this repository. */
    GITHUB_TOKEN?: string;
    /** Base URL of the GitHub API; `https://api.github.com` when not set. */
    GITHUB_API_URL?: string;
    /** Public image bucket (R2), served at https://img.ikili.pro. */
    IMAGES: ImageBucket;
  };
};
