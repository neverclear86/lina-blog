import { describe, expect, it, vi } from "vitest";
import {
  type ImageBucket,
  imageUrl,
  parseImageName,
  putImage,
  type StoredImage,
} from "./images";

const HASH = "a".repeat(64);

/** A stored object whose metadata is not read by these tests. */
const storedImage: StoredImage = {
  httpEtag: '"etag"',
  writeHttpMetadata: () => {},
};

/** Returns a readable stream of `text`, standing in for a request body. */
function bodyOf(text: string): ReadableStream {
  return new Response(text).body as ReadableStream;
}

/** Hex SHA-256 of `text`, as the sync script computes it. */
async function sha256Of(text: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(text),
  );
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/** A bucket stub whose `head` answers `existing` and whose `put` succeeds. */
function bucketWith(existing: StoredImage | null) {
  return {
    head: vi.fn<ImageBucket["head"]>(async () => existing),
    put: vi.fn<ImageBucket["put"]>(async () => ({})),
  };
}

describe("parseImageName", () => {
  it.each([
    ["avif", "image/avif"],
    ["gif", "image/gif"],
    ["jpg", "image/jpeg"],
    ["png", "image/png"],
    ["webp", "image/webp"],
  ])(".%s の名前はハッシュと %s を返す", (extension, contentType) => {
    expect(parseImageName(`${HASH}.${extension}`)).toEqual({
      name: `${HASH}.${extension}`,
      sha256: HASH,
      contentType,
    });
  });

  it.each([
    ["jpeg の拡張子", `${HASH}.jpeg`],
    ["svg の拡張子", `${HASH}.svg`],
    ["大文字のハッシュ", `${"A".repeat(64)}.png`],
    ["63 文字のハッシュ", `${"a".repeat(63)}.png`],
    ["前に文字の付いた名前", `x${HASH}.png`],
    ["後ろに文字の付いた名前", `${HASH}.png.x`],
  ])("%s は null を返す", (_label, name) => {
    expect(parseImageName(name)).toBeNull();
  });
});

describe("imageUrl", () => {
  it("img.ikili.pro の URL を返す", () => {
    expect(imageUrl(`${HASH}.png`)).toBe(`https://img.ikili.pro/${HASH}.png`);
  });
});

describe("putImage", () => {
  it("無い画像はハッシュと長期キャッシュの Cache-Control を付けて置く", async () => {
    const bucket = bucketWith(null);
    const body = bodyOf("hello");

    const result = await putImage(
      bucket,
      { name: `${HASH}.png`, sha256: HASH, contentType: "image/png" },
      body,
    );

    expect(result).toEqual({ ok: true, created: true });
    expect(bucket.put).toHaveBeenCalledWith(`${HASH}.png`, body, {
      sha256: HASH,
      httpMetadata: {
        contentType: "image/png",
        cacheControl: "public, max-age=31536000, immutable",
      },
    });
  });

  it("同じ名前の画像が有れば置かずに created: false を返す", async () => {
    const bucket = bucketWith(storedImage);

    const result = await putImage(
      bucket,
      { name: `${HASH}.png`, sha256: HASH, contentType: "image/png" },
      bodyOf("hello"),
    );

    expect(result).toEqual({ ok: true, created: false });
    expect(bucket.put).not.toHaveBeenCalled();
  });

  it("R2 が BadDigest（10037）で拒むと hash_mismatch を返す", async () => {
    const bucket = bucketWith(null);
    bucket.put.mockImplementation(async (_key, _value, options) => {
      if (options.sha256 !== (await sha256Of("hello"))) {
        throw new Error(
          "put: The SHA-256 checksum you specified did not match what we received. (10037)",
        );
      }
      return {};
    });

    const result = await putImage(
      bucket,
      { name: `${HASH}.png`, sha256: HASH, contentType: "image/png" },
      bodyOf("hello"),
    );

    expect(result).toEqual({
      ok: false,
      code: "hash_mismatch",
      message: `The image does not match the SHA-256 ${HASH}.`,
    });
  });

  it("R2 のほかの失敗は upstream_error を返し、例外を投げない", async () => {
    const bucket = bucketWith(null);
    bucket.put.mockRejectedValue(new Error("put: Internal error (10001)"));

    const result = await putImage(
      bucket,
      { name: `${HASH}.png`, sha256: HASH, contentType: "image/png" },
      bodyOf("hello"),
    );

    expect(result).toEqual({
      ok: false,
      code: "upstream_error",
      message: `Could not store ${HASH}.png in R2.`,
    });
  });

  it("有無の確認で R2 が失敗すると upstream_error を返し、置かない", async () => {
    const bucket = bucketWith(null);
    bucket.head.mockRejectedValue(new Error("head: Internal error"));

    const result = await putImage(
      bucket,
      { name: `${HASH}.png`, sha256: HASH, contentType: "image/png" },
      bodyOf("hello"),
    );

    expect(result).toEqual({
      ok: false,
      code: "upstream_error",
      message: `Could not look up ${HASH}.png in R2.`,
    });
    expect(bucket.put).not.toHaveBeenCalled();
  });
});
