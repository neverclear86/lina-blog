#!/usr/bin/env python3
"""PreToolUse hook for Bash: denies force pushes that would update `main`.

Force pushes to other branches are allowed by `.claude/settings.json`, and the
issue workflow runs `git -C <worktree> push --force-with-lease` without a
refspec after a rebase. A permission rule cannot tell where such a push goes,
so this hook resolves the target:

- an explicit refspec whose destination is `main` (`main`, `x:main`,
  `+main`, `refs/heads/main`) is denied
- a push without a refspec is denied when the branch checked out in the
  directory (`-C <path>`, or the session's cwd) is `main`
- `--all` and `--mirror` are denied

A force push is `--force`, `--force-with-lease`, `--force-if-includes`, `-f`
(also inside combined short options), or a refspec starting with `+`.
Anything that is not a force push, or cannot be parsed, is left to the
permission rules.
"""

import json
import os
import re
import shlex
import subprocess
import sys

MAIN = "main"


def deny(reason: str) -> None:
    print(
        json.dumps(
            {
                "hookSpecificOutput": {
                    "hookEventName": "PreToolUse",
                    "permissionDecision": "deny",
                    "permissionDecisionReason": reason,
                }
            }
        )
    )
    sys.exit(0)


def current_branch(directory: str) -> str | None:
    result = subprocess.run(
        ["git", "-C", directory, "rev-parse", "--abbrev-ref", "HEAD"],
        capture_output=True,
        text=True,
    )
    return result.stdout.strip() if result.returncode == 0 else None


def destination(refspec: str) -> str:
    ref = refspec.lstrip("+")
    ref = ref.split(":", 1)[1] if ":" in ref else ref
    return ref.removeprefix("refs/heads/")


def check_push(words: list[str], default_dir: str) -> None:
    directory = default_dir
    i = 0
    # git [-C <path>] [other global options] push ...
    while i < len(words) and words[i] != "push":
        if words[i] == "-C" and i + 1 < len(words):
            path = words[i + 1]
            directory = path if os.path.isabs(path) else os.path.join(directory, path)
            i += 2
            continue
        i += 1
    if i >= len(words):
        return
    args = words[i + 1 :]

    force = False
    positionals = []
    for arg in args:
        if arg in ("--all", "--mirror"):
            if any(a.startswith(("--force", "-f")) or a.startswith("+") for a in args):
                deny(f"force push with {arg} can overwrite {MAIN}; push the branch explicitly")
        if arg.startswith("--force"):
            force = True
        elif re.fullmatch(r"-[A-Za-z]*f[A-Za-z]*", arg):
            force = True
        elif arg.startswith("-"):
            continue
        else:
            positionals.append(arg)

    refspecs = positionals[1:]
    if any(r.startswith("+") for r in refspecs):
        force = True
    if not force:
        return

    if refspecs:
        for refspec in refspecs:
            if destination(refspec) == MAIN:
                deny(f"force push to {MAIN} is not allowed ({refspec})")
        return

    branch = current_branch(directory)
    if branch == MAIN:
        deny(f"force push without a refspec from {directory}, which is on {MAIN}, is not allowed")


def main() -> None:
    try:
        command = json.load(sys.stdin).get("tool_input", {}).get("command", "")
    except (json.JSONDecodeError, AttributeError):
        return
    if "push" not in command:
        return
    default_dir = os.environ.get("CLAUDE_PROJECT_DIR") or os.getcwd()
    for segment in re.split(r"&&|\|\||;|\||\n", command):
        try:
            words = shlex.split(segment)
        except ValueError:
            continue
        # Skip leading env assignments and wrappers such as `env`, `timeout 60`.
        while words and (re.fullmatch(r"[A-Za-z_][A-Za-z0-9_]*=.*", words[0]) or words[0] in ("env", "command")):
            words = words[1:]
        if words and words[0] == "git":
            check_push(words[1:], default_dir)


if __name__ == "__main__":
    main()
