import { describe, expect, it } from "vitest";
import {
  contrastRatio,
  expectedStatus,
  isFailing,
  NOT_FOUND_PATH,
  type Pixels,
  requiredRatio,
  routesOf,
  worstRatio,
} from "./audit.ts";

/** An image of `width` x `height` pixels, each pixel `color(x, y)`. */
function image(
  width: number,
  height: number,
  color: (x: number, y: number) => [number, number, number],
): Pixels {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const [r, g, b] = color(x, y);
      data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return { data, width, height };
}

describe("routesOf", () => {
  it("index.html をディレクトリーの URL に、404.html を存在しないページの URL にし、並べ替える", () => {
    expect(
      routesOf([
        "ja/index.html",
        "404.html",
        "index.html",
        "blog/a/index.html",
      ]),
    ).toEqual(["/", "/blog/a/", "/ja/", NOT_FOUND_PATH]);
  });

  it("HTML 以外のファイルと、index.html でない HTML は捨てる", () => {
    expect(
      routesOf([
        "favicon.svg",
        "_astro/a.css",
        "x/notindex.html",
        "x/index.htm",
      ]),
    ).toEqual([]);
  });
});

describe("expectedStatus", () => {
  it("存在しないページの URL は 404、他は 200 を期待する", () => {
    expect(expectedStatus(NOT_FOUND_PATH)).toBe(404);
    expect(expectedStatus("/")).toBe(200);
    expect(expectedStatus("/ja/")).toBe(200);
  });
});

describe("isFailing", () => {
  it("color-contrast は影響度に依らず落とす", () => {
    expect(isFailing({ id: "color-contrast", impact: "minor" })).toBe(true);
    expect(isFailing({ id: "color-contrast", impact: null })).toBe(true);
  });

  it("serious と critical を落とし、moderate と minor と影響度の無いものは落とさない", () => {
    expect(isFailing({ id: "label", impact: "critical" })).toBe(true);
    expect(isFailing({ id: "label", impact: "serious" })).toBe(true);
    expect(isFailing({ id: "label", impact: "moderate" })).toBe(false);
    expect(isFailing({ id: "label", impact: "minor" })).toBe(false);
    expect(isFailing({ id: "label" })).toBe(false);
  });
});

describe("contrastRatio", () => {
  it("黒と白は 21、同じ色は 1 で、引数の順に依らない", () => {
    expect(contrastRatio([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(contrastRatio([255, 255, 255], [0, 0, 0])).toBeCloseTo(21, 5);
    expect(contrastRatio([10, 20, 30], [10, 20, 30])).toBe(1);
  });

  it("白の上の #767676 は 4.54", () => {
    expect(contrastRatio([0x76, 0x76, 0x76], [255, 255, 255])).toBeCloseTo(
      4.54,
      2,
    );
  });
});

describe("requiredRatio", () => {
  it("24px 以上と、18.66px 以上の太字は 3、それ以外は 4.5", () => {
    expect(requiredRatio(24, 400)).toBe(3);
    expect(requiredRatio(18.66, 700)).toBe(3);
    expect(requiredRatio(18.66, 400)).toBe(4.5);
    expect(requiredRatio(16, 700)).toBe(4.5);
  });
});

describe("worstRatio", () => {
  const white = image(4, 4, () => [255, 255, 255]);

  it("範囲の中の最も低い比を返す", () => {
    const mixed = image(4, 1, (x) =>
      x < 2 ? [255, 255, 255] : [100, 100, 100],
    );
    const ratio = worstRatio(mixed, [[0, 0, 4, 1]], [0, 0, 0], 1);
    expect(ratio).toBeCloseTo(contrastRatio([0, 0, 0], [100, 100, 100]), 5);
  });

  it("複数の範囲のうち最も低い比を返す", () => {
    const mixed = image(4, 1, (x) =>
      x < 2 ? [255, 255, 255] : [100, 100, 100],
    );
    const ratio = worstRatio(
      mixed,
      [
        [0, 0, 2, 1],
        [2, 0, 2, 1],
      ],
      [0, 0, 0],
      1,
    );
    expect(ratio).toBeCloseTo(contrastRatio([0, 0, 0], [100, 100, 100]), 5);
  });

  it("不透明度のある文字は地に重ねた色で測る", () => {
    const ratio = worstRatio(white, [[0, 0, 4, 4]], [0, 0, 0], 0.5);
    expect(ratio).toBeCloseTo(
      contrastRatio([127.5, 127.5, 127.5], [255, 255, 255]),
      5,
    );
  });

  it("画像の右端を越える範囲は次の行の画素を読まず、右端までを測る", () => {
    const img = image(4, 2, (_x, y) => (y === 0 ? [255, 255, 255] : [0, 0, 0]));
    const ratio = worstRatio(img, [[2, 0, 10, 1]], [0, 0, 0], 1);
    expect(ratio).toBeCloseTo(21, 5);
  });

  it("画像の外の範囲は測らず、測った画素が無ければ undefined を返す", () => {
    expect(worstRatio(white, [[10, 10, 3, 3]], [0, 0, 0], 1)).toBeUndefined();
    expect(worstRatio(white, [], [0, 0, 0], 1)).toBeUndefined();
  });
});
