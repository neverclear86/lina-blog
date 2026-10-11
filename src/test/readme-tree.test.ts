import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const ROOT = new URL("../../", import.meta.url);

/** The top-level directories that the tree of `README.md` covers. */
const COVERED = ["docs", "public", "scripts", "src", "workers"];

/**
 * The directories that the publishing Worker writes posts to. They hold files on `main` once a
 * post is published, so the tree names them even where they are empty.
 */
const WRITTEN_BY_THE_WORKER = ["src/content/blog"];

/**
 * Returns the lines of the tree under "Project Structure" in `README.md`, without the first line
 * (`/`) and the closing fence.
 */
function treeLines(): string[] {
  const readme = readFileSync(new URL("README.md", ROOT), "utf8");
  const tree = readme
    .split("## 🚀 Project Structure")[1]
    ?.split("```text\n")[1];
  return (tree?.split("```")[0] ?? "").split("\n").slice(1).filter(Boolean);
}

/**
 * Returns the entries of the tree: the name as written, and the path from the root of the
 * repository. A name is nested by its indent, four characters for each level.
 */
function treeEntries(): { name: string; path: string }[] {
  const parents: string[] = [];
  return treeLines().map((line) => {
    const row = line.match(/^((?:│ {3}| {4})*)(?:├── |└── )(\S+)(?: +# .+)?$/);
    if (!row) throw new Error(`Not a line of the tree: ${line}`);
    const depth = (row[1] ?? "").length / 4;
    parents.length = depth;
    parents[depth] = (row[2] ?? "").replace(/\/$/, "");
    return { name: row[2] ?? "", path: parents.join("/") };
  });
}

/**
 * Returns the directories under `COVERED` that hold a file, by path. Below `src/pages/<name>/` a
 * directory is a part of a URL and is left out.
 */
function directoriesWithFiles(): Set<string> {
  const files = execFileSync(
    "git",
    ["-c", "core.quotePath=false", "ls-files", "-co", "--exclude-standard"],
    {
      cwd: ROOT,
      encoding: "utf8",
    },
  )
    .split("\n")
    .filter(
      (file) =>
        file &&
        existsSync(
          new URL(
            file
              .replaceAll("%", "%25")
              .replaceAll("#", "%23")
              .replaceAll("?", "%3F"),
            ROOT,
          ),
        ),
    );
  const directories = new Set<string>(WRITTEN_BY_THE_WORKER);
  for (const file of files) {
    const parts = file.split("/").slice(0, -1);
    if (!COVERED.includes(parts[0] ?? "")) continue;
    for (let depth = 1; depth <= parts.length; depth++) {
      if (file.startsWith("src/pages/") && depth > 3) continue;
      directories.add(parts.slice(0, depth).join("/"));
    }
  }
  return directories;
}

describe("README の Project Structure の木", () => {
  it("木に載るのはディレクトリだけである", () => {
    const names = treeEntries().map((entry) => entry.name);
    expect(names.filter((name) => !name.endsWith("/"))).toEqual([]);
    expect(names.length).toBeGreaterThan(0);
  });

  it("木のディレクトリはすべてファイルを持つ", () => {
    const directories = directoriesWithFiles();
    const paths = treeEntries().map((entry) => entry.path);
    expect(paths.filter((path) => !directories.has(path))).toEqual([]);
  });

  it("ファイルを持つディレクトリはすべて木にある", () => {
    const paths = new Set(treeEntries().map((entry) => entry.path));
    expect(
      [...directoriesWithFiles()].filter((path) => !paths.has(path)),
    ).toEqual([]);
  });
});
