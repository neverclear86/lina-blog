import { describe, expect, it } from "vitest";
import {
  ANSI_ART_MAX_COLUMNS,
  type RgbaImage,
  renderAnsiArt,
  renderPlainArt,
} from "./ansi-art";

type Pixel = [number, number, number, number];

const RED: Pixel = [255, 0, 0, 255];
const BLUE: Pixel = [0, 0, 255, 255];
const CLEAR: Pixel = [0, 0, 0, 0];

function img(width: number, height: number, pixels: Pixel[]): RgbaImage {
  return { width, height, data: Uint8Array.from(pixels.flat()) };
}

function strip(text: string): string {
  return text
    .split("\x1b")
    .map((part, i) => (i === 0 ? part : part.replace(/^\[[0-9;]*m/, "")))
    .join("");
}

// 4×2: top row RED, RED, CLEAR, CLEAR; bottom row BLUE, CLEAR, BLUE, CLEAR.
const SILHOUETTE = img(4, 2, [
  RED,
  RED,
  CLEAR,
  CLEAR,
  BLUE,
  CLEAR,
  BLUE,
  CLEAR,
]);

describe("renderAnsiArt", () => {
  it("上下とも不透明なセルは、上を前景・下を背景にした ▀ にする", () => {
    expect(renderAnsiArt(img(1, 2, [RED, BLUE]))).toBe(
      "\x1b[38;2;255;0;0;48;2;0;0;255m▀\x1b[0m\n",
    );
  });

  it("アルファが 128 未満の画素を透明、128 以上を不透明として扱う", () => {
    expect(
      renderAnsiArt(
        img(1, 2, [
          [1, 2, 3, 127],
          [4, 5, 6, 128],
        ]),
      ),
    ).toBe("\x1b[38;2;4;5;6;49m▄\x1b[0m\n");
  });

  it("上だけが不透明なセルは、上を前景にして背景を既定に戻した ▀ にする", () => {
    expect(renderAnsiArt(img(1, 2, [RED, CLEAR]))).toBe(
      "\x1b[38;2;255;0;0;49m▀\x1b[0m\n",
    );
  });

  it("下だけが不透明なセルは、下を前景にして背景を既定に戻した ▄ にする", () => {
    expect(renderAnsiArt(img(1, 2, [CLEAR, BLUE]))).toBe(
      "\x1b[38;2;0;0;255;49m▄\x1b[0m\n",
    );
  });

  it("上下とも透明なセルは、色を戻した空白にする", () => {
    expect(renderAnsiArt(img(1, 2, [CLEAR, CLEAR]))).toBe("\x1b[0m \x1b[0m\n");
  });

  it("高さが奇数のときは、最後の行の下半分を透明として扱う", () => {
    expect(renderAnsiArt(img(1, 3, [RED, RED, BLUE]))).toBe(
      "\x1b[38;2;255;0;0;48;2;255;0;0m▀\x1b[0m\n\x1b[38;2;0;0;255;49m▀\x1b[0m\n",
    );
  });

  it("幅 80 の画像の各行は、エスケープを除くと 80 字で、ESC[0m と改行で終わる", () => {
    const out = renderAnsiArt(img(80, 4, Array(80 * 4).fill(RED)));
    expect(out.endsWith("\n")).toBe(true);
    const lines = out.split("\n").slice(0, -1);
    expect(lines).toHaveLength(2);
    for (const line of lines) {
      expect(strip(line)).toHaveLength(80);
      expect(line.endsWith("\x1b[0m")).toBe(true);
    }
  });

  it("幅が ANSI_ART_MAX_COLUMNS（80）を超える画像は RangeError を投げる", () => {
    expect(ANSI_ART_MAX_COLUMNS).toBe(80);
    expect(() => renderAnsiArt(img(81, 1, Array(81).fill(RED)))).toThrow(
      RangeError,
    );
  });

  it("画素のバイト数が幅×高さ×4 と合わない画像は RangeError を投げる", () => {
    expect(() =>
      renderAnsiArt({ width: 2, height: 1, data: new Uint8Array(4) }),
    ).toThrow(RangeError);
  });

  it("エスケープを除くと ▀、▄、空白だけのシルエットになる", () => {
    expect(strip(renderAnsiArt(SILHOUETTE))).toBe("▀▀▄ \n");
  });
});

describe("renderPlainArt", () => {
  it("色の無い版はエスケープを含まず、上下とも不透明を █、片方を ▀ か ▄、透明を空白にする", () => {
    expect(renderPlainArt(SILHOUETTE)).toBe("█▀▄ \n");
  });
});
