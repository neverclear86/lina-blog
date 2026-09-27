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
  prefersDark: boolean;
}

/**
 * Runs `THEME_SCRIPT` against fake `document`, `localStorage` and `matchMedia`. The parameter
 * names shadow the globals, so the text that the page carries is what runs.
 */
function runThemeScript({
  stored = null,
  readThrows = false,
  prefersDark,
}: ScriptOptions) {
  const storage = new Map<string, string>();
  if (stored !== null) {
    storage.set(THEME_STORAGE_KEY, stored);
  }
  const documentElement = { dataset: {} as { theme?: string } };
  const listeners: (() => void)[] = [];
  const media = {
    matches: prefersDark,
    addEventListener(type: string, listener: () => void) {
      if (type === "change") {
        listeners.push(listener);
      }
    },
  };
  const localStorage = {
    getItem(key: string) {
      if (readThrows) {
        throw new DOMException("denied", "SecurityError");
      }
      return storage.get(key) ?? null;
    },
  };
  const matchMedia = (query: string) => {
    expect(query).toBe("(prefers-color-scheme: dark)");
    return media;
  };
  new Function("document", "localStorage", "matchMedia", THEME_SCRIPT)(
    { documentElement },
    localStorage,
    matchMedia,
  );
  return {
    theme: () => documentElement.dataset.theme,
    save: (value: string) => {
      storage.set(THEME_STORAGE_KEY, value);
    },
    changeOs: (dark: boolean) => {
      media.matches = dark;
      for (const listener of listeners) {
        listener();
      }
    },
  };
}

const storedValues: (string | null)[] = [null, ...THEMES, "blue"];
const inputs = storedValues.flatMap((stored) =>
  [false, true].map((prefersDark) => ({ stored, prefersDark })),
);

describe("resolveTheme", () => {
  it("保存値が light か dark ならそれを返す", () => {
    for (const stored of THEMES) {
      expect(resolveTheme(stored, false)).toBe<Theme>(stored);
      expect(resolveTheme(stored, true)).toBe<Theme>(stored);
    }
  });

  it("保存値が無いと OS の設定に従う", () => {
    expect(resolveTheme(null, false)).toBe("light");
    expect(resolveTheme(null, true)).toBe("dark");
  });

  it("保存値が light と dark 以外なら OS の設定に従う", () => {
    expect(resolveTheme("blue", false)).toBe("light");
    expect(resolveTheme("", true)).toBe("dark");
  });
});

describe("THEME_SCRIPT", () => {
  it("最初の決定は resolveTheme と全ての入力で一致する", () => {
    for (const { stored, prefersDark } of inputs) {
      expect(
        runThemeScript({ stored, prefersDark }).theme(),
        JSON.stringify({ stored, prefersDark }),
      ).toBe(resolveTheme(stored, prefersDark));
    }
  });

  it("OS の設定の変更の後の決定は resolveTheme と全ての入力で一致する", () => {
    for (const { stored, prefersDark } of inputs) {
      const script = runThemeScript({ stored, prefersDark: !prefersDark });
      script.changeOs(prefersDark);
      expect(script.theme(), JSON.stringify({ stored, prefersDark })).toBe(
        resolveTheme(stored, prefersDark),
      );
    }
  });

  it("保存値が無い間は OS の設定の変更に追従する", () => {
    const script = runThemeScript({ prefersDark: false });
    expect(script.theme()).toBe("light");
    script.changeOs(true);
    expect(script.theme()).toBe("dark");
    script.changeOs(false);
    expect(script.theme()).toBe("light");
  });

  it("保存された後は OS の設定の変更に追従しない", () => {
    const script = runThemeScript({ prefersDark: false });
    script.save("light");
    script.changeOs(true);
    expect(script.theme()).toBe("light");
  });

  it("localStorage の読み取りが例外を投げても OS の設定で決まる", () => {
    expect(
      runThemeScript({ readThrows: true, prefersDark: true }).theme(),
    ).toBe("dark");
    expect(
      runThemeScript({ readThrows: true, prefersDark: false }).theme(),
    ).toBe("light");
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
