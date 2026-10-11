import { describe, expect, it } from "vitest";
import { blogPostUrl, nostrShareUrl, twitterShareUrl } from "./article-share";

const URL_OF_POST = "https://ikili.pro/blog/hello/";

describe("blogPostUrl", () => {
  it("site の origin の直下の /blog/<slug>/ を返す", () => {
    expect(blogPostUrl("hello", new URL("https://ikili.pro"))).toBe(
      URL_OF_POST,
    );
    expect(blogPostUrl("hello", new URL("https://ikili.pro/ja/"))).toBe(
      URL_OF_POST,
    );
  });
});

describe("twitterShareUrl", () => {
  it("x.com の投稿の intent で、text に題、url に記事の URL を載せる", () => {
    const shared = new URL(twitterShareUrl("はじめての記事", URL_OF_POST));
    expect(shared.origin + shared.pathname).toBe("https://x.com/intent/post");
    expect(shared.searchParams.get("text")).toBe("はじめての記事");
    expect(shared.searchParams.get("url")).toBe(URL_OF_POST);
  });

  it("記事の URL に query があっても url の値に収まる", () => {
    const shared = new URL(
      twitterShareUrl("題", "https://ikili.pro/blog/a/?a=1&b=2#top"),
    );
    expect([...shared.searchParams.keys()]).toEqual(["text", "url"]);
    expect(shared.searchParams.get("url")).toBe(
      "https://ikili.pro/blog/a/?a=1&b=2#top",
    );
  });

  it("題の & や # で query が増えたり切れたりしない", () => {
    const shared = new URL(twitterShareUrl("A & B #1", URL_OF_POST));
    expect([...shared.searchParams.keys()]).toEqual(["text", "url"]);
    expect(shared.searchParams.get("text")).toBe("A & B #1");
    expect(shared.hash).toBe("");
  });
});

describe("nostrShareUrl", () => {
  it("nostter の投稿の欄の content に、題、改行、記事の URL を載せる", () => {
    const shared = new URL(nostrShareUrl("はじめての記事", URL_OF_POST));
    expect(shared.origin + shared.pathname).toBe("https://nostter.app/post");
    expect(shared.searchParams.get("content")).toBe(
      `はじめての記事\n${URL_OF_POST}`,
    );
  });

  it("改行は %0A で、題の & や # で query が増えたり切れたりしない", () => {
    const address = nostrShareUrl("A & B #1", URL_OF_POST);
    expect(address).toContain("%0Ahttps%3A%2F%2Fikili.pro%2Fblog%2Fhello%2F");
    const shared = new URL(address);
    expect([...shared.searchParams.keys()]).toEqual(["content"]);
    expect(shared.searchParams.get("content")).toBe(`A & B #1\n${URL_OF_POST}`);
    expect(shared.hash).toBe("");
  });
});
