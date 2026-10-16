---
name: mods
description: Field notes for building mods for the Claude desktop app and Claude Code in this repo — Claude Code plugins (hooks modules, panes, the band above the prompt, Client surface modules, the test kit, install from this repo as a local marketplace) and AutoHotkey overlays that reach what plugins can't (title bar, sidebar) through Windows UI Automation. Use it for any task that touches a mod, plugin, hook, pane, overlay, the collapse-all or skills-pane folders, the Claude desktop's title bar or sidebar, `claude plugin validate/test/install`, or AutoHotkey against the Claude window, and read it before trusting plugin-authoring's types: it holds what those docs don't say and what was found by trial. Also use when asked to correct, update or curate this skill itself.
---

# mods

What building the mods in this repo taught us, so the next session does not pay
for it again. `plugin-authoring` (bundled with Claude Code) is the API reference;
this is the field manual: what the desktop app will and won't let a mod do, which
route fits which ask, the commands that actually run on this machine, and the
traps that each cost a turn or more.

## Read first

| File | Read it for |
| --- | --- |
| `references/learned.md` | What went wrong since the body was last curated. Read it before starting; where it disagrees with anything below, it wins. |
| `references/plugin-mods.md` | Claude Code plugin findings: what the desktop draws, the rules the engine enforces on a hooks module, test-kit stand-ins, hot reload, install from this repo. |
| `references/ahk-overlay.md` | AutoHotkey overlay findings: raw UIA over ComCall, the overlay window flags, GDI+ icon drawing, launching and debugging from a tool, verifying by pixels. |
| `references/desktop-ui-tree.md` | The Claude desktop's accessibility tree as measured: labels, positions, colours. A dated snapshot; re-probe after an app update. |
| `references/decisions.md` | Why each mod is shaped the way it is, one entry per decision. |

## Pick the route

Two kinds of mod live here, and the first question on any ask is which one it
needs.

**A Claude Code plugin** (`skills-pane/`) runs inside the session's engine. It
can draw a pane (the desktop docks it as its own panel in the right-hand column,
above Files), a band above the prompt, custom transcript rows; register a slash
command; hook tool calls, prompts, skill loads and the classic settings-hook
events. It cannot touch anything the desktop app draws itself: the title bar,
the left sidebar, the session-rail cards (Environment, Context, Connectors,
Changes), the Files panel. An ask for a card "in the right pane" or an icon "in
the title bar" is an ask for the AutoHotkey route, and it is kinder to say so in
the first reply than after a prototype.

**An AutoHotkey overlay** (`collapse-all/`) is a separate always-on-top window
that reads the app through Windows UI Automation and floats a control over it.
It reaches anything UIA exposes, but it is its own process, knows nothing about
the session, and breaks when the app relabels a button.

Say which you chose and why in one line, then read the matching reference. Where
an ask spans both (a pane, plus a title-bar icon to open it), say that the icon
half is AHK and the pane half is a plugin, and that the two only meet through
what UIA can see.

## Plugin workflow

The order that worked. The reasons and the exact commands are in
`references/plugin-mods.md`.

1. Load `plugin-authoring` with the Skill tool. That writes this build's
   `claude-code.d.ts` and starts the hot-reload watch on
   `~/.claude/dev-mods/<session>/`. Grep the types file for the event or element
   at hand rather than guessing props; grep `reference.md` for the workflow.
2. Write the mod under `~/.claude/dev-mods/<session>/<name>/`:
   `.claude-plugin/plugin.json` (with `author`, or validate warns),
   `hooks/hooks.json`, `hooks/register.tsx`, and `types/index.d.ts` when
   `$.state` is used. Spell every engine-interface parameter `$` and make every
   helper that takes it a top-level function in the same file; the loader
   refuses anything else, and tsc does not catch it.
3. Validate, type-check, test, in that order, with the binary and the `tsc`
   named in the reference (neither `claude` nor `tsc` is on PATH here). Each
   catches something the other two pass. Every `$.x.y` the hooks call needs a
   stand-in beneath it in a test.
4. The person answers the hot-reload question; the mod loads when the turn ends,
   and each later edit reloads at the end of the turn that made it. You cannot
   see the desktop from inside the session: ask the person what they see, or use
   the diagnostics in the reference. Do not synthesize clicks into the Claude
   window to find out.
5. To keep it: copy it into this repo, list it in `.claude-plugin/marketplace.json`,
   `claude plugin marketplace add <repo>` then `claude plugin install
   <name>@claude-code-mods`. It then runs straight from the repo folder. Delete
   the dev copy only after that, and only if you are done looking at it: deleting
   it unloads the mod from the running session at once.

## AHK workflow

1. Probe before building. A throwaway script that walks the UIA tree and logs
   names, control types, rects and ExpandCollapse states to a file beside it
   (`FileAppend`, never stdout: a tool-launched AHK has no console, and its error
   dialogs block invisibly). Wait for the tree; Chromium exposes it only after
   the first ask.
2. Build on `collapse-all/ClaudeSidebar.ahk`. The raw UIA plumbing is there and
   its vtable indices are verified. Add a finder for the new element beside
   `ForwardRect` and `Toggle`; keep the overlay in its own file as
   `CollapseButton.ahk` is, so a test script can draw it off to one side.
3. Launch for testing with `Start-Process` and read a log file. Never
   `-RedirectStandardError` on a long-running script (it locks the file). A
   script that runs long is probably sitting on an error dialog: find it with
   UIA on the AHK pid.
4. Verify by screenshot and pixel measurement, not by eye: the reference has the
   capture and centroid recipe. Measure the native control first so the target is
   a number. When the person says it looks wrong and the check says it is right,
   the check is wrong.
5. Hand the final launch to the person (double-click in Explorer, or a Startup
   shortcut). Anything started from a Claude Code tool joins Claude's job object
   and dies with the app.

## Known gaps

- The desktop's light theme is unmeasured. Every colour in
  `desktop-ui-tree.md` is the dark theme's, and the skills-pane toggle hard-codes
  two of them.
- Why a synthesized `mouse_event` click on a mod's band toggle opened the app's
  Settings dialog is unexplained. It happened once; the person's real click
  worked. Until someone finds out, scripted clicks into the Claude window count
  as unreliable.
- Whether `/reload-plugins` runs from the desktop's prompt is unconfirmed. A new
  session definitely loads an installed mod.
- No mod has been drawn on the terminal or VS Code surfaces here. The `Client`
  fallback to a `Button` on other surfaces passes `claude plugin test` and has
  never been seen.
- `prompt.compose` was used once to pipe diagnostics into the system prompt and
  then removed; it worked, but whether such a section survives compaction is
  unknown.

Closing a gap is a result: say what closed it and delete the entry.

## Improving this skill

Two sinks, and they are not interchangeable.

**Domain findings** — what the desktop app draws or refuses, a UIA label or
position, a test-kit rule, a `claude plugin` command's behaviour, a GDI+ or AHK
trap — go to the matching file in `references/` (`plugin-mods.md`,
`ahk-overlay.md`, `desktop-ui-tree.md`). A durable trap also gets one line in
the workflow above, at the step where it bites. A measurement that replaces an
older one carries its date and the app version: the tree file is a snapshot of
one build, so "measured 2026-11-02 on 2.43" beside the new value, never a quiet
overwrite.

**Procedural findings** — a workflow step here that misled, an order of steps
that cost a turn, a command that no longer runs on this machine, a reference
that disagreed with what happened — belong to this skill. Capture those in the
log rather than editing this file mid-build.

**Where it goes.** Append to `references/learned.md`. Never rewrite the body of
SKILL.md while building a mod: you have one session's evidence, the entry might
be wrong, and an uncurated file drifts fast.

**What to log.** Only these four, and only once the evidence exists:

- A step here failed in practice: validate, type-check or test refused something
  this skill said would pass; a launch route this skill names ended up inside
  Claude's job; a UIA label this skill names was not there.
- The person corrected something this skill told you.
- You had to derive something this skill should have carried: a vtable index, a
  pattern IID, the result shape a test stand-in must return, where the desktop
  seats a component.
- A verification this skill recommends passed and the person still saw it
  wrong. This skill's worst failure was exactly that: "centred within 0.15 px"
  by bounding box while the icon sat visibly low, and "6 tests pass" while the
  pane had never been drawn. When a check and a person disagree, the gap between
  them is the finding.

**What not to log.** Domain findings; those go to the reference files above.
Hypotheses you did not test: an entry starts with what happened, not with what
might. Nothing from other repos or employer systems: this skill describes this
repo's mods and the Claude desktop, nothing else.

**Design records.** A decision made while building — Client over Button, 8×
supersampling, a launch route — is not a correction. It goes to
`references/decisions.md`, one entry per decision: what was chosen, what it was
chosen over, and the evidence. Reversing one is a new entry naming the old.

**Entry format.** Terse, dated, evidenced. Use `###` for entries:

    ### 2026-10-16 — one-line claim
    What the skill says, and what actually happened.
    Evidence: the command, file, screenshot or test that proves it.
    Proposed: the specific edit, naming the file it belongs in.

When an entry overturns an earlier one, open it with `Supersedes: <date> —
<claim>` and add `Superseded by <date>.` under the earlier heading. Curation
folds the later entry and drops both.

**Curation.** When asked, when the log passes ~20 entries or ~150 lines, when
its oldest entry is three weeks old, or once it is longer than this file: read
`references/learned.md`, fold each confirmed entry into the section where
someone would look for it, drop anything stale or since contradicted, and clear
the log. Keep this file under ~500 lines; detail goes to `references/`. If
curation changes the `description`, re-run the trigger eval in `.claude/evals/mods/`
(its README has the command and the baseline) and keep the change only if it
still passes.

**The gate.** Curation edits this file and the mods' own code, so it is a change
like any other: make it on a branch, show the diff, say what evidence drove each
line, and do not commit unless asked. A confirmed measurement goes straight into
`desktop-ui-tree.md` with its date and needs no branch; appending to the log is
cheap and needs no ceremony.

**Confirmed, not suspected.** "The desktop ignores `color` on a Button's child
Text" is a fact: the code set blue and the screenshot showed a grey chip. "The
desktop probably ignores `borderColor` on a Box too" is a hypothesis and belongs
in Known gaps until a screenshot settles it. This skill exists because the API's
types were read as facts about the desktop when they were facts about the
engine; the log must not repeat that.
