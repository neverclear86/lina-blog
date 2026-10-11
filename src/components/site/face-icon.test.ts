import { describe, expect, it } from "vitest";
import { avatarFiles, markFiles } from "./face-icon";

describe("markFiles", () => {
  it("45px 以上は通常版を返す", () => {
    expect(markFiles(45)).toEqual({ light: "icon-dark", dark: "icon-ivory" });
    expect(markFiles(96)).toEqual({ light: "icon-dark", dark: "icon-ivory" });
  });

  it("27px から 44px は小サイズ版を返す", () => {
    const small = { light: "icon-small-dark", dark: "icon-small-ivory" };
    expect(markFiles(27)).toEqual(small);
    expect(markFiles(28)).toEqual(small);
    expect(markFiles(44)).toEqual(small);
  });

  it("inverse は default と明暗を入れ替える", () => {
    expect(markFiles(80, "inverse")).toEqual({
      light: "icon-ivory",
      dark: "icon-dark",
    });
    expect(markFiles(28, "inverse")).toEqual({
      light: "icon-small-ivory",
      dark: "icon-small-dark",
    });
  });

  it("27px 未満と数でない大きさは RangeError を投げる", () => {
    expect(() => markFiles(26)).toThrow(RangeError);
    expect(() => markFiles(0)).toThrow(RangeError);
    expect(() => markFiles(Number.NaN)).toThrow(RangeError);
  });
});

describe("avatarFiles", () => {
  it("40px 以上は通常版を返す", () => {
    const regular = {
      light: "avatar-dark-on-ivory-square",
      dark: "avatar-ivory-on-ink-square",
    };
    expect(avatarFiles(40)).toEqual(regular);
    expect(avatarFiles(96)).toEqual(regular);
  });

  it("40px 未満は小サイズ版を返す", () => {
    const small = {
      light: "avatar-small-dark-on-ivory-square",
      dark: "avatar-small-ivory-on-ink-square",
    };
    expect(avatarFiles(39)).toEqual(small);
    expect(avatarFiles(24)).toEqual(small);
  });
});
