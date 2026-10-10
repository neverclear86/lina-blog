import { verifyEvent } from "nostr-tools/pure";
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildArticleEvent, buildDeletionEvent } from "./article-event";
import {
  AUTHOR_PUBKEY,
  BUNKER_RELAY,
  CLIENT_KEY,
  FakeNostrSocket,
  nostr,
  SIGNER_PUBKEY,
} from "./fake-nostr";
import { openNip46Session } from "./nip46-message";
import { signEventWithBunker } from "./nip46-signer";

type Options = Parameters<typeof buildArticleEvent>[0];

const FRONTMATTER: Options["frontmatter"] = {
  title: "イキリの記事",
  slug: "hello-ikili-pro",
  tags: ["技術", "日記"],
  emoji: "🔥",
  topics: ["Astro", "Nostr"],
  description: "記事の要約",
};

const WITH_SPONSOR: Options["frontmatter"] = {
  ...FRONTMATTER,
  sponsor: { name: "スポンサー名", url: "https://example.com/" },
};

const BODY = "\n本文の 1 行目\n\n![図](https://img.ikili.pro/abc.png)\n";

const OPTIONS: Options = {
  frontmatter: FRONTMATTER,
  body: BODY,
  publishedDate: "2026-09-01T12:34:56.789Z",
  now: new Date("2026-09-28T00:00:00.600Z"),
};

/** The values after the name of every tag named `name`, in order. */
function tagValues(tags: string[][], name: string): string[][] {
  return tags.filter((tag) => tag[0] === name).map((tag) => tag.slice(1));
}

describe("buildArticleEvent", () => {
  it("kind は 30023 で、created_at は now の UNIX 秒（小数は切り捨て）", () => {
    const event = buildArticleEvent(OPTIONS);
    expect(event.kind).toBe(30023);
    expect(event.created_at).toBe(1790553600);
  });

  it("d タグは slug", () => {
    expect(tagValues(buildArticleEvent(OPTIONS).tags, "d")).toEqual([
      ["hello-ikili-pro"],
    ]);
  });

  it("title タグは title", () => {
    expect(tagValues(buildArticleEvent(OPTIONS).tags, "title")).toEqual([
      ["イキリの記事"],
    ]);
  });

  it("published_at タグは公開の記録の date の UNIX 秒（小数は切り捨て）を文字列にしたもの", () => {
    expect(tagValues(buildArticleEvent(OPTIONS).tags, "published_at")).toEqual([
      ["1788266096"],
    ]);
  });

  it("published_at は now に依らない", () => {
    const later = buildArticleEvent({
      ...OPTIONS,
      now: new Date("2027-01-01T00:00:00.000Z"),
    });
    expect(tagValues(later.tags, "published_at")).toEqual([["1788266096"]]);
  });

  it("summary タグは description", () => {
    expect(tagValues(buildArticleEvent(OPTIONS).tags, "summary")).toEqual([
      ["記事の要約"],
    ]);
  });

  it("t タグは tags の各値を順に 1 つずつで、topics は使わない", () => {
    expect(tagValues(buildArticleEvent(OPTIONS).tags, "t")).toEqual([
      ["技術"],
      ["日記"],
    ]);
  });

  it("sponsor が有るときは sponsor タグにスポンサー名だけを入れ、url は使わない", () => {
    const event = buildArticleEvent({ ...OPTIONS, frontmatter: WITH_SPONSOR });
    expect(tagValues(event.tags, "sponsor")).toEqual([["スポンサー名"]]);
  });

  it("sponsor が無いときは sponsor タグを付けない", () => {
    expect(tagValues(buildArticleEvent(OPTIONS).tags, "sponsor")).toEqual([]);
  });

  it("タグは d、title、published_at、summary、t、sponsor の順に並び、image と emoji のタグは付けない", () => {
    const event = buildArticleEvent({ ...OPTIONS, frontmatter: WITH_SPONSOR });
    expect(event.tags.map((tag) => tag[0])).toEqual([
      "d",
      "title",
      "published_at",
      "summary",
      "t",
      "t",
      "sponsor",
    ]);
  });

  it("content は受け取った本文を前後の改行も含めてそのまま入れる", () => {
    expect(buildArticleEvent(OPTIONS).content).toBe(BODY);
  });

  it("公開の記録の date が日時として読めないときは RangeError を投げる", () => {
    expect(() =>
      buildArticleEvent({ ...OPTIONS, publishedDate: "not a date" }),
    ).toThrow(new RangeError("Invalid published date: not a date"));
  });
});

describe("buildDeletionEvent", () => {
  const DELETION = {
    pubkey: AUTHOR_PUBKEY,
    slug: "hello-ikili-pro",
    now: new Date("2026-09-28T00:00:00.600Z"),
  };

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("kind は 5 で、created_at は now の UNIX 秒（小数は切り捨て）", () => {
    const event = buildDeletionEvent(DELETION);
    expect(event.kind).toBe(5);
    expect(event.created_at).toBe(1790553600);
  });

  it("タグは a（30023:<pubkey>:<slug>）、k（30023）の順に並ぶ", () => {
    expect(buildDeletionEvent(DELETION).tags).toEqual([
      ["a", `30023:${AUTHOR_PUBKEY}:hello-ikili-pro`],
      ["k", "30023"],
    ]);
  });

  it("content は空で、pubkey、id、sig を持たない", () => {
    expect(buildDeletionEvent(DELETION)).toEqual({
      kind: 5,
      created_at: 1790553600,
      tags: expect.any(Array),
      content: "",
    });
  });

  it("signEventWithBunker にそのまま渡すと、author の鍵で署名された kind 5 が返る", async () => {
    nostr.reset();
    vi.stubGlobal("WebSocket", FakeNostrSocket);
    const opened = openNip46Session(CLIENT_KEY, SIGNER_PUBKEY);
    if (!opened.ok) throw new Error(opened.message);
    const template = buildDeletionEvent(DELETION);
    const signed = await signEventWithBunker(template, {
      session: opened.session,
      relays: [BUNKER_RELAY],
      secret: "s3cret",
      now: DELETION.now,
    });
    if (!signed.ok) throw new Error(signed.message);
    expect(verifyEvent(signed.event)).toBe(true);
    expect(signed.event).toMatchObject({ ...template, pubkey: AUTHOR_PUBKEY });
  });
});
