import { describe, expect, it } from "vitest";
import {
  type CopyLabels,
  canCopy,
  copyText,
  parseCopyLabels,
} from "./code-copy";

const LABELS: CopyLabels = {
  name: "コードをコピー",
  idle: "copy",
  done: "copied",
  fail: "failed",
  doneMessage: "コードをコピーしました",
  failMessage: "コピーできませんでした",
};

describe("parseCopyLabels", () => {
  it("文言の JSON を文言のオブジェクトに戻す", () => {
    expect(parseCopyLabels(JSON.stringify(LABELS))).toEqual(LABELS);
  });

  it("値が無いときは undefined を返す", () => {
    expect(parseCopyLabels(undefined)).toBeUndefined();
  });

  it("JSON でない文字列は undefined を返し、例外を投げない", () => {
    expect(parseCopyLabels("{name:")).toBeUndefined();
    expect(parseCopyLabels("")).toBeUndefined();
  });

  it.each(["null", "[]", '"copy"', "1"])(
    "オブジェクトでない JSON %s は undefined を返す",
    (json) => {
      expect(parseCopyLabels(json)).toBeUndefined();
    },
  );

  it("文言のキーが 1 つ欠けると undefined を返す", () => {
    for (const key of Object.keys(LABELS)) {
      const { [key as keyof CopyLabels]: _removed, ...rest } = LABELS;
      expect(parseCopyLabels(JSON.stringify(rest))).toBeUndefined();
    }
  });

  it("文言の値が文字列でないと undefined を返す", () => {
    for (const key of Object.keys(LABELS)) {
      expect(
        parseCopyLabels(JSON.stringify({ ...LABELS, [key]: 1 })),
      ).toBeUndefined();
    }
  });
});

describe("canCopy", () => {
  it("書き込みの関数があり、コードに文字があるときは true を返す", () => {
    expect(canCopy(() => Promise.resolve(), "bun run build\n")).toBe(true);
  });

  it("書き込みの関数が無いとき（安全でない文脈の navigator.clipboard）は false を返す", () => {
    expect(canCopy(undefined, "bun run build")).toBe(false);
  });

  it("書き込みが関数でないときは false を返す", () => {
    expect(canCopy("writeText", "bun run build")).toBe(false);
    expect(canCopy({}, "bun run build")).toBe(false);
  });

  it.each(["", "\n", " \n\t"])(
    "コードが空か空白だけ（%j）のときは false を返す",
    (code) => {
      expect(canCopy(() => Promise.resolve(), code)).toBe(false);
    },
  );
});

describe("copyText", () => {
  it("書き込みが成功すると、渡した文字列を書いて copied を返す", async () => {
    const written: string[] = [];
    const result = await copyText((text) => {
      written.push(text);
      return Promise.resolve();
    }, "line 1\nline 2\n");
    expect(result).toBe("copied");
    expect(written).toEqual(["line 1\nline 2\n"]);
  });

  it("書き込みが拒否されると failed を返し、例外を投げない", async () => {
    const result = await copyText(
      () => Promise.reject(new DOMException("denied", "NotAllowedError")),
      "x",
    );
    expect(result).toBe("failed");
  });

  it("書き込みが同期に例外を投げても failed を返す", async () => {
    const result = await copyText(() => {
      throw new TypeError("not a function");
    }, "x");
    expect(result).toBe("failed");
  });
});
