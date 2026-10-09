import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { AVATARS, buildAvatar } from "./avatars";

const OUT_DIR = fileURLToPath(new URL("../../src/assets/", import.meta.url));

const sourceDir = process.argv[2];
if (sourceDir === undefined) {
  console.error("usage: bun run import:avatars <directory with the v2.1 PNGs>");
  process.exit(2);
}
await mkdir(OUT_DIR, { recursive: true });
for (const spec of AVATARS) {
  const webp = await buildAvatar(join(sourceDir, `${spec.name}.png`), spec);
  await writeFile(join(OUT_DIR, `${spec.name}.webp`), webp);
  console.log(
    `${spec.name}.webp ${spec.width}x${spec.height} ${webp.length} bytes`,
  );
}
