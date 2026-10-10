/**
 * Entry of `bun run sync`: prints the report of `syncCommand` as JSON on stdout and exits with
 * its code.
 */

import { syncCommand } from "./run";

const { output, exitCode } = await syncCommand(
  process.argv.slice(2),
  process.env,
);
process.stdout.write(output);
process.exitCode = exitCode;
