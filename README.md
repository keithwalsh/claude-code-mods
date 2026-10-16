# claude-code-mods

Tweaks to the Claude desktop app on Windows: `collapse-all`, an AutoHotkey
overlay, and `skills-pane`, a Claude Code plugin.

## collapse-all

Adds a "collapse all" icon to the title bar, just right of the Forward arrow.
Clicking it collapses every section in the Code tab's sidebar (Pinned, Recents and
each custom group).

Run it by double-clicking `collapse-all\CollapseAll.ahk` in Explorer. To start it
at login, put a shortcut to that file in `shell:startup`. To stop it, right-click
the green "H" tray icon and choose Exit.

Don't start it from a terminal inside Claude (or from a Claude Code session):
it then belongs to Claude's process tree and closes when Claude does.

### How it works

- It's not a Claude Code plugin. Plugins draw only inside a session (panes, the
  band above the prompt, the transcript) and can't reach the app's title bar or
  sidebar.
- `ClaudeSidebar.ahk` reads the app through Windows UI Automation. Section headers
  are the expand/collapse buttons in the `Sidebar` group, and each one is collapsed
  through its ExpandCollapse pattern.
- `CollapseButton.ahk` draws a small always-on-top window (it never takes focus)
  over the title bar, with Lucide's chevrons-down-up icon drawn in GDI+. It shows
  only while Claude is focused, maximised and showing its sidebar (it reads the
  sidebar toggle's "Hide sidebar" / "Show sidebar" label), and it takes its
  colours from the title bar, so it works with light and dark themes.
  `CollapseAll.ahk` is the entry point.

### Limits

- It needs 64-bit AutoHotkey v2. On Windows 10 the hover square has square corners.
- It depends on the app's accessibility labels (`Forward`, `Hide sidebar`,
  `Show sidebar`, `Sidebar`, `More options for …`). An app update that renames them will break it.
- While Claude is focused, the app's accessibility tree stays switched on, which
  costs Chromium a little CPU.

## skills-pane

A Claude Code plugin that opens a **Skills** pane listing the skills loaded in
the session. Under "Injected at session start" it also lists context that
SessionStart hooks added (such as i-have-adhd, which never loads as a skill). In
the desktop app the pane docks on the right. A **Skills** toggle above the prompt
opens and closes it: lit blue while the pane is open, dimmed while it's closed.
`/skills-pane` opens it too (`/skills` is taken by the desktop app).

Install it from a terminal, using this folder as a local marketplace:

```
claude plugin marketplace add "C:\Personal Programs\claude-code-mods"
claude plugin install skills-pane@claude-code-mods
```

The plugin runs straight from `skills-pane/`, so an edit there reaches new
sessions with no reinstall (`/reload-plugins` picks it up in a running terminal
session).

### How it works

- `skill.prompt` fires on every skill load (`/name`, the Skill tool, or preloaded
  into a subagent). Skills loaded before the plugin are read back from the
  conversation: Skill tool calls, skills typed as `/name`, and skills a
  compaction kept. This is also what refills the list when the desktop restarts
  an idle session's engine, which empties it.
- `classic.SessionStart` sits above the settings and plugin hooks, so it sees the
  context they return. Each entry is named by its first `# heading`, else its
  first line.
- The toggle is a `Client` (`hooks/toggle.tsx`) rather than a `Button`, because
  the desktop draws its own native buttons and ignores colours set on them.

### Limits

- The toggle's blue (`#3A9AEC` on `#032042`) was sampled from the dark theme's
  Files icon; it doesn't follow a light theme.
- Where an organization manages Claude Code, `skill.prompt` and
  `classic.SessionStart` run only for plugins it lists in managed settings.
