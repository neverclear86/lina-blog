import { describe, expect, it } from "vitest";
import {
  ANSI_ART_MAX_COLUMNS,
  renderAnsiArt,
  renderPlainArt,
} from "./ansi-art";
import { ANSI_ART_SOURCE, decodeAnsiArtSource } from "./ansi-art-source";

function strip(text: string): string {
  return text
    .split("\x1b")
    .map((part, i) => (i === 0 ? part : part.replace(/^\[[0-9;]*m/, "")))
    .join("");
}

/** Splits the output at its single trailing newline, keeping empty lines (71 lines expected). */
function lines(output: string): string[] {
  return output.slice(0, -1).split("\n");
}

describe("decodeAnsiArtSource", () => {
  it("元の画像は src/assets/main-visual.webp である", () => {
    expect(
      ANSI_ART_SOURCE.pathname.endsWith("/src/assets/main-visual.webp"),
    ).toBe(true);
  });

  it("横幅を 80 画素にし、縦横比を保って縮める", async () => {
    const image = await decodeAnsiArtSource();
    expect(image.width).toBe(ANSI_ART_MAX_COLUMNS);
    expect(image.height).toBe(Math.round((80 * 2390) / 1356));
  });

  it("色付きの各行は、エスケープを除くと 80 桁以下で、行末でリセットする", async () => {
    const rows = lines(renderAnsiArt(await decodeAnsiArtSource()));
    expect(rows).toHaveLength(71);
    for (const row of rows) {
      expect([...strip(row)].length).toBeLessThanOrEqual(80);
      expect(row.endsWith("\x1b[0m")).toBe(true);
    }
  });

  it("色無しの各行は 80 桁以下で、エスケープを含まず、人物の画素を描く", async () => {
    const rows = lines(renderPlainArt(await decodeAnsiArtSource()));
    expect(rows).toHaveLength(71);
    for (const row of rows) {
      expect([...row].length).toBeLessThanOrEqual(80);
      expect(row).not.toContain("\x1b");
    }
    expect(rows.some((row) => /[█▀▄]/.test(row))).toBe(true);
  });
});
