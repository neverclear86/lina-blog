import { describe, expect, it } from "vitest";
import { isCommandLineClient } from "./user-agent";

const CHROME =
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36";

describe("isCommandLineClient", () => {
  it("curl の User-Agent を判定する", () => {
    expect(isCommandLineClient("curl/8.22.0")).toBe(true);
  });

  it("Wget の User-Agent を判定する", () => {
    expect(isCommandLineClient("Wget/1.25.0")).toBe(true);
  });

  it("HTTPie の User-Agent を判定する", () => {
    expect(isCommandLineClient("HTTPie/3.2.4")).toBe(true);
  });

  it("xh の User-Agent を判定する", () => {
    expect(isCommandLineClient("xh/0.26.2")).toBe(true);
  });

  it("製品名の大文字と小文字を区別しない", () => {
    expect(isCommandLineClient("CURL/8.22.0")).toBe(true);
  });

  it("版の無い製品名だけの User-Agent も判定する", () => {
    expect(isCommandLineClient("curl")).toBe(true);
  });

  it("製品名が一覧の名前で始まるだけのクライアントは判定しない", () => {
    expect(isCommandLineClient("curlx/1.0")).toBe(false);
  });

  it("2 つ目以降の製品に一覧の名前があっても判定しない", () => {
    expect(isCommandLineClient("PycURL/7.45.3 libcurl/8.5.0")).toBe(false);
  });

  it("ブラウザの User-Agent は判定しない", () => {
    expect(isCommandLineClient(CHROME)).toBe(false);
  });

  it("User-Agent が無いときは判定しない", () => {
    expect(isCommandLineClient(undefined)).toBe(false);
  });

  it("User-Agent が空のときは判定しない", () => {
    expect(isCommandLineClient("")).toBe(false);
  });
});
