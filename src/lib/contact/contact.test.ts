import { describe, expect, it } from "vitest";
import { CONTACT_KINDS, CONTACT_LIMITS, validateContact } from "./contact";

const VALID = {
  kind: "work",
  name: "創好リナ",
  email: "lina@example.com",
  message: "お仕事のご相談です。",
};

describe("validateContact", () => {
  it("正しい入力は前後の空白を除いた値を返す", () => {
    const result = validateContact({
      kind: "work",
      name: "  創好リナ\n",
      email: "\t lina@example.com \r\n",
      message: "\n お仕事のご相談です。  \n",
      "cf-turnstile-response": "x",
    });
    expect(result).toEqual({ ok: true, value: VALID });
  });

  it("ご用件は CONTACT_KINDS の値をすべて受け付ける", () => {
    for (const kind of CONTACT_KINDS) {
      expect(validateContact({ ...VALID, kind }).ok).toBe(true);
    }
  });

  it("本文の改行は LF にそろえて残す", () => {
    const result = validateContact({
      ...VALID,
      message: "1行目\r\n2行目\r3行目",
    });
    expect(result).toEqual({
      ok: true,
      value: { ...VALID, message: "1行目\n2行目\n3行目" },
    });
  });

  it("項目が欠けた入力は項目ごとに required を返す", () => {
    const allRequired = {
      ok: false,
      errors: {
        kind: "required",
        name: "required",
        email: "required",
        message: "required",
      },
    };
    expect(validateContact({})).toEqual(allRequired);
    expect(
      validateContact({ kind: null, name: null, email: null, message: null }),
    ).toEqual(allRequired);
  });

  it("空白だけの値は required を返す", () => {
    const result = validateContact({
      kind: "",
      name: "   ",
      email: "\n",
      message: " \r\n\t ",
    });
    expect(result).toEqual({
      ok: false,
      errors: {
        kind: "required",
        name: "required",
        email: "required",
        message: "required",
      },
    });
  });

  it("文字列でない値は invalid を返す", () => {
    const result = validateContact({
      kind: 1,
      name: ["創好リナ"],
      email: { address: "lina@example.com" },
      message: 42,
    });
    expect(result).toEqual({
      ok: false,
      errors: {
        kind: "invalid",
        name: "invalid",
        email: "invalid",
        message: "invalid",
      },
    });
  });

  it("選択肢に無いご用件は invalid を返す", () => {
    expect(validateContact({ ...VALID, kind: "spam" })).toEqual({
      ok: false,
      errors: { kind: "invalid" },
    });
  });

  it("上限ちょうどの長さは受け付け、1 文字超えると too_long を返す", () => {
    const domain = "@example.com";
    const atLimit = {
      ...VALID,
      name: "あ".repeat(CONTACT_LIMITS.name),
      email: "a".repeat(CONTACT_LIMITS.email - domain.length) + domain,
      message: "あ".repeat(CONTACT_LIMITS.message),
    };
    expect(validateContact(atLimit).ok).toBe(true);

    const overLimit = {
      ...VALID,
      name: `${atLimit.name}あ`,
      email: `a${atLimit.email}`,
      message: `${atLimit.message}あ`,
    };
    expect(validateContact(overLimit)).toEqual({
      ok: false,
      errors: { name: "too_long", email: "too_long", message: "too_long" },
    });
  });

  it("形式の誤ったメールアドレスは invalid を返す", () => {
    for (const email of [
      "lina",
      "lina@",
      "@example.com",
      "li na@example.com",
      "lina@example..com",
    ]) {
      expect(validateContact({ ...VALID, email })).toEqual({
        ok: false,
        errors: { email: "invalid" },
      });
    }
  });

  it("名前とメールアドレスの途中の改行は newline を返す", () => {
    const result = validateContact({
      ...VALID,
      name: "リナ\r\nBcc: x@example.com",
      email: "lina@example.com\nBcc: x@example.com",
    });
    expect(result).toEqual({
      ok: false,
      errors: { name: "newline", email: "newline" },
    });
  });
});
