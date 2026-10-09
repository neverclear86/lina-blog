import { describe, expect, it } from "vitest";
import {
  AVATAR_IMAGES,
  avatarAlt,
  HERO_POSES,
  THINKING,
  THREE_VIEW,
  THUMBS_UP_ARTICLE,
  THUMBS_UP_BAND,
} from "./avatar-images";

describe("AVATAR_IMAGES", () => {
  it("9 枚で、名前が重ならない", () => {
    const names = AVATAR_IMAGES.map((avatar) => avatar.name);
    expect(names).toHaveLength(9);
    expect(new Set(names).size).toBe(9);
  });

  it("Hero のポーズは rohan、lgtm-fullbody、happy-fullbody、main-visual の順", () => {
    expect(HERO_POSES.map((avatar) => avatar.name)).toEqual([
      "rohan",
      "lgtm-fullbody",
      "happy-fullbody",
      "main-visual",
    ]);
  });

  it("priority は Hero の最初のポーズだけにある", () => {
    const priorities = AVATAR_IMAGES.filter((avatar) => avatar.priority);
    expect(priorities.map((avatar) => avatar.name)).toEqual(["rohan"]);
  });

  it("widths は昇順で、sizes に書いた幅（px）が候補に含まれる", () => {
    for (const avatar of [...AVATAR_IMAGES, THUMBS_UP_ARTICLE]) {
      const sorted = [...avatar.widths].sort((a, b) => a - b);
      expect(avatar.widths, avatar.name).toEqual(sorted);
      const slots = [...avatar.sizes.matchAll(/(\d+)px(?:,|$)/g)].map((match) =>
        Number(match[1]),
      );
      expect(slots.length, avatar.name).toBeGreaterThan(0);
      for (const slot of slots) {
        expect(avatar.widths, `${avatar.name} ${slot}px`).toContain(slot);
      }
    }
  });
});

describe("avatarAlt", () => {
  it("ポーズは装飾なので、どの言語でも alt が空になる", () => {
    for (const pose of HERO_POSES) {
      expect(avatarAlt(pose, "ja")).toBe("");
      expect(avatarAlt(pose, "en")).toBe("");
    }
  });

  it("三面図は向きごとの alt を日本語と英語で返す", () => {
    expect(avatarAlt(THREE_VIEW.front, "ja")).toBe("創好リナ 正面");
    expect(avatarAlt(THREE_VIEW.side, "ja")).toBe("創好リナ 側面");
    expect(avatarAlt(THREE_VIEW.back, "ja")).toBe("創好リナ 背面");
    expect(avatarAlt(THREE_VIEW.front, "en")).toBe("Tsukusu Lina, front view");
    expect(avatarAlt(THREE_VIEW.side, "en")).toBe("Tsukusu Lina, side view");
    expect(avatarAlt(THREE_VIEW.back, "en")).toBe("Tsukusu Lina, back view");
  });

  it("意味のある画像は、日本語と英語で別の空でない alt を持つ", () => {
    const meaningful = AVATAR_IMAGES.filter((avatar) => avatar.altKey !== null);
    expect(meaningful).toHaveLength(5);
    for (const avatar of meaningful) {
      const ja = avatarAlt(avatar, "ja");
      const en = avatarAlt(avatar, "en");
      expect(ja, avatar.name).not.toBe("");
      expect(en, avatar.name).not.toBe("");
      expect(ja, avatar.name).not.toBe(en);
    }
    expect(avatarAlt(THUMBS_UP_BAND, "ja")).toBe("サムズアップする創好リナ");
    expect(avatarAlt(THINKING, "ja")).toBe("考えこむ創好リナ");
  });
});

describe("THUMBS_UP_BAND", () => {
  it("sizes は 900px 未満で 128px、900px 以上で 374px を指す", () => {
    expect(THUMBS_UP_BAND.sizes).toBe("(max-width: 899px) 128px, 374px");
  });
});

describe("THUMBS_UP_ARTICLE", () => {
  it("帯と同じ画像と alt で、sizes だけが記事の 340px になる", () => {
    expect(THUMBS_UP_ARTICLE).toEqual({ ...THUMBS_UP_BAND, sizes: "340px" });
  });
});
