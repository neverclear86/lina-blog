import { describe, expect, it, vi } from "vitest";
import config from "../astro.config.mjs";
import { loadOgFonts, OG_FONT_FACES, truetypeUrlFromCss } from "./og-font";

const TTF_URL = "https://fonts.gstatic.com/s/example/v1/font.ttf";

/** A stylesheet as Google answers a request without a browser `User-Agent`. */
const TRUETYPE_CSS = `@font-face {
  font-family: 'Example';
  font-style: normal;
  font-weight: 400;
  src: url(${TTF_URL}) format('truetype');
}`;

/** A stylesheet as Google answers a browser: WOFF2 files split by `unicode-range`. */
const WOFF2_CSS = `/* [0] */
@font-face {
  font-family: 'Example';
  font-style: normal;
  font-weight: 400;
  src: url(https://fonts.gstatic.com/s/example/v1/chunk0.woff2) format('woff2');
  unicode-range: U+0020-007E;
}`;

describe("truetypeUrlFromCss", () => {
  it("TrueType の src の URL を取り出す", () => {
    expect(truetypeUrlFromCss(TRUETYPE_CSS)).toBe(TTF_URL);
  });

  it("WOFF2 だけの CSS には null を返す", () => {
    expect(truetypeUrlFromCss(WOFF2_CSS)).toBeNull();
  });
});

describe("loadOgFonts", () => {
  /** Returns a `fetch` stub that answers the font file with `fontStatus` and a stylesheet otherwise. */
  const stubFetch = ({
    css = TRUETYPE_CSS,
    cssStatus = 200,
    fontStatus = 200,
  } = {}) =>
    vi.fn<typeof fetch>(async (input) =>
      String(input) === TTF_URL
        ? new Response(new Uint8Array([0, 1, 0, 0]), { status: fontStatus })
        : new Response(css, { status: cssStatus }),
    );

  it("面ごとの CSS を引き、その TrueType を面の順に返す", async () => {
    const fetchImpl = stubFetch();
    const fonts = await loadOgFonts(fetchImpl);
    expect(
      fonts.map(({ name, weight, style }) => ({ name, weight, style })),
    ).toEqual(
      OG_FONT_FACES.map(({ family, weight }) => ({
        name: family,
        weight,
        style: "normal",
      })),
    );
    expect(fonts.map(({ data }) => [...new Uint8Array(data)])).toEqual(
      OG_FONT_FACES.map(() => [0, 1, 0, 0]),
    );
    expect(
      fetchImpl.mock.calls
        .map(([input]) => String(input))
        .filter((url) => url !== TTF_URL),
    ).toEqual([
      "https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@900",
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400",
      "https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@700",
    ]);
  });

  it("ブラウザーの User-Agent を付けずに引く", async () => {
    const fetchImpl = stubFetch();
    await loadOgFonts(fetchImpl);
    expect(fetchImpl.mock.calls.length).toBe(OG_FONT_FACES.length * 2);
    expect(fetchImpl.mock.calls.every((args) => args.length === 1)).toBe(true);
  });

  it("CSS の応答が 2xx でなければ投げる", async () => {
    await expect(loadOgFonts(stubFetch({ cssStatus: 500 }))).rejects.toThrow(
      "500",
    );
  });

  it("CSS に TrueType が無ければ投げる", async () => {
    await expect(loadOgFonts(stubFetch({ css: WOFF2_CSS }))).rejects.toThrow(
      "no TrueType",
    );
  });

  it("フォントの応答が 2xx でなければ投げる", async () => {
    await expect(loadOgFonts(stubFetch({ fontStatus: 404 }))).rejects.toThrow(
      "404",
    );
  });
});

describe("OGP の書体と太さは Fonts API の設定に含まれる", () => {
  /** Whether a `weights` entry of the Fonts API, a number or a range like `"400 800"`, has `weight`. */
  const covers = (entry: number | string, weight: number): boolean => {
    if (typeof entry === "number") return entry === weight;
    const [from = Number.NaN, to = from] = entry.split(" ").map(Number);
    return from <= weight && weight <= to;
  };

  it.each(OG_FONT_FACES)("$family $weight", (face) => {
    const family = (config.fonts ?? []).find(
      ({ name }) => name === face.family,
    );
    expect(family?.weights?.some((entry) => covers(entry, face.weight))).toBe(
      true,
    );
  });
});
