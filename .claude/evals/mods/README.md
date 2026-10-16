# Trigger eval for the `mods` skill

Checks that `.claude/skills/mods/SKILL.md`'s `description` makes Claude load the
skill for mod work in this repo, and not for near-misses.

- `trigger-eval.json`: 10 should-trigger queries and 10 near-misses.
- `run_eval.windows-isolated.py`: skill-creator's `run_eval.py` with three
  fixes (see its header). The stock script gives wrong scores on this machine.

Re-run it after any change to the description, such as one made while curating
the skill.

## Baseline

2026-10-16, `claude-opus-5-5`, 3 runs per query, the description as committed:
20/20 queries pass (60/60 runs), no false triggers.

## Running it

In Git Bash. About 3 minutes for one pass, at 8 workers.

1. Sign the bundled engine in once (it does not share the desktop app's
   sign-in), then check that `claude.exe auth status` says `"loggedIn": true`:

   ```
   "<engine dir>/claude.exe" auth login
   ```

   `<engine dir>` is the `AppData\Roaming\Claude\claude-code\<version>\<hash>`
   folder; `skills/mods/references/plugin-mods.md` section 1 shows how to find
   it.

2. Build a work folder outside the repo: skill-creator's scripts with the
   patched file in place, and a copy of the repo without the real skill (it
   would otherwise compete with the copy under test).

   ```
   SC="<skill-creator dir>"   # printed as its base directory when the skill loads
   W="<scratch dir>"
   R="C:/Personal Programs/claude-code-mods"
   mkdir -p "$W/sc" "$W/proj/.claude"
   cp -r "$SC/scripts" "$W/sc/scripts"
   cp "$R/.claude/evals/mods/run_eval.windows-isolated.py" "$W/sc/scripts/run_eval.py"
   cp -r "$R/README.md" "$R/collapse-all" "$R/skills-pane" "$R/.claude-plugin" "$W/proj/"
   ```

3. Run one pass from the project copy. `PYTHONUTF8=1` matters: SKILL.md has
   em dashes and Python's default here is cp1252.

   ```
   cd "$W/proj"
   PYTHONUTF8=1 PYTHONPATH="$W/sc" PATH="<engine dir>:$PATH" \
     py -3 -m scripts.run_eval \
     --eval-set "$R/.claude/evals/mods/trigger-eval.json" \
     --skill-path "$R/.claude/skills/mods" \
     --model claude-opus-5-5 --runs-per-query 3 --num-workers 8 --timeout 90 --verbose
   ```

   To let it propose a better description, run `scripts.run_loop` with the
   same arguments plus `--max-iterations 5 --results-dir "$W/results"`. It
   stops at iteration 1 when every train query already passes.

A model with no usage left answers every query with an error, which scores as
"not triggered"; try one `claude.exe -p "say ok" --model <id>` first.
