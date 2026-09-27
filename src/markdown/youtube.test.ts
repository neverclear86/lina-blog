import { markdownToHtml } from "satteri";
import { describe, expect, it } from "vitest";
import { youtubeEmbed } from "./youtube";

const ID = "dQw4w9WgXcQ";

function render(markdown: string): string {
  return markdownToHtml(markdown, { hastPlugins: [youtubeEmbed] }).html.trim();
}

describe("youtubeEmbed", () => {
  it("YouTube の URL だけの段落を、遅延して読む youtube-nocookie.com の iframe にする", () => {
    expect(render(`https://youtu.be/${ID}\n`)).toBe(
      `<iframe class="youtube-embed" src="https://www.youtube-nocookie.com/embed/${ID}" title="YouTube の動画" width="560" height="315" loading="lazy" allow="clipboard-write; encrypted-media; picture-in-picture; web-share" allowfullscreen></iframe>`,
    );
  });

  it.each([
    `https://www.youtube.com/watch?v=${ID}`,
    `https://youtube.com/watch?v=${ID}`,
    `https://m.youtube.com/watch?v=${ID}`,
    `https://www.youtube.com/watch?v=${ID}&t=10s`,
    `https://youtu.be/${ID}?si=abcdef`,
  ])("%s だけの段落を埋め込みにする", (url) => {
    const html = render(`${url}\n`);
    expect(html).toContain(
      `src="https://www.youtube-nocookie.com/embed/${ID}"`,
    );
    expect(html).not.toContain("<p>");
  });

  it.each([
    ["ID が 10 文字のとき", `https://youtu.be/${ID.slice(1)}`],
    ["ID が 12 文字のとき", `https://www.youtube.com/watch?v=${ID}x`],
    ["ID に使えない文字があるとき", "https://youtu.be/dQw4w9WgX~Q"],
    ["http の URL のとき", `http://youtu.be/${ID}`],
    ["YouTube 以外のホストのとき", `https://example.com/watch?v=${ID}`],
    ["watch 以外のパスのとき", `https://www.youtube.com/playlist?v=${ID}`],
    ["リンクの文字列が URL でないとき", `[動画](https://youtu.be/${ID})`],
    ["URL の後に文が続くとき", `https://youtu.be/${ID} を見る`],
    [
      "リンクの文字列で URL の後に装飾が続くとき",
      `[https://youtu.be/${ID}*x*](https://youtu.be/${ID})`,
    ],
    ["URL として読めないとき", `<https://youtu.be:99999/${ID}>`],
  ])("%s、段落をリンクのまま出す", (_label, markdown) => {
    const html = render(`${markdown}\n`);
    expect(html).toMatch(/^<p>.*<a href=/);
    expect(html).not.toContain("<iframe");
  });
});
