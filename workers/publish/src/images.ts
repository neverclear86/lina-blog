const IMAGE_BASE_URL = "https://img.ikili.pro";

const CACHE_CONTROL = "public, max-age=31536000, immutable";

const CONTENT_TYPES: Record<string, string> = {
  avif: "image/avif",
  gif: "image/gif",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

const NAME_PATTERN = /^([0-9a-f]{64})\.([a-z]+)$/;

// R2 error code BadDigest: the body does not match the given SHA-256.
const BAD_DIGEST = "(10037)";

/** A valid image name split into the parts that storing the image needs. */
export type ImageName = { name: string; sha256: string; contentType: string };

/** The part of an R2 object that `HEAD /images/{name}` reads: its ETag and HTTP metadata. */
export type StoredImage = {
  httpEtag: string;
  writeHttpMetadata(headers: Headers): void;
};

/**
 * The part of the R2 bucket binding that the publish Worker uses. Only these methods are typed
 * here because the repository has no `@cloudflare/workers-types`.
 */
export type ImageBucket = {
  head(key: string): Promise<StoredImage | null>;
  put(
    key: string,
    value: ReadableStream,
    options: {
      sha256: string;
      httpMetadata: { contentType: string; cacheControl: string };
    },
  ): Promise<unknown>;
  delete(keys: string[]): Promise<unknown>;
};

/** Result of {@link headImage}. `image` is `null` when the bucket has no such key. */
export type HeadImageResult =
  | { ok: true; image: StoredImage | null }
  | { ok: false; message: string };

/** Result of {@link putImage}. `created` is false when the image was already stored. */
export type PutImageResult =
  | { ok: true; created: boolean }
  | { ok: false; code: "hash_mismatch" | "upstream_error"; message: string };

/** Result of {@link deleteImages}. */
export type DeleteImagesResult =
  | { ok: true }
  | { ok: false; code: "upstream_error"; message: string };

/**
 * Checks an image name of the publish Worker: `<sha256>.<ext>`, where `<sha256>` is 64
 * lowercase hexadecimal digits and `<ext>` is avif, gif, jpg, png or webp.
 *
 * @param name The name to check.
 * @returns The name, its SHA-256 and the `Content-Type` of its extension, or `null` when the
 *   name has another form.
 */
export function parseImageName(name: string): ImageName | null {
  const match = NAME_PATTERN.exec(name);
  if (!match) {
    return null;
  }
  const [, sha256, extension] = match;
  const contentType = Object.hasOwn(CONTENT_TYPES, extension)
    ? CONTENT_TYPES[extension]
    : undefined;
  if (contentType === undefined) {
    return null;
  }
  return { name, sha256, contentType };
}

/**
 * Builds the public URL of a stored image, served by the R2 custom domain `img.ikili.pro`.
 *
 * @param name A name that {@link parseImageName} accepts.
 * @returns `https://img.ikili.pro/<name>`.
 */
export function imageUrl(name: string): string {
  return `${IMAGE_BASE_URL}/${name}`;
}

/**
 * Looks up an image in the bucket without reading its body.
 *
 * @param bucket The public image bucket.
 * @param name The key, which is the image name itself.
 * @returns The stored object or `null`, or a failure with a message when R2 fails. It never
 *   throws.
 */
export async function headImage(
  bucket: ImageBucket,
  name: string,
): Promise<HeadImageResult> {
  try {
    const image = await bucket.head(name);
    return { ok: true, image };
  } catch {
    return { ok: false, message: `Could not look up ${name} in R2.` };
  }
}

/**
 * Stores an image under its name unless the bucket already has it, in which case the body is
 * not read.
 *
 * The image is stored with its `Content-Type` and `Cache-Control: public, max-age=31536000,
 * immutable`; the name is the hash of the content, so the content of a name never changes.
 * The hash is not computed here: R2 checks the body against `sha256` and rejects a mismatch
 * with error 10037 (BadDigest), which becomes `hash_mismatch`. Other R2 failures become
 * `upstream_error`.
 *
 * @param bucket The public image bucket.
 * @param image The parsed name of the image.
 * @param body The request body. R2 needs a stream of known length, which a request with
 *   `Content-Length` gives.
 * @returns Whether the image was stored now, or a failure. It never throws.
 */
export async function putImage(
  bucket: ImageBucket,
  image: ImageName,
  body: ReadableStream,
): Promise<PutImageResult> {
  const existing = await headImage(bucket, image.name);
  if (!existing.ok) {
    return { ok: false, code: "upstream_error", message: existing.message };
  }
  if (existing.image) {
    return { ok: true, created: false };
  }
  try {
    await bucket.put(image.name, body, {
      sha256: image.sha256,
      httpMetadata: {
        contentType: image.contentType,
        cacheControl: CACHE_CONTROL,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message.includes(BAD_DIGEST)) {
      return {
        ok: false,
        code: "hash_mismatch",
        message: `The image does not match the SHA-256 ${image.sha256}.`,
      };
    }
    return {
      ok: false,
      code: "upstream_error",
      message: `Could not store ${image.name} in R2.`,
    };
  }
  return { ok: true, created: true };
}

/**
 * Deletes images from the bucket in one R2 call. It does not look the images up first, and it
 * does not call R2 when `names` is empty. R2 deletes at most 1000 keys per call, and an
 * article refers to at most 20 images (docs/publish-api.md).
 *
 * @param bucket The public image bucket.
 * @param names The keys, which are the image names themselves.
 * @returns Whether the delete call succeeded, or `upstream_error` with a message when R2
 *   fails. It never throws.
 */
export async function deleteImages(
  bucket: ImageBucket,
  names: string[],
): Promise<DeleteImagesResult> {
  if (names.length === 0) {
    return { ok: true };
  }
  try {
    await bucket.delete(names);
  } catch {
    return {
      ok: false,
      code: "upstream_error",
      message: `Could not delete ${names.join(", ")} from R2.`,
    };
  }
  return { ok: true };
}
