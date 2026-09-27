import { existsSync } from "node:fs";
import type { AstroIntegration } from "astro";
import { describe, expect, it } from "vitest";
import { devPages, devPagesEnabled } from "./dev-pages";

type ConfigSetupOptions = Parameters<
  NonNullable<AstroIntegration["hooks"]["astro:config:setup"]>
>[0];

interface InjectedRoute {
  pattern: string;
  entrypoint: string | URL;
}

/** Runs the integration's `astro:config:setup` for `command` and returns the injected routes. */
function injectedRoutes(
  command: string,
  env: Record<string, string | undefined>,
): InjectedRoute[] {
  const routes: InjectedRoute[] = [];
  const setup = devPages(env).hooks["astro:config:setup"];
  setup?.({
    command,
    injectRoute: (route: InjectedRoute) => routes.push(route),
  } as unknown as ConfigSetupOptions);
  return routes;
}

describe("devPagesEnabled", () => {
  it("astro dev では環境変数に依らず有効になる", () => {
    expect(devPagesEnabled("dev", {})).toBe(true);
    expect(devPagesEnabled("dev", { LINA_DEV_PAGES: "0" })).toBe(true);
  });

  it("astro dev 以外では LINA_DEV_PAGES が 1 のときだけ有効になる", () => {
    expect(devPagesEnabled("build", {})).toBe(false);
    expect(devPagesEnabled("build", { LINA_DEV_PAGES: "1" })).toBe(true);
    expect(devPagesEnabled("build", { LINA_DEV_PAGES: "0" })).toBe(false);
    expect(devPagesEnabled("preview", {})).toBe(false);
  });
});

describe("devPages", () => {
  it("有効なとき /dev/components と /dev/markdown に src/dev/ の .astro を足す", () => {
    const routes = injectedRoutes("dev", {});
    expect(routes.map((route) => route.pattern)).toEqual([
      "/dev/components",
      "/dev/markdown",
    ]);
    for (const route of routes) {
      expect(existsSync(route.entrypoint)).toBe(true);
    }
  });

  it("astro build で LINA_DEV_PAGES が無いときルートを足さない", () => {
    expect(injectedRoutes("build", {})).toEqual([]);
  });
});
