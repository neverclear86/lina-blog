/** Error codes that the publish Worker returns; the meaning of each is in `docs/publish-api.md`. */
export type ErrorCode =
  | "invalid_request"
  | "unauthorized"
  | "hash_mismatch"
  | "invalid_markdown"
  | "invalid_frontmatter"
  | "slug_mismatch"
  | "missing_image"
  | "too_many_images"
  | "upstream_error"
  | "misconfigured";

/** Step of the processing in which a request failed, as listed in `docs/publish-api.md`. */
export type ErrorStep = "images" | "list";

/** Body of every error response of the publish Worker. */
export type ErrorBody = {
  error: { code: ErrorCode; message: string; step?: ErrorStep };
};

/**
 * Builds the body of an error response in the shape that `docs/publish-api.md` defines.
 *
 * @param code Machine-readable reason of the failure.
 * @param message Explanation for the person who reads the sync script's report.
 * @param step Step in which the request failed. When it is not given, the property is
 *   `undefined` and `JSON.stringify` leaves it out of the response.
 * @returns `{ error: { code, message, step } }`.
 */
export function errorBody(
  code: ErrorCode,
  message: string,
  step?: ErrorStep,
): ErrorBody {
  return { error: { code, message, step } };
}
