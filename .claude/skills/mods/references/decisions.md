# Decisions

One entry per design decision made while building the mods here: what was
chosen, what it was chosen over, and the evidence. Append; do not rewrite
history. Reversing a decision is a new entry that names the one it reverses.

### 2026-10-15 — collapse-all is an AutoHotkey overlay, not a Claude Code mod
Asked for: a collapse-all icon in the title bar that collapses every
left-sidebar section. Chosen: AHK + UI Automation. Over: a Claude Code plugin.
Evidence: `claude-code.d.ts` lists what a mod can draw (Pane, AbovePrompt,
transcript rows, status line, toast) and none is the app's title bar or
sidebar; `mcp__ccd_sidebar__*` tools read sections but cannot collapse them; a
PowerShell UIA probe collapsed `skills` through its ExpandCollapse pattern in
172 ms.

### 2026-10-15 — the icon is drawn with GDI+, not a font glyph
Chosen: Lucide chevrons-down-up as two polylines. Over: Segoe Fluent Icons
`F165` (CollapseContent), which shipped first. Evidence: the person asked for
chevrons-down-up; a rendered sheet of 20 candidate glyphs had nothing like it.

### 2026-10-15 — 8× supersampled drawing
Chosen: draw at 8× with AntiAlias8x8, downscale with high-quality bilinear.
Over: 1× AntiAlias with pixel-offset Half, which measured "centred within
0.15 px" by bounding box. Evidence: the person saw the icon low in its hover
square; `aatest.log` scored 1× at centroid +0.16 px, vertical asymmetry 23 %,
and 8× at +0.02 px, 2 %.

### 2026-10-15 — show only while Claude is focused, maximised and the sidebar is shown
Chosen: three gates polled every 100 ms, the sidebar read from the toggle
button's `Hide sidebar` / `Show sidebar` label. Over: watching the `Sidebar`
group's rect. Evidence: the person asked for each gate in turn; the cached
label read costs 0.3 ms per tick and flipped correctly when the sidebar was
hidden and shown with `set_sidebar_collapsed`.

### 2026-10-16 — the overlay is launched by the person, with a Startup shortcut
Chosen: Explorer double-click, plus `shell:startup\Claude Collapse All.lnk`.
Over: launching from the session. Evidence: the icon vanished when Claude
restarted; every tool-launched copy sat in Claude's job object
(`IsProcessInJob` true); WMI `Win32_Process.Create` escaped it but is not a
route the person would repeat.

### 2026-10-16 — skills-pane lists SessionStart context under its own heading
Chosen: a second list, "Injected at session start", each entry named by its
first `# heading` or else its first line. Over: treating such context as a
skill. Evidence: `i-have-adhd` never raises `skill.prompt`; it is a plugin's
SessionStart hook (`~/.claude/plugins/cache/i-have-adhd/…/hooks/hooks.json`)
returning `additionalContext`.

### 2026-10-16 — the pane's toggle is a Client surface module
Chosen: `hooks/toggle.tsx`, drawing a Box and Text with hex colours and posting
`{ toggle: true }` on pointer up. Over: a `Button` with `variant` or coloured
child Text. Evidence: screenshots — `variant="primary"` drew a white pill;
coloured child Text drew a grey chip (`#383838` / `#E4E4BD`); the Client drew
blue on navy and the person confirmed it.

### 2026-10-16 — the toggle stays visible while the engine shows its survey
Chosen: render `await next(e)` (the survey band) as the first child above the
toggle. Over: `return next(e)` while `hasSurvey`, the example's pattern.
Evidence: the person asked for it to stay; the test `keeps the toggle while the
engine shows a survey` passes. Not yet seen drawn.

### 2026-10-16 — the command is /skills-pane
Chosen over `/skills`. Evidence: `/skills` typed in the desktop prompt opened
the app's Skills settings page and never reached the mod's `command.run`.

### 2026-10-16 — installed from this repo as a local marketplace
Chosen: `.claude-plugin/marketplace.json` at the repo root with
`"source": "./skills-pane"`, `plugin marketplace add <repo>`,
`plugin install skills-pane@claude-code-mods`. Over: a GitHub marketplace.
Evidence: `plugin list` shows `Read from: C:\Personal Programs\claude-code-mods\skills-pane`,
so edits need no reinstall, and nothing is pushed anywhere.
