import { describe, expect, it } from "vitest";
import { experimental_readRawConfig } from "wrangler";
import {
  buildContactMail,
  CONTACT_MAIL_FROM,
  type ContactMailInput,
} from "./contact-mail";

const input: ContactMailInput = {
  topic: "お仕事のご相談",
  name: "創好リナ",
  email: "sender@example.com",
  message: "1 行目\n2 行目",
};
const to = "owner@example.com";

describe("buildContactMail", () => {
  it("正しい入力から From、To、Reply-To、件名、本文を組み立てる", () => {
    expect(buildContactMail(input, to)).toEqual({
      from: { name: "ikili.pro お問い合わせ", email: "noreply@ikili.pro" },
      to: "owner@example.com",
      replyTo: { name: "創好リナ", email: "sender@example.com" },
      subject: "[ikili.pro] お仕事のご相談: 創好リナ",
      text: "ikili.pro のお問い合わせフォームから送信がありました。\n\nご用件: お仕事のご相談\nお名前: 創好リナ\nメールアドレス: sender@example.com\n\n1 行目\n2 行目",
    });
  });

  it("ご用件と名前の改行と制御文字を空白 1 つにして件名と Reply-To に入れる", () => {
    const mail = buildContactMail(
      {
        ...input,
        topic: "その他\x00\r\nBcc: x@example.com",
        name: "リナ\nBcc: y@example.com\x85",
      },
      to,
    );
    expect(mail.subject).toBe(
      "[ikili.pro] その他 Bcc: x@example.com: リナ Bcc: y@example.com",
    );
    expect(mail.replyTo).toEqual({
      name: "リナ Bcc: y@example.com",
      email: "sender@example.com",
    });
  });

  it("整えた名前が空なら件名に名前を入れず Reply-To をアドレスだけにする", () => {
    const mail = buildContactMail({ ...input, name: "\r\n" }, to);
    expect(mail.replyTo).toBe("sender@example.com");
    expect(mail.subject).toBe("[ikili.pro] お仕事のご相談");
  });

  it.each([
    "sender@example.com\r\nBcc: x@example.com",
    "a b@example.com",
    "Evil <x@example.com>",
    "a@b@c",
    "",
  ])(
    "送信者のアドレスが 1 つのアドレスでないと RangeError を投げる（%j）",
    (email) => {
      expect(() => buildContactMail({ ...input, email }, to)).toThrow(
        RangeError,
      );
    },
  );

  it.each(["", "owner@example.com, x@example.com"])(
    "宛先が空か 1 つのアドレスでないと RangeError を投げる（%j）",
    (recipient) => {
      expect(() => buildContactMail(input, recipient)).toThrow(RangeError);
    },
  );

  it("wrangler.jsonc の CONTACT_MAIL バインディングが送信元を CONTACT_MAIL_FROM だけに許す", () => {
    const { rawConfig } = experimental_readRawConfig({
      config: "wrangler.jsonc",
    });
    expect(rawConfig.send_email).toEqual([
      { name: "CONTACT_MAIL", allowed_sender_addresses: [CONTACT_MAIL_FROM] },
    ]);
  });
});
