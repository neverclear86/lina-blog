import { describe, expect, it } from "vitest";
import {
  createSwipe,
  type KeyLike,
  type PointerLike,
  SWIPE_DISTANCE,
  viewAfterKey,
  viewAfterSwipe,
} from "./three-view-tabs";

const key = (name: string, mods: Partial<KeyLike> = {}): KeyLike => ({
  key: name,
  altKey: false,
  ctrlKey: false,
  metaKey: false,
  ...mods,
});

const pointer = (clientX: number, rest: Partial<PointerLike> = {}) => ({
  isPrimary: true,
  button: 0,
  clientX,
  ...rest,
});

describe("viewAfterKey", () => {
  it("→ で次の向きに進む", () => {
    expect(viewAfterKey(key("ArrowRight"), 0, 3)).toBe(1);
  });

  it("→ で最後から最初に戻る", () => {
    expect(viewAfterKey(key("ArrowRight"), 2, 3)).toBe(0);
  });

  it("← で前の向きに戻る", () => {
    expect(viewAfterKey(key("ArrowLeft"), 2, 3)).toBe(1);
  });

  it("← で最初から最後に回る", () => {
    expect(viewAfterKey(key("ArrowLeft"), 0, 3)).toBe(2);
  });

  it("Home と End で両端に移る", () => {
    expect(viewAfterKey(key("Home"), 2, 3)).toBe(0);
    expect(viewAfterKey(key("End"), 0, 3)).toBe(2);
  });

  it("ほかのキーは null", () => {
    expect(viewAfterKey(key("Enter"), 0, 3)).toBeNull();
    expect(viewAfterKey(key("ArrowDown"), 0, 3)).toBeNull();
  });

  it("Alt・Ctrl・Meta 付きは null", () => {
    expect(viewAfterKey(key("ArrowLeft", { altKey: true }), 1, 3)).toBeNull();
    expect(viewAfterKey(key("Home", { ctrlKey: true }), 1, 3)).toBeNull();
    expect(viewAfterKey(key("ArrowRight", { metaKey: true }), 1, 3)).toBeNull();
  });
});

describe("viewAfterSwipe", () => {
  it("タップは次の向きに進む", () => {
    expect(viewAfterSwipe(0, 0, 3)).toBe(1);
    expect(viewAfterSwipe(-3, 1, 3)).toBe(2);
  });

  it("左への移動は次に進み、最後から最初に戻る", () => {
    expect(viewAfterSwipe(-120, 1, 3)).toBe(2);
    expect(viewAfterSwipe(-120, 2, 3)).toBe(0);
  });

  it("右へ SWIPE_DISTANCE を超えると前に戻り、最初から最後に回る", () => {
    expect(viewAfterSwipe(SWIPE_DISTANCE + 1, 2, 3)).toBe(1);
    expect(viewAfterSwipe(SWIPE_DISTANCE + 1, 0, 3)).toBe(2);
  });

  it("右へちょうど SWIPE_DISTANCE はタップと同じ", () => {
    expect(viewAfterSwipe(SWIPE_DISTANCE, 0, 3)).toBe(1);
  });
});

describe("createSwipe", () => {
  it("down から up までの移動量を返す", () => {
    const swipe = createSwipe();
    swipe.down(pointer(100));
    expect(swipe.up(pointer(160))).toBe(60);
  });

  it("左への移動は負の値", () => {
    const swipe = createSwipe();
    swipe.down(pointer(100));
    expect(swipe.up(pointer(40))).toBe(-60);
  });

  it("down の無い up は null", () => {
    expect(createSwipe().up(pointer(100))).toBeNull();
  });

  it("up の後の 2 回目の up は null", () => {
    const swipe = createSwipe();
    swipe.down(pointer(100));
    swipe.up(pointer(100));
    expect(swipe.up(pointer(100))).toBeNull();
  });

  it("cancel の後の up は null", () => {
    const swipe = createSwipe();
    swipe.down(pointer(100));
    swipe.cancel();
    expect(swipe.up(pointer(180))).toBeNull();
  });

  it("主ボタンでない down は始点にならない", () => {
    const swipe = createSwipe();
    swipe.down(pointer(100, { button: 2 }));
    expect(swipe.up(pointer(180))).toBeNull();
  });

  it("2 本目の指の down は始点を忘れさせる", () => {
    const swipe = createSwipe();
    swipe.down(pointer(100));
    swipe.down(pointer(300, { isPrimary: false }));
    expect(swipe.up(pointer(180))).toBeNull();
  });

  it("主ボタンでない up は null で始点も忘れる", () => {
    const swipe = createSwipe();
    swipe.down(pointer(100));
    expect(swipe.up(pointer(180, { isPrimary: false }))).toBeNull();
    expect(swipe.up(pointer(180))).toBeNull();
  });
});
