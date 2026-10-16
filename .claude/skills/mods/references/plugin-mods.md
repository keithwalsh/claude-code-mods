# Claude Code plugin ("mod") findings

Found building `skills-pane/` on Claude Code 2.1.295–2.1.299 inside the Claude
desktop app 2.37–2.42, Windows 11, October 2026. The working code is the
evidence; this file says what it does not and why it is shaped that way.

Contents:
1. [Tools on this machine](#1-tools-on-this-machine)
2. [What the desktop draws for a mod](#2-what-the-desktop-draws-for-a-mod)
3. [Rules the engine enforces on a hooks module](#3-rules-the-engine-enforces-on-a-hooks-module)
4. [Reading the session](#4-reading-the-session)
5. [Testing with `claude plugin test`](#5-testing-with-claude-plugin-test)
6. [Hot reload and the running session](#6-hot-reload-and-the-running-session)
7. [Installing from this repo](#7-installing-from-this-repo)
8. [Diagnosing a mod you cannot see](#8-diagnosing-a-mod-you-cannot-see)

## 1. Tools on this machine

- `claude` is not on PATH. The desktop app's bundled engine runs every
  `claude plugin …` command:
  `C:\Users\keith\AppData\Roaming\Claude\claude-code\<version>\<hash>\claude.exe`.
  Find the current one with
  `Get-CimInstance Win32_Process -Filter "Name='claude.exe'" | Select-Object -ExpandProperty ExecutablePath -Unique`
  and take the `AppData\Roaming` one, not the `WindowsApps` app shell. From bash,
  wrap it in `timeout 120`; validate takes a few seconds, test under a second.
- No global `tsc`. TypeScript 5.8.3 lives in
  `C:\Personal Programs\ahk2-mcp\node_modules\typescript\bin\tsc` (also in other
  projects' `node_modules`). Run it as `node <tsc> -p <tsconfig>`.
- Before the mod has loaded once, type-check with a tsconfig kept outside the
  mod folder (the session scratchpad is fine): the `compilerOptions` from the
  header of `claude-code.d.ts` (`target`/`lib` es2023, `types: []`, `jsx: react`,
  `jsxFactory: h`, `jsxFragmentFactory: Fragment`, strict), and `include`
  listing the skill's `types/claude-code.d.ts`, the mod's `hooks` and `types`.
  Once loaded, the engine writes `<mod>/.claude-plugin/types/` and a one-line
  tsconfig that extends `./.claude-plugin/types/tsconfig.json` works from the
  mod folder.
- `python` resolves to the Microsoft Store stub; use `py`, PowerShell or node
  for scripting.

## 2. What the desktop draws for a mod

- **Pane**: docked as its own titled panel in the right-hand column, with
  expand and close marks, stacked above the Files panel when that is open.
  `e.props.placement` is `dock`, `e.surface` is `desktop`. Opening it from
  `session.start` placed it (`isPlaced: true`, surfaces `['desktop']`) even in a
  session the desktop had attached after start; the `session.attach` re-open in
  `register.tsx` is belt and braces.
- **AbovePrompt**: a band directly above the composer, full width. The engine's
  own content there (the "How is Claude doing this session?" survey) is what
  `next(e)` returns while `e.props.hasSurvey`; render it as the first child of a
  column Box to keep both. Returning `next(e)` instead hides your band while
  the survey shows.
- **Button** on the desktop is native: a grey chip (`#383838` bg, `#E4E4BD`
  text), a white pill for `variant="primary"`, dim for `dimColor`. It ignores
  `color` and `backgroundColor` on a child `Text`, and `hover`. For any custom
  colour use a `Client` surface module (`hooks/toggle.tsx`): `Box
  backgroundColor` and `Text color` with hex strings are honoured there. Theme
  keys (`suggestion`, `claude`, `permission`…) exist but none is the title bar's
  active-panel blue.
- **Client** pointer events arrive as `enter`/`leave`/`down`/`move`/`up` in
  region cells; after a `down` the instance holds the pointer to the `up`.
  `surface.post(data)` raises `ui.message` with `e.element` set to the Client's
  key, and the hook's `{}` answer leaves props as they were; the next redraw
  hands new props.
- **Slash commands**: the desktop answers `/skills` itself (it opens the Skills
  settings page) and never passes it to a mod's `command.run`. Pick a name the
  app does not own; `/skills-pane` reached the mod.
- Nothing a mod draws reaches the title bar, the left sidebar, the session-rail
  cards or the Files panel.

## 3. Rules the engine enforces on a hooks module

Each of these was found by hitting it. `claude plugin validate` reports some;
the loader refuses the rest at load, and `claude plugin test` then fails every
test with "hooks module did not load".

- Spell the engine interface `$`, always. A hook parameter named `hook$` makes
  every call on it "refused: its hooks module does not call it": the loader
  scans the source for `$.noun.event(` literally.
- A helper that takes `$` must be a function declaration or a `const` arrow at
  the top level of the same file, or imported from a file of the mod. A curried
  factory (`const addTo = list => ($, names) => …`) fails with "$ is passed to
  addTo, which is not a function declared at the top of this file".
- `types/index.d.ts` exports types and nothing else; `export {}` is refused
  ("a contract exports types and nothing else"). Declare state as
  `interface PluginState { '<mod>': { key: Type } }` inside
  `declare module 'claude-code'`, and name the file in `plugin.json` as `types`.
- A mod's own `$.ui.close` does not pass through its own `ui.close` hook, so a
  flag that hook sets never updates for a close the mod made. Set it beside the
  call (`closePane` in `register.tsx`).
- A `ui.close` hook returns what `next(e)` returned (an `OpEventResult`), not
  void. tsc catches this; validate and the runtime did not.
- Validate's `gating hook without .catch: command.run{…}` line is
  informational. `✔ Validation passed with warnings` loads.
- Validate warns without `author` in `plugin.json`, and without `description`
  in a marketplace file.

## 4. Reading the session

- Skills loaded so far: read `$.session.messages({ as: 'api' })`, not the rows.
  Three shapes (measured 2026-10-16 on 2.1.295): a `tool_use` block named
  `Skill` (skip it when its `tool_result` has `is_error`); a user text with
  `<command-message>name</command-message>` then `<command-name>/name</command-name>`
  for a typed skill (a built-in like `/compact` puts `<command-name>` first);
  and, after a compaction, `### Skill: name` over `Path: …`. The rows form drops
  what a compaction kept and the harness's own loads (`<skill-format>true`).
- `skill.prompt` fires on every skill load after that (`/name`, the Skill tool,
  a subagent preload). Hook it and return `next(e)` to pass the text through.
- Context from SessionStart hooks (i-have-adhd and the like) never raises
  `skill.prompt`: it is a classic settings or plugin hook returning
  `additionalContext`. Hook `classic.SessionStart`, `await next(e)`, and read
  `result.additionalContext`, one string per hook that answered. For a mod
  loaded mid-session, backfill from `$.session.messages({ as: 'api' })`: user
  text blocks hold
  `<system-reminder>SessionStart:<source> hook success: <text></system-reminder>`.
- `$.session.surfaces()` lists what is attached (`['desktop']` here);
  `$.ui.panes()` says per pane whether it is placed and shown.
- The transcript on disk is
  `~/.claude/projects/<cwd-slug>/<session-id>.jsonl`. Rows with
  `attachment.type === 'hook_success'` carry a hook's output; a mod that failed
  to load gets a line naming it. Useful when the mod cannot log for itself.

## 5. Testing with `claude plugin test`

- Nothing sits beneath the mod in a test. Every event the mod raises must be
  answered by a stand-in `on(...)` in the test, or the run fails with "no
  implementation for <event>: a test answers it with on('<event>', ...)".
  Shapes that worked: `session.start` → `{ cwd: e.cwd }`; `session.messages` →
  `{ value: rows }` (branch on `e?.as === 'api'` for the API form);
  `command.register` → `{ value: { command } }`; `ui.open` → `{ value: { isPlaced: true } }`;
  `ui.close` → `{ value: undefined }`; `skill.prompt` → `{ text: e.text }`; the
  engine's own AbovePrompt band → a `ui.render` hook returning `<Box />`.
- A test's own hooks cannot call `$` (the same "does not call it" refusal), and
  `$.ui.close` is not on the test engine; only hook-reachable events are. The
  mod's close path is reached by driving its own UI: pointer events on a
  Client, `press` on a Button.
- `band.find({ in: key })` scopes to a `Client` only ("the drawing holds no
  Client keyed …" otherwise). For a Button, find by `type` and `text` without
  `in`.
- A click on a Client: `band.pointer({ type: 'down', x, y, button: 'left', in: key })`
  then the same with `'up'`. `surface.columns` is 0 in a test (never measured),
  so an inside-the-region check must treat 0×0 as inside.
- JSX in a test means the file is `.test.tsx`. Type helper parameters with
  `Engine` from `'claude-code/testing'`.
- Run all three, in this order: `plugin validate` → `tsc` → `plugin test`.
  Validate passed code tsc rejected (void from `ui.close`); tsc passed code the
  loader refused (`hook$`); the test run is what proves the module loads.
- `$.classic.SessionStart({ source: 'startup' })` raises the classic event with
  the envelope stamped; a stand-in `on('classic.SessionStart', …)` beneath
  returns `{ additionalContext: [...] }`.

## 6. Hot reload and the running session

- Deleting the mod's folder under `~/.claude/dev-mods/<session>/` unloads it
  from the running session at once: pane, band and command all vanish, and the
  person sees their pane disappear mid-conversation. Copy to the repo and
  install first; delete the dev copy last, if at all.
- An installed user-scope mod loads at session start. It did not appear in the
  already-running session after `plugin install`; `/reload-plugins` is the
  documented way (unconfirmed from the desktop prompt).
- A reload runs `register` again: module-level variables reset, `$.state` keeps
  its values across reloads. A new process does not: `$.state` starts empty.
  The desktop stops an idle session's engine and starts it again with
  `--resume` when needed, with no SessionStart:resume line in the transcript, so
  anything a pane lists must be rebuildable from the conversation at
  `session.start`. Verified: a probe's atom read `[]` after `-p --resume`.
- The transcript carries one dim line per reload naming the mod and its hooks
  (`skills-pane reloaded (7 hooks: …)`), and one per hook that failed.

## 7. Installing from this repo

`.claude-plugin/marketplace.json` at the repo root lists each mod with
`"source": "./<folder>"`. Then, with the bundled binary:

```
claude plugin marketplace add "C:\Personal Programs\claude-code-mods"
claude plugin install <name>@claude-code-mods
```

`claude plugin list` then shows `Read from: C:\Personal Programs\claude-code-mods\<folder>`
and `Scope: user`: the session runs the repo folder itself, so an edit reaches
new sessions with no reinstall. `plugin validate <repo>` reads the marketplace
file too and suggests the README install line. Nothing is pushed anywhere; a
GitHub marketplace is a separate, later step the `plugin-authoring` reference
describes.

## 8. Diagnosing a mod you cannot see

The session has no eyes on the desktop. What worked, cheapest first:

- `$.fs.write` to the session scratchpad from any hook; read it with Bash. No
  file means the hook never ran, or the mod did not load: check the transcript
  for the reload line.
- A `prompt.compose` hook that appends
  `{ id: '<mod>:diag', text, scope: 'session' }` to `next(e)`'s sections: the
  diagnostics arrive in the model's own system prompt next turn. Remove it
  before shipping.
- A UIA walk from AHK or PowerShell finds a pane's text in the app's tree with
  its screen position (`findpane.ahk` pattern, see `ahk-overlay.md`), and
  `PrintWindow(hwnd, hdc, 2)` captures the window even when covered.
- Ask the person. Their screenshot settles "does it look right" faster than any
  of the above, and the question box does not disturb the pane.
