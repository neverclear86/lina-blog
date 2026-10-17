import { describe, expect, it } from "vitest";
import {
  resolveTheme,
  THEME_SCRIPT,
  THEME_STORAGE_KEY,
  THEMES,
  type Theme,
  toggleTheme,
} from "./theme";

interface ScriptOptions {
  stored?: string | null;
  readThrows?: boolean;
}

/**
 * Runs `THEME_SCRIPT` against fake `document`, `localStorage` and `matchMedia`, and returns the
 * resulting `dataset.theme`. The parameter names shadow the globals, so the text that the page
 * carries is what runs. `matchMedia` throws when it is called: the script must not read the OS
 * setting.
 */
function runThemeScript({
  stored = null,
  readThrows = false,
}: ScriptOptions = {}) {
  const storage = new Map<string, string>();
  if (stored !== null) {
    storage.set(THEME_STORAGE_KEY, stored);
  }
  const documentElement = { dataset: {} as { theme?: string } };
  const localStorage = {
    getItem(key: string) {
      if (readThrows) {
        throw new DOMException("denied", "SecurityError");
      }
      return storage.get(key) ?? null;
    },
  };
  const matchMedia = () => {
    throw new Error("the script must not read the OS setting");
  };
  new Function("document", "localStorage", "matchMedia", THEME_SCRIPT)(
    { documentElement },
    localStorage,
    matchMedia,
  );
  return documentElement.dataset.theme;
}

const storedValues: (string | null)[] = [null, ...THEMES, "blue", ""];

describe("resolveTheme", () => {
  it("保存値が light ならライトを返す", () => {
    expect(resolveTheme("light")).toBe<Theme>("light");
  });

  it("保存値が dark ならダークを返す", () => {
    expect(resolveTheme("dark")).toBe<Theme>("dark");
  });

  it("保存値が無いとダークを返す", () => {
    expect(resolveTheme(null)).toBe<Theme>("dark");
  });

  it("保存値が light と dark 以外ならダークを返す", () => {
    expect(resolveTheme("blue")).toBe<Theme>("dark");
    expect(resolveTheme("")).toBe<Theme>("dark");
  });
});

describe("THEME_SCRIPT", () => {
  it("決定は resolveTheme と全ての保存値で一致する", () => {
    for (const stored of storedValues) {
      expect(runThemeScript({ stored }), JSON.stringify({ stored })).toBe(
        resolveTheme(stored),
      );
    }
  });

  it("保存値が無いとダークにする", () => {
    expect(runThemeScript()).toBe("dark");
  });

  it("light が保存されているとライトにする", () => {
    expect(runThemeScript({ stored: "light" })).toBe("light");
  });

  it("localStorage の読み取りが例外を投げてもダークにする", () => {
    expect(runThemeScript({ readThrows: true })).toBe("dark");
  });
});

describe("toggleTheme", () => {
  function fakeStorage() {
    const saved = new Map<string, string>();
    const storage = {
      setItem: (key: string, value: string) => {
        saved.set(key, value);
      },
    };
    return { saved, storage };
  }

  it("ライトのときはダークに切り替えて保存する", () => {
    const root: { dataset: { theme?: string } } = {
      dataset: { theme: "light" },
    };
    const { saved, storage } = fakeStorage();
    expect(toggleTheme(root, () => storage)).toBe("dark");
    expect(root.dataset.theme).toBe("dark");
    expect(saved.get(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("ダークのときはライトに切り替えて保存する", () => {
    const root: { dataset: { theme?: string } } = {
      dataset: { theme: "dark" },
    };
    const { saved, storage } = fakeStorage();
    expect(toggleTheme(root, () => storage)).toBe("light");
    expect(root.dataset.theme).toBe("light");
    expect(saved.get(THEME_STORAGE_KEY)).toBe("light");
  });

  it("data-theme が light と dark 以外ならダークに切り替える", () => {
    const root: { dataset: { theme?: string } } = { dataset: {} };
    const { saved, storage } = fakeStorage();
    expect(toggleTheme(root, () => storage)).toBe("dark");
    expect(root.dataset.theme).toBe("dark");
    expect(saved.get(THEME_STORAGE_KEY)).toBe("dark");
  });

  it("書き込みが例外を投げても切り替わる", () => {
    const root: { dataset: { theme?: string } } = {
      dataset: { theme: "light" },
    };
    const storage = {
      setItem: () => {
        throw new DOMException("full", "QuotaExceededError");
      },
    };
    expect(toggleTheme(root, () => storage)).toBe("dark");
    expect(root.dataset.theme).toBe("dark");
  });

  it("localStorage の取得が例外を投げても切り替わる", () => {
    const root: { dataset: { theme?: string } } = {
      dataset: { theme: "dark" },
    };
    const storage = () => {
      throw new DOMException("denied", "SecurityError");
    };
    expect(toggleTheme(root, storage)).toBe("light");
    expect(root.dataset.theme).toBe("light");
  });
});
