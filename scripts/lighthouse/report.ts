import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { type ManifestEntry, summaryMarkdown } from "./summary";

const manifestPath =
  process.argv[2] ??
  fileURLToPath(new URL("../../.lighthouseci/manifest.json", import.meta.url));

const manifest: ManifestEntry[] = JSON.parse(
  await readFile(manifestPath, "utf8"),
);
process.stdout.write(summaryMarkdown(manifest));
