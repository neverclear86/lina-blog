/**
 * Types of the `cloudflare:workers` module that the Workers runtime provides. No installed
 * package declares it, so only the bindings and secrets that `src/api.ts` reads are typed.
 */
declare module "cloudflare:workers" {
  export const env: import("./api").ApiEnv["Bindings"];
}
