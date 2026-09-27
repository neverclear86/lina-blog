/**
 * Hono environment of the publish Worker. Secrets come from `wrangler secret put` in
 * production and from `workers/publish/.dev.vars` in `wrangler dev`.
 */
export type PublishEnv = {
  Bindings: {
    /** Shared secret that clients send as `Authorization: Bearer <secret>`. */
    PUBLISH_TOKEN?: string;
  };
};
