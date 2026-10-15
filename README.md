# claude-code-mods

Tweaks to the Claude desktop app on Windows.

## collapse-all

Adds a "collapse all" icon to the title bar, just right of the Forward arrow.
Clicking it collapses every section in the Code tab's sidebar (Pinned, Recents and
each custom group).

Run it:

```
"C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe" "collapse-all\CollapseAll.ahk"
```

To start it at login, put a shortcut to `collapse-all\CollapseAll.ahk` in
`shell:startup`. To stop it, right-click the green "H" tray icon and choose Exit.

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
  sidebar toggle's "Hide sidebar" / "Show sidebar" label), and it takes its colours from the title bar, so it
  works with light and dark themes. `CollapseAll.ahk` is the entry point.

### Limits

- It needs 64-bit AutoHotkey v2. On Windows 10 the hover square has square corners.
- It depends on the app's accessibility labels (`Forward`, `Hide sidebar`,
  `Show sidebar`, `Sidebar`, `More options for …`). An app update that renames them will break it.
- While Claude is focused, the app's accessibility tree stays switched on, which
  costs Chromium a little CPU.
