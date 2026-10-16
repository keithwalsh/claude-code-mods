# Claude desktop: the accessibility tree as measured

Measured 2026-10-15 and 2026-10-16 on Claude desktop 2.37337 → 2.42304 (Code
tab), Windows 11, 1920×1080 at 100 %, window maximised (`WinGetPos` −8,−8
1936×1036), dark theme. A snapshot of one build: after an app update, re-probe
before trusting a label or a pixel, and record a changed value as a dated line
beside the old one, not a silent overwrite.

## Window

- Main window: class `Chrome_WidgetWin_1`, process `claude.exe` under
  `C:\Program Files\WindowsApps\Claude_<version>…\app\`, title `Claude`. Match it
  with `WinExist("Claude ahk_exe claude.exe ahk_class Chrome_WidgetWin_1")`.
- The Claude Code engine behind the Code tab is a second `claude.exe` under
  `AppData\Roaming\Claude\claude-code\<version>\<hash>\`.
- Document root `RootWebArea`, named `<session title> - Claude Code`.

## Title bar (y = 5, h = 35, left to right)

| Name | Type | Rect | Notes |
| --- | --- | --- | --- |
| Menu | Button | 15,5 35×35 | |
| Hide sidebar / Show sidebar | Button | 55,5 35×35 | The label flips with the sidebar: the one reliable "is it shown" signal found |
| Back | Button | 95,5 35×35 | |
| Forward | Button | 132,5 36×35 | The anchor the collapse-all overlay sits beside |
| Hide session rail, Terminal, Changes, Browser, Files, View options | Button | from 1502,6, each ~33×33 | Right-hand group; Files is lit while its panel is open |
| Minimise, Restore, Close | Button | 1749–1863,0 ~58×45 | Native |

Native icons: ~16×15 px, ~1.6 px stroke, `#F0EFEC` on `#111111`.

## Left sidebar

- Two Groups named `Sidebar`: a small one at 252,5 88×35 (the chat/code
  switch) and the real one at 0,0 350×1020. Hidden, the real one reports −5,269
  349×751 and holds no section headers.
- Section headers (`Pinned`, each custom group, `Recents`): `Button`, empty
  AutomationId, ExpandCollapse pattern available, inside the `Sidebar` group.
  State 1 expanded, 0 collapsed. `Collapse()` on the pattern works and the app
  repaints at once.
- Also expandable Buttons in that group, to filter out when collecting headers:
  `More options for <session title>` on each row, `Group and sort` under each
  header, `New from a template`, `More navigation items`, the account button
  (`<account name> <plan>`). `Create project` is a plain Button with a LeafNode state.
- Header names can carry a status suffix at times: `Pinned Running`,
  `Recents Unread response`. Match on prefix.
- Session rows: `<title>` Button, with `New session in <group>, added to <group>`
  beside a group header.

## Session view

- `Primary pane` Group at 280,36 1086×684 holds the transcript and composer.
- A mod's docked pane sits in the right column at x ≈ 1013: its title Text
  (`Skills` at 1013,48 32×17), a Group for its body at 1017,85, the body's Text
  rows beneath. The Files panel, when open, stacks below it at y ≈ 389. Each has
  an expand mark and a close mark.
- A mod's band above the prompt sits directly over the composer; a `Client`'s
  text in it was at 443,596 in a 1366×720 window. The "How is Claude doing this
  session?" survey shares that band.
- Transcript rows scrolled off the top have negative y; `Load earlier messages`
  is a 3×2 Button far above the viewport.

## Colours (dark theme)

| Where | Value |
| --- | --- |
| Title bar background | `#111111` |
| Transcript / band region | `#212121` (sampled around the band), `#1A1A19` (pane area) |
| Native icon | `#F0EFEC`; hovered mod-Button chip `#383838` |
| Active panel icon (Files open) | icon `#3A9AEC` / `#4B87D1`, square `#032042`; the panel tab's own icon `#6DA7EC` on `#032042` |
| Desktop native Button for a mod | `#383838` chip, `#E4E4BD` text; `variant="primary"` a white pill |

## Not exposed, or not looked for

- The session-rail cards (Environment, Context, Connectors, Changes) were not
  probed; nothing a mod draws reaches them either way.
- No way was found to open or close a mod pane through UIA other than its own
  close mark and the mod's band toggle.
- The light theme was never measured.
