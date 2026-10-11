import { describe, expect, it } from "vitest";
import { profileLink } from "./profile-links";

describe("profileLink", () => {
  it.each(["youtube", "twitter", "github", "nostr", "zenn"] as const)(
    "%s: id が同じプロフィールを返す",
    (id) => {
      expect(profileLink(id).id).toBe(id);
    },
  );

  it("twitter は x.com のプロフィールの URL を返す", () => {
    expect(profileLink("twitter").url).toBe("https://x.com/TsukusuLina");
  });
});
