import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  AVATARS,
  type AvatarSpec,
  alphaBounds,
  type Box,
  buildAvatar,
} from "./avatars";

/**
 * The bounds of the non-transparent pixels of the originals, as `W × H` from the table of
 * `design/README.md`. `design/` is not in git, so the numbers are copied here.
 */
const CROPS: Record<string, { width: number; height: number }> = {
  rohan: { width: 1412, height: 3123 },
  "lgtm-fullbody": { width: 1238, height: 3617 },
  "happy-fullbody": { width: 1940, height: 3502 },
  "main-visual": { width: 1383, height: 3586 },
  "threeview-front": { width: 3025, height: 7242 },
  "threeview-side": { width: 2083, height: 7071 },
  "threeview-back": { width: 3609, height: 6496 },
  "lgtm-bastup": { width: 2566, height: 2059 },
  hate: { width: 1470, height: 1947 },
};

const POSE_RATIO = 851 / 1500;

const spec = (name: string): AvatarSpec => {
  const found = AVATARS.find((avatar) => avatar.name === name);
  if (found === undefined) throw new Error(`no spec named ${name}`);
  return found;
};

/** Reads the first chunk name of a WebP file: `VP8L` is lossless and `VP8X` or `VP8 ` is not. */
const firstChunk = (webp: Buffer) => webp.subarray(12, 16).toString("latin1");

/** The bounds of the pixels of `webp` whose alpha is above 0. */
const outputBounds = async (webp: Buffer): Promise<Box | null> => {
  const { data, info } = await sharp(webp)
    .ensureAlpha()
    .extractChannel(3)
    .raw()
    .toBuffer({ resolveWithObject: true });
  return alphaBounds(data, info.width, info.height);
};

describe("alphaBounds", () => {
  it("alpha が 0 より大きい画素の外接矩形を返す", () => {
    const alpha = new Uint8Array(8 * 6);
    alpha[1 * 8 + 2] = 1;
    alpha[4 * 8 + 5] = 255;
    expect(alphaBounds(alpha, 8, 6)).toEqual({
      left: 2,
      top: 1,
      width: 4,
      height: 4,
    });
  });

  it("画像の端の画素も外接矩形に含める", () => {
    expect(alphaBounds(new Uint8Array(12).fill(255), 4, 3)).toEqual({
      left: 0,
      top: 0,
      width: 4,
      height: 3,
    });
  });

  it("全部透明なら null を返す", () => {
    expect(alphaBounds(new Uint8Array(12), 4, 3)).toBeNull();
  });
});

describe("AVATARS", () => {
  it("9 枚で、名前が重ならない", () => {
    expect(AVATARS).toHaveLength(9);
    expect(new Set(AVATARS.map((avatar) => avatar.name)).size).toBe(9);
    expect(AVATARS.map((avatar) => avatar.name).sort()).toEqual(
      Object.keys(CROPS).sort(),
    );
  });

  it("三面図の大きさが .co-svg の viewBox と同じ", () => {
    const size = (name: string) => [spec(name).width, spec(name).height];
    expect(size("threeview-front")).toEqual([459, 1100]);
    expect(size("threeview-side")).toEqual([316, 1100]);
    expect(size("threeview-back")).toEqual([597, 1100]);
  });

  it("ポーズ 4 枚は同じ 851:1500 の枠で、高さが 2390 以下", () => {
    const poses = AVATARS.filter((avatar) => avatar.fit === "contain");
    expect(poses.map((avatar) => avatar.name)).toEqual([
      "rohan",
      "lgtm-fullbody",
      "happy-fullbody",
      "main-visual",
    ]);
    for (const pose of poses) {
      expect(pose.width / pose.height).toBeCloseTo(POSE_RATIO, 3);
      expect(pose.height).toBeLessThanOrEqual(2390);
      const crop = CROPS[pose.name];
      expect(crop.width / crop.height).toBeLessThan(POSE_RATIO);
    }
  });

  it("fill の縦横比が切り抜きと 0.2% 以内で一致する", () => {
    const fills = AVATARS.filter((avatar) => avatar.fit === "fill");
    expect(fills).toHaveLength(5);
    for (const avatar of fills) {
      const crop = CROPS[avatar.name];
      const ratio = avatar.width / (avatar.height - avatar.padTop);
      expect(Math.abs(ratio / (crop.width / crop.height) - 1)).toBeLessThan(
        0.002,
      );
    }
  });

  it("padTop は側面と背面だけで、高さを 1100 にそろえる", () => {
    const padded = AVATARS.filter((avatar) => avatar.padTop > 0);
    expect(padded.map((avatar) => avatar.name)).toEqual([
      "threeview-side",
      "threeview-back",
    ]);
    for (const avatar of padded) {
      expect(avatar.height).toBe(1100);
      expect(avatar.height - avatar.padTop).toBe(1074);
    }
  });
});

describe("buildAvatar", () => {
  let dir: string;
  let source: string;
  let empty: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "avatars-"));
    source = join(dir, "source.png");
    empty = join(dir, "empty.png");
    const transparent = (width: number, height: number) =>
      sharp({
        create: {
          width,
          height,
          channels: 4,
          background: { r: 0, g: 0, b: 0, alpha: 0 },
        },
      });
    const red = await sharp({
      create: {
        width: 30,
        height: 80,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();
    await transparent(200, 100)
      .composite([{ input: red, left: 50, top: 10 }])
      .png()
      .toFile(source);
    await transparent(10, 10).png().toFile(empty);
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("contain は余白を切り、比を保って縮め、枠の中央に置く", async () => {
    const webp = await buildAvatar(source, spec("rohan"));
    const meta = await sharp(webp).metadata();
    expect([meta.width, meta.height]).toEqual([1356, 2390]);
    const bounds = await outputBounds(webp);
    if (bounds === null) throw new Error("the output is fully transparent");
    expect(bounds.top).toBe(0);
    expect(bounds.height).toBe(2390);
    expect(Math.abs(bounds.width - 896)).toBeLessThanOrEqual(1);
    const right = 1356 - bounds.left - bounds.width;
    expect(Math.abs(bounds.left - right)).toBeLessThanOrEqual(1);
  });

  it("fill は切り抜きを width × (height - padTop) に縮める", async () => {
    const webp = await buildAvatar(source, {
      name: "x",
      width: 30,
      height: 90,
      fit: "fill",
      padTop: 0,
    });
    const meta = await sharp(webp).metadata();
    expect([meta.width, meta.height]).toEqual([30, 90]);
    expect(await outputBounds(webp)).toEqual({
      left: 0,
      top: 0,
      width: 30,
      height: 90,
    });
  });

  it("padTop は上に透明の行を足し、下を揃える", async () => {
    const webp = await buildAvatar(source, {
      name: "x",
      width: 30,
      height: 100,
      fit: "fill",
      padTop: 10,
    });
    const meta = await sharp(webp).metadata();
    expect([meta.width, meta.height]).toEqual([30, 100]);
    expect(await outputBounds(webp)).toEqual({
      left: 0,
      top: 10,
      width: 30,
      height: 90,
    });
  });

  it("出力は可逆の WebP（最初のチャンクが VP8L）", async () => {
    expect(firstChunk(await buildAvatar(source, spec("hate")))).toBe("VP8L");
  });

  it("全部透明な原本は例外にする", async () => {
    await expect(buildAvatar(empty, spec("hate"))).rejects.toThrow(
      "fully transparent",
    );
  });
});

describe("src/assets の 9 枚", () => {
  for (const avatar of AVATARS) {
    const file = fileURLToPath(
      new URL(`../../src/assets/${avatar.name}.webp`, import.meta.url),
    );

    it(`${avatar.name}.webp は ${avatar.width} × ${avatar.height} の透過 WebP`, async () => {
      const meta = await sharp(file).metadata();
      expect(meta.format).toBe("webp");
      expect([meta.width, meta.height]).toEqual([avatar.width, avatar.height]);
      expect(meta.hasAlpha).toBe(true);
    });

    it(`${avatar.name}.webp は可逆の WebP（最初のチャンクが VP8L）`, async () => {
      expect(firstChunk(await readFile(file))).toBe("VP8L");
    });
  }
});
