import { createMiddleware } from "hono/factory";
import { timingSafeEqual } from "hono/utils/buffer";
import type { PublishEnv } from "./env";
import { errorBody } from "./errors";

const PREFIX = "Bearer ";

/**
 * Lets a request through only when it carries the shared secret as
 * `Authorization: Bearer <secret>`.
 *
 * The header must start with `Bearer ` exactly and have a non-empty token after it. A missing
 * header, any other form, or a different token gets 401 with `WWW-Authenticate: Bearer`. The
 * token is compared with `timingSafeEqual`, which hashes both values with SHA-256 and compares
 * the hashes in constant time. When `PUBLISH_TOKEN` is not set, every request gets 500, so a
 * missing secret never lets requests through. Both errors carry a body from `errorBody`, with
 * the code `unauthorized` or `misconfigured`.
 */
export const requireBearerToken = createMiddleware<PublishEnv>(
  async (c, next) => {
    const secret = c.env?.PUBLISH_TOKEN;
    if (!secret) {
      return c.json(
        errorBody("misconfigured", "PUBLISH_TOKEN is not set."),
        500,
      );
    }
    const header = c.req.header("Authorization");
    const token = header?.startsWith(PREFIX)
      ? header.slice(PREFIX.length)
      : undefined;
    if (token === undefined || !(await timingSafeEqual(secret, token))) {
      c.header("WWW-Authenticate", "Bearer");
      return c.json(
        errorBody("unauthorized", "Missing or invalid bearer token."),
        401,
      );
    }
    await next();
  },
);
