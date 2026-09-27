/**
 * Builds the notification mail for a contact form submission.
 *
 * The result is the object form that `send()` of the `send_email` binding accepts, so this
 * module does not import `cloudflare:email` and runs under Vitest. `send()` builds the MIME
 * message and encodes non-ASCII headers; this module only keeps sender input from adding
 * header lines.
 */

/**
 * Sender address of the notification. It must be on a domain with Email Routing enabled, and
 * it is the only address in `allowed_sender_addresses` of the `CONTACT_MAIL` binding in
 * `wrangler.jsonc`.
 */
export const CONTACT_MAIL_FROM = "noreply@ikili.pro";

/** Display name of the sender. */
const CONTACT_MAIL_FROM_NAME = "ikili.pro お問い合わせ";

/** Contact form fields that go into the notification, already validated by the caller. */
export interface ContactMailInput {
  /** Label of the selected topic, such as "お仕事のご相談". */
  topic: string;
  /** Sender's name. */
  name: string;
  /** Sender's address, used as `Reply-To`. */
  email: string;
  /** Message body. Line breaks are kept. */
  message: string;
}

/** A mailbox with a display name, in the `EmailAddress` shape that `send()` accepts. */
export interface MailAddress {
  name: string;
  email: string;
}

/** Notification mail in the object form that `send()` of the `send_email` binding accepts. */
export interface ContactMail {
  from: MailAddress;
  to: string;
  /** The sender, as a bare address when the cleaned name is empty. */
  replyTo: MailAddress | string;
  subject: string;
  text: string;
}

const MAILBOX_PART = String.raw`[^\s\p{Cc}<>()[\]\\,;:"@]+`;
const MAILBOX = new RegExp(`^${MAILBOX_PART}@${MAILBOX_PART}$`, "u");

/** Replaces each run of whitespace and control characters with one space and trims the ends. */
function toHeaderText(value: string): string {
  return value.replace(/[\s\p{Cc}]+/gu, " ").trim();
}

/**
 * Throws a `RangeError` unless `address` is one `local@domain` without whitespace, control
 * characters or the separators `<>()[]\,;:"`.
 */
function assertMailbox(address: string, label: string): void {
  if (!MAILBOX.test(address)) {
    throw new RangeError(`${label} is not a single mail address`);
  }
}

/**
 * Builds the notification mail sent to `to` for one contact form submission.
 *
 * The subject is `[ikili.pro] <topic>: <name>`, and `Reply-To` is the sender so that a reply
 * goes to them. Each run of whitespace and control characters (including CR and LF) in the
 * topic and the name becomes one space, so the input cannot add header lines. When the name
 * is empty after that, the subject has no name and `Reply-To` is the bare address.
 * @param input Validated form fields.
 * @param to Recipient address.
 * @returns The mail in the object form that `send()` of the `send_email` binding accepts.
 * @throws {RangeError} When `to` or `input.email` is not a single address, for example when
 *   it is empty or contains a line break.
 */
export function buildContactMail(
  input: ContactMailInput,
  to: string,
): ContactMail {
  assertMailbox(to, "to");
  assertMailbox(input.email, "email");
  const topic = toHeaderText(input.topic);
  const name = toHeaderText(input.name);
  return {
    from: { name: CONTACT_MAIL_FROM_NAME, email: CONTACT_MAIL_FROM },
    to,
    replyTo: name === "" ? input.email : { name, email: input.email },
    subject:
      name === "" ? `[ikili.pro] ${topic}` : `[ikili.pro] ${topic}: ${name}`,
    text: [
      "ikili.pro のお問い合わせフォームから送信がありました。",
      "",
      `ご用件: ${topic}`,
      `お名前: ${name}`,
      `メールアドレス: ${input.email}`,
      "",
      input.message,
    ].join("\n"),
  };
}
