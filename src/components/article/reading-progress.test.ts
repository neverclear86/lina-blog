import { describe, expect, it } from "vitest";
import { SECTION_LINE } from "../site/site-nav";
import {
  currentHeadingIndex,
  END_TOLERANCE,
  type ReadingGeometry,
  readingProgress,
} from "./reading-progress";

// 本文は 600px から 3600px、ヘッダーの下端は 60px、画面の高さは 800px、ページの動ける量は 5000px。
// 始まりは 540px（600 - 60）、終わりは 3200px（3600 - 400）になる。
const LONG: ReadingGeometry = {
  bodyTop: 600,
  bodyBottom: 3600,
  headerBottom: 60,
  viewportHeight: 800,
  maxScroll: 5000,
};

describe("readingProgress", () => {
  it("本文の上端がヘッダーの下端に届くまでは 0 で、その間の本文より上は動かない", () => {
    for (const y of [0, 300, 539, 540])
      expect(readingProgress(y, LONG)).toBe(0);
    expect(readingProgress(541, LONG)).toBeGreaterThan(0);
  });

  it("始まりと終わりの間は、スクロールに比例して増える", () => {
    expect(readingProgress(540 + 665, LONG)).toBe(0.25);
    expect(readingProgress(540 + 1330, LONG)).toBe(0.5);
    expect(readingProgress(540 + 1995, LONG)).toBe(0.75);
  });

  it("本文の下端が画面の中央に届いたとき 1 で、1px 以上手前は 1 にしない", () => {
    expect(END_TOLERANCE).toBe(1);
    expect(readingProgress(3200, LONG)).toBe(1);
    expect(readingProgress(3199.5, LONG)).toBe(1);
    expect(readingProgress(3200 - END_TOLERANCE, LONG)).toBeLessThan(1);
    // 旧の終わり（本文の下端が画面の下端に届く 2800px）では、まだ読み終えていない。
    expect(readingProgress(2800, LONG)).toBeLessThan(1);
  });

  it("本文より下までスクロールしても 1、上に引っ張って負になっても 0", () => {
    expect(readingProgress(4200, LONG)).toBe(1);
    expect(readingProgress(5000, LONG)).toBe(1);
    expect(readingProgress(-40, LONG)).toBe(0);
  });

  it("本文が短く下端を中央まで上げられないときは、ページの最下部で 1 になる", () => {
    // 下端を中央に上げるには 600px 要るが、ページは 500px しか動かない。始まりは 540px。
    const short: ReadingGeometry = {
      ...LONG,
      bodyBottom: 1000,
      maxScroll: 500,
    };
    for (const y of [0, 250, 498]) expect(readingProgress(y, short)).toBe(0);
    expect(readingProgress(499.5, short)).toBe(1);
    expect(readingProgress(500, short)).toBe(1);
  });

  it("終わりが最下部で打ち切られても、始まりが終わりより前なら増えていく", () => {
    const clipped: ReadingGeometry = {
      ...LONG,
      bodyTop: 100,
      bodyBottom: 1000,
      maxScroll: 500,
    };
    expect(readingProgress(40, clipped)).toBe(0);
    expect(readingProgress(270, clipped)).toBe(0.5);
    expect(readingProgress(500, clipped)).toBe(1);
  });

  it("本文の下端が始まりより前に中央を過ぎる記事は、終わりがページの最下部になる", () => {
    // dev-preview-older の 390px。始まりは 220px、中央に届く位置は負で、最下部は 235px。
    const early: ReadingGeometry = {
      bodyTop: 281,
      bodyBottom: 313,
      headerBottom: 61,
      viewportHeight: 844,
      maxScroll: 235,
    };
    for (const y of [0, -40, 220]) expect(readingProgress(y, early)).toBe(0);
    expect(readingProgress(227.5, early)).toBe(0.5);
    expect(readingProgress(235, early)).toBe(1);
  });

  it("本文の上端をヘッダーの下端まで上げられない記事は、最下部まで 0 で最下部で 1", () => {
    // dev-preview-older の 1440px。始まりは 417px、中央に届く位置は 62px で、最下部は 282px。
    const low: ReadingGeometry = {
      bodyTop: 478,
      bodyBottom: 512,
      headerBottom: 61,
      viewportHeight: 900,
      maxScroll: 282,
    };
    expect(readingProgress(62, low)).toBe(0);
    expect(readingProgress(281, low)).toBe(0);
    expect(readingProgress(282, low)).toBe(1);
  });

  it("ページがスクロールできないときは、スクロールの位置によらず 1", () => {
    const fits: ReadingGeometry = { ...LONG, maxScroll: 0 };
    expect(readingProgress(0, fits)).toBe(1);
    expect(readingProgress(-40, fits)).toBe(1);
    expect(readingProgress(0, { ...fits, maxScroll: -120 })).toBe(1);
  });

  it("ヘッダーの下端が下にあるほど、始まりが前になる", () => {
    expect(
      readingProgress(540, { ...LONG, headerBottom: 100 }),
    ).toBeGreaterThan(0);
    expect(readingProgress(540, { ...LONG, headerBottom: 60 })).toBe(0);
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
