import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { oncePerFrame } from "./once-per-frame";

const source = (file: string) =>
  readFileSync(new URL(`../${file}`, import.meta.url), "utf8");

describe("oncePerFrame", () => {
  /** The frames that were asked for and have not run yet. */
  let frames: FrameRequestCallback[];

  /** Runs the frames that are waiting now; a frame asked for while they run waits for the next call. */
  const advance = () => {
    const running = frames;
    frames = [];
    for (const frame of running) frame(0);
  };

  beforeEach(() => {
    frames = [];
    vi.stubGlobal("requestAnimationFrame", (callback: FrameRequestCallback) => {
      frames.push(callback);
      return frames.length;
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("呼んだだけでは fn を動かさず、次のフレームで 1 回動かす", () => {
    const fn = vi.fn();
    oncePerFrame(fn)();
    expect(fn).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);
    advance();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("同じフレームの 2 回目以降の呼び出しは捨て、フレームは 1 つしか頼まない", () => {
    const fn = vi.fn();
    const schedule = oncePerFrame(fn);
    for (let i = 0; i < 5; i++) schedule();
    expect(frames).toHaveLength(1);
    advance();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("フレームの後の呼び出しは再び受け、次のフレームで動かす", () => {
    const fn = vi.fn();
    const schedule = oncePerFrame(fn);
    schedule();
    advance();
    schedule();
    schedule();
    expect(frames).toHaveLength(1);
    advance();
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("fn の中からの呼び出しは、次のフレームを頼む", () => {
    let calls = 0;
    const schedule = oncePerFrame(() => {
      calls++;
      if (calls === 1) schedule();
    });
    schedule();
    advance();
    expect(calls).toBe(1);
    expect(frames).toHaveLength(1);
    advance();
    expect(calls).toBe(2);
  });

  it("返した関数ごとに待ちを持ち、片方の待ちはもう片方を止めない", () => {
    const first = vi.fn();
    const second = vi.fn();
    const scheduleFirst = oncePerFrame(first);
    const scheduleSecond = oncePerFrame(second);
    scheduleFirst();
    scheduleSecond();
    expect(frames).toHaveLength(2);
    advance();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });
});

describe("oncePerFrame の使い手", () => {
  it("ヘッダーと記事の script は oncePerFrame で scroll と resize をまとめ、自前の queued の旗を持たない", () => {
    for (const file of [
      "components/SiteHeader.astro",
      "components/article-reading.ts",
    ]) {
      const text = source(file);
      expect(text, file).toContain("const schedule = oncePerFrame(update);");
      expect(text, file).not.toMatch(/\bqueued\b/);
    }
  });

  it("記事のページの script は article-reading を読み込むだけで、rAF の処理を持たない", () => {
    const text = source("pages/blog/[slug].astro");
    expect(text).toContain('import "../../components/article-reading";');
    expect(text).not.toContain("requestAnimationFrame");
    expect(text).not.toMatch(/\bqueued\b/);
  });
});
