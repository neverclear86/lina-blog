import { describe, expect, it } from "vitest";
import {
  currentHeadingIndex,
  END_TOLERANCE,
  readingProgress,
} from "./reading-progress";
import { SECTION_LINE } from "./site-nav";

describe("readingProgress", () => {
  it("ページの先頭で 0、本文の下端が画面の下に来たとき 1、その間は割合になる", () => {
    // 本文の下端が 1800px、画面の高さが 800px なので、1000px 動かすと下端に着く。
    expect(readingProgress(0, 1800, 800)).toBe(0);
    expect(readingProgress(250, 1800, 800)).toBe(0.25);
    expect(readingProgress(500, 1800, 800)).toBe(0.5);
    expect(readingProgress(1000, 1800, 800)).toBe(1);
  });

  it("本文の下端まで 1px 未満なら 1 にし、1px 以上手前は 1 にしない", () => {
    expect(END_TOLERANCE).toBe(1);
    expect(readingProgress(999.5, 1800, 800)).toBe(1);
    expect(readingProgress(1000 - END_TOLERANCE, 1800, 800)).toBeLessThan(1);
    expect(readingProgress(998, 1800, 800)).toBeLessThan(1);
  });

  it("本文より下までスクロールしても 1、上に引っ張って負になっても 0", () => {
    expect(readingProgress(1400, 1800, 800)).toBe(1);
    expect(readingProgress(-40, 1800, 800)).toBe(0);
  });

  it("本文が画面に収まるときは、スクロールの位置によらず 1", () => {
    expect(readingProgress(0, 600, 800)).toBe(1);
    expect(readingProgress(0, 800, 800)).toBe(1);
    expect(readingProgress(-40, 800, 800)).toBe(1);
    expect(readingProgress(120, 700, 800)).toBe(1);
  });
});

describe("currentHeadingIndex", () => {
  it("SECTION_LINE より上にある最後の見出し", () => {
    expect(currentHeadingIndex([-900, -300, 40, 600], 1200, 0.4)).toBe(2);
    expect(
      currentHeadingIndex([-900, -300, -40, SECTION_LINE + 1], 1200, 0.4),
    ).toBe(2);
  });

  it("どの見出しも上に無い間は、最初の見出し", () => {
    expect(currentHeadingIndex([400, 900, 1500], 100, 0.1)).toBe(0);
  });

  it("見出しの上端が SECTION_LINE にちょうど来たときは、その手前の見出し", () => {
    expect(currentHeadingIndex([-300, SECTION_LINE, 900], 600, 0.3)).toBe(0);
    expect(currentHeadingIndex([-300, SECTION_LINE - 1, 900], 600, 0.3)).toBe(
      1,
    );
  });

  it("スクロールして本文を読み終えたら、最後の見出し", () => {
    expect(currentHeadingIndex([-1200, -700, 300], 1000, 1)).toBe(2);
  });

  it("収まる記事の先頭（スクロール 0）では、読み終えた扱いにしない", () => {
    expect(currentHeadingIndex([300, 450, 600], 0, 1)).toBe(0);
  });

  it("見出しが無いときは -1", () => {
    expect(currentHeadingIndex([], 0, 0)).toBe(-1);
    expect(currentHeadingIndex([], 500, 1)).toBe(-1);
  });
});
