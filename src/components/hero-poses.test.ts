import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { LOCALES } from "../i18n/locales";
import { translate } from "../i18n/ui";
import { nextPose, poseClass, poseLabel } from "./hero-poses";

const POSES = readFileSync(
  new URL("./HeroPoses.astro", import.meta.url),
  "utf8",
);

describe("nextPose", () => {
  it("次のポーズの番号を返す", () => {
    expect(nextPose(0, 4)).toBe(1);
    expect(nextPose(2, 4)).toBe(3);
  });

  it("最後のポーズの次は最初のポーズに戻る", () => {
    expect(nextPose(3, 4)).toBe(0);
  });

  it("ポーズの数が 1 以上でないときは 0 を返す", () => {
    expect(nextPose(0, 0)).toBe(0);
    expect(nextPose(2, -1)).toBe(0);
  });
});

describe("poseClass", () => {
  it("切り替える前は、見せているポーズにクラスを付けず、他を隠す", () => {
    expect([0, 1, 2, 3].map((i) => poseClass(i, 0, null))).toEqual([
      "",
      "pz-off",
      "pz-off",
      "pz-off",
    ]);
  });

  it("切り替えたあとは、見せるポーズに pz-in、前のポーズに pz-out、他に pz-off を付ける", () => {
    expect([0, 1, 2, 3].map((i) => poseClass(i, 2, 1))).toEqual([
      "pz-off",
      "pz-out",
      "pz-in",
      "pz-off",
    ]);
  });

  it("最後のポーズから最初のポーズへ戻るときも、最初に pz-in、最後に pz-out を付ける", () => {
    expect([0, 1, 2, 3].map((i) => poseClass(i, 0, 3))).toEqual([
      "pz-in",
      "pz-off",
      "pz-off",
      "pz-out",
    ]);
  });

  it("ポーズが 1 つだけのときは、前と今が同じでも pz-in を付ける", () => {
    expect(poseClass(0, 0, 0)).toBe("pz-in");
  });
});

describe("poseLabel", () => {
  it("{n} と {total} をポーズの番号と数に置き換える", () => {
    expect(poseLabel("pose {n}/{total}", 3, 4)).toBe("pose 3/4");
  });

  it("同じ置き換え先が複数あるときはすべて置き換える", () => {
    expect(poseLabel("{n}, {n} of {total}", 2, 4)).toBe("2, 2 of 4");
  });

  it("ボタンの名前は日本語も英語も {n} と {total} を含む", () => {
    for (const locale of LOCALES) {
      const template = translate(locale, "hero.poseButton");
      expect(template).toContain("{n}");
      expect(template).toContain("{total}");
      expect(poseLabel(template, 1, 4)).not.toMatch(/[{}]/);
    }
  });
});

describe("HeroPoses.astro", () => {
  it("ボタンは hidden を付けて出し、script が外す", () => {
    expect(POSES).toMatch(/<button[^>]*\bhidden\b/);
    expect(POSES).toMatch(/button\.hidden = false/);
  });

  it("script は押すたびに aria-label と n/total の表示を作り直す", () => {
    expect(POSES).toMatch(
      /button\.setAttribute\(\s*"aria-label",\s*poseLabel\(/,
    );
    expect(POSES).toMatch(
      /counter\.textContent = `\$\{current \+ 1\}\/\$\{images\.length\}`/,
    );
  });

  it("pose の行は hidden を付けて出し、script が外す", () => {
    expect(POSES).toMatch(/data-pose-row hidden/);
    expect(POSES).toMatch(/row\.hidden = false/);
    expect(POSES).toMatch(/\.spec-row\[hidden\]\s*\{\s*display:\s*none;\s*\}/);
  });

  it("目盛りとラベルとスペック表は支援技術から隠す", () => {
    expect(POSES).toMatch(/class="ruler" aria-hidden="true"/);
    expect(POSES).toMatch(/class="label ruler-top" aria-hidden="true"/);
    expect(POSES).toMatch(/class="label ruler-zero" aria-hidden="true"/);
    expect(POSES).toMatch(/class="spec" aria-hidden="true"/);
  });

  it("隠すポーズは visibility: hidden にし、display: none にしない", () => {
    expect(POSES).toMatch(/\.pose\.pz-off\s*\{\s*visibility:\s*hidden;\s*\}/);
    expect(POSES).not.toMatch(/\.pz-off\s*\{[^}]*display/);
  });

  it("動きを減らす設定では pz-in と pz-out の動きを止め、pz-out を隠す", () => {
    const reduce = POSES.slice(
      POSES.indexOf("@media (prefers-reduced-motion: reduce)"),
    );
    expect(reduce).toMatch(
      /\.pose\.pz-in,\s*\.pose\.pz-out\s*\{\s*animation:\s*none;\s*\}/,
    );
    expect(reduce).toMatch(/\.pose\.pz-out\s*\{\s*visibility:\s*hidden;\s*\}/);
  });

  it("インラインの style 属性を持たない", () => {
    expect(POSES).not.toMatch(/\sstyle=/);
  });
});
