/**
 * Client of the publish Worker API that `docs/publish-api.md` defines, for the sync script.
 * Every request carries `Authorization: Bearer <token>`. Operations never throw; they
 * return a result whose error keeps the status, `code`, `message` and `step` of the
 * Worker's error body.
 */

const IMAGE_CONTENT_TYPES: Readonly<Record<string, string>> = {
  avif: "image/avif",
  gif: "image/gif",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const DEFAULT_RETRY_DELAYS_MS = [1000, 4000];

/** Where the publish Worker is and the shared secret it expects. */
export type PublishConfig = { url: string; token: string };

/**
 * Why an operation failed. `status` is the HTTP status, or `null` when no response came.
 * `code`, `message` and `step` come from the Worker's error body when it has one. Otherwise
 * `code` is one of the client's own codes:
 *
 * - `unexpected_response`: the Worker answered with a body that is not the expected shape.
 * - `network_error`: `fetch` threw on every attempt.
 * - `unsupported_image`: the image extension is not in `docs/publish-api.md`; nothing was sent.
 */
export type PublishError = {
  status: number | null;
  code: string;
  message: string;
  step?: string;
};

/** Outcome of an operation of {@link PublishClient}. */
export type PublishResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: PublishError };

/**
 * One entry of `GET /articles`. `hash` is `null` for an article whose publishing stopped midway.
 */
export type PublishedArticle = { slug: string; hash: string | null };

/**
 * @property fetchImpl The `fetch` to call, as a plain function. Tests pass a stub so that
 *   they never reach the network. The global `fetch` when not given.
 * @property retryDelaysMs Milliseconds to wait before each resend; its length is the most
 *   resends of one request. `[1000, 4000]` when not given.
 */
export type PublishClientOptions = {
  fetchImpl?: typeof fetch;
  retryDelaysMs?: readonly number[];
};

/** Operations of the publish Worker API. */
export type PublishClient = {
  /** Lists the published articles with `GET /articles`, keeping a `null` hash as is. */
  listArticles(): Promise<PublishResult<PublishedArticle[]>>;
  /**
   * Uploads one image as `<sha256>.<ext>`: asks `HEAD /images/{name}` and sends
   * `PUT /images/{name}` only when it answers 404. `uploaded` tells whether `PUT` was sent.
   */
  uploadImage(
    name: string,
    bytes: Uint8Array<ArrayBuffer>,
  ): Promise<PublishResult<{ uploaded: boolean }>>;
  /** Publishes an article with `PUT /articles/{slug}` and `{"markdown": ...}`. */
  putArticle(slug: string, markdown: string): Promise<PublishResult<undefined>>;
  /**
   * Withdraws an article with `DELETE /articles/{slug}`. Any 2xx is success; the body is
   * not read.
   */
  deleteArticle(slug: string): Promise<PublishResult<undefined>>;
};

/**
 * Reads the publish Worker's URL from `PUBLISH_URL` and the shared secret from
 * `PUBLISH_TOKEN`.
 *
 * @param env The environment to read. `process.env` when not given.
 * @returns The URL and the shared secret, as given.
 * @throws Error `Set the environment variables: <names>.` when a variable is missing or
 *   empty, naming every such variable in the order `PUBLISH_URL`, `PUBLISH_TOKEN`.
 */
export function readPublishConfig(
  env: Record<string, string | undefined> = process.env,
): PublishConfig {
  const url = env.PUBLISH_URL;
  const token = env.PUBLISH_TOKEN;
  if (!url || !token) {
    const missing: string[] = [];
    if (!url) {
      missing.push("PUBLISH_URL");
    }
    if (!token) {
      missing.push("PUBLISH_TOKEN");
    }
    throw new Error(`Set the environment variables: ${missing.join(", ")}.`);
  }
  return { url, token };
}

/** Reads a non-2xx response into a {@link PublishError} as that type describes. */
async function readError(res: Response): Promise<PublishError> {
  let body: unknown;
  try {
    body = await res.json();
  } catch {
    body = undefined;
  }
  const error = isRecord(body) ? body.error : undefined;
  if (
    isRecord(error) &&
    typeof error.code === "string" &&
    typeof error.message === "string"
  ) {
    return {
      status: res.status,
      code: error.code,
      message: error.message,
      ...(typeof error.step === "string" ? { step: error.step } : {}),
    };
  }
  return {
    status: res.status,
    code: "unexpected_response",
    message: `The publish Worker answered ${res.status} without an error body.`,
  };
}

/** Whether docs/publish-api.md allows sending the failed request again. */
function isRetryable(error: PublishError): boolean {
  if (error.status === null) {
    return error.code === "network_error";
  }
  return (
    error.status === 409 ||
    (error.status >= 500 && error.code !== "misconfigured")
  );
}

/** Whether `value` is an object whose fields can be read. */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * Creates a client of the publish Worker API. Trailing `/` of `config.url` are dropped
 * before the paths are appended.
 *
 * A failed request is sent again after each delay of `options.retryDelaysMs` when it
 * answered 409, answered 500 or above with a `code` other than `misconfigured`, or when
 * `fetch` threw; `docs/publish-api.md` allows resending these. Any other failure is
 * returned at once.
 *
 * @param config The Worker's URL and the shared secret, as from {@link readPublishConfig}.
 * @param options The `fetch` to call and the delays between resends.
 * @returns The client. Its operations never throw.
 */
export function createPublishClient(
  config: PublishConfig,
  options: PublishClientOptions = {},
): PublishClient {
  const base = config.url.replace(/\/+$/, "");
  const fetchImpl = options.fetchImpl ?? fetch;
  const retryDelaysMs = options.retryDelaysMs ?? DEFAULT_RETRY_DELAYS_MS;

  const sendOnce = async (
    method: string,
    path: string,
    init: { headers?: Record<string, string>; body?: BodyInit },
    okStatuses: readonly number[],
  ): Promise<PublishResult<Response>> => {
    let res: Response;
    try {
      res = await fetchImpl(`${base}${path}`, {
        method,
        headers: { ...init.headers, Authorization: `Bearer ${config.token}` },
        body: init.body,
      });
    } catch {
      return {
        ok: false,
        error: {
          status: null,
          code: "network_error",
          message: `Could not reach the publish Worker for ${method} ${path}.`,
        },
      };
    }
    if (res.ok || okStatuses.includes(res.status)) {
      return { ok: true, value: res };
    }
    return { ok: false, error: await readError(res) };
  };

  const send = async (
    method: string,
    path: string,
    init: { headers?: Record<string, string>; body?: BodyInit } = {},
    okStatuses: readonly number[] = [],
  ): Promise<PublishResult<Response>> => {
    for (let attempt = 0; ; attempt++) {
      const result = await sendOnce(method, path, init, okStatuses);
      const delay = retryDelaysMs[attempt];
      if (result.ok || !isRetryable(result.error) || delay === undefined) {
        return result;
      }
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  };

  return {
    async listArticles() {
      const result = await send("GET", "/articles");
      if (!result.ok) {
        return result;
      }
      const res = result.value;
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = undefined;
      }
      const notList: PublishResult<PublishedArticle[]> = {
        ok: false,
        error: {
          status: res.status,
          code: "unexpected_response",
          message:
            "The publish Worker answered GET /articles with a body that is not a list of articles.",
        },
      };
      const articles = isRecord(body) ? body.articles : undefined;
      if (!Array.isArray(articles)) {
        return notList;
      }
      const list: PublishedArticle[] = [];
      for (const entry of articles) {
        if (
          !isRecord(entry) ||
          typeof entry.slug !== "string" ||
          !(typeof entry.hash === "string" || entry.hash === null)
        ) {
          return notList;
        }
        list.push({ slug: entry.slug, hash: entry.hash });
      }
      return { ok: true, value: list };
    },

    async uploadImage(name, bytes) {
      const dot = name.lastIndexOf(".");
      const extension = dot < 0 ? "" : name.slice(dot + 1);
      if (!Object.hasOwn(IMAGE_CONTENT_TYPES, extension)) {
        return {
          ok: false,
          error: {
            status: null,
            code: "unsupported_image",
            message: `${name} has an extension that the publish Worker does not accept.`,
          },
        };
      }
      const path = `/images/${name}`;
      const head = await send("HEAD", path, {}, [404]);
      if (!head.ok) {
        return head;
      }
      if (head.value.status !== 404) {
        return { ok: true, value: { uploaded: false } };
      }
      const put = await send("PUT", path, {
        headers: {
          "Content-Type": IMAGE_CONTENT_TYPES[extension],
          "Content-Length": String(bytes.byteLength),
        },
        body: bytes,
      });
      return put.ok ? { ok: true, value: { uploaded: true } } : put;
    },

    async putArticle(slug, markdown) {
      const result = await send("PUT", `/articles/${slug}`, {
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ markdown }),
      });
      return result.ok ? { ok: true, value: undefined } : result;
    },

    async deleteArticle(slug) {
      const result = await send("DELETE", `/articles/${slug}`);
      return result.ok ? { ok: true, value: undefined } : result;
    },
  };
}
