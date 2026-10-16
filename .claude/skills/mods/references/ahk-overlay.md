# AutoHotkey overlay findings

Found building `collapse-all/` with AutoHotkey v2.0.18, 64-bit
(`C:\Program Files\AutoHotkey\v2\AutoHotkey64.exe`), on Windows 11 against the
Claude desktop 2.37–2.42, October 2026. The working code is the evidence; this
file is why it is shaped that way and what else was learned on the way.

Contents:
1. [Reading the app through UI Automation](#1-reading-the-app-through-ui-automation)
2. [The overlay window](#2-the-overlay-window)
3. [Drawing the icon with GDI+](#3-drawing-the-icon-with-gdi)
4. [Running and debugging a script from a Claude Code tool](#4-running-and-debugging-a-script-from-a-claude-code-tool)
5. [Verifying by pixels](#5-verifying-by-pixels)
6. [AHK language traps](#6-ahk-language-traps)

## 1. Reading the app through UI Automation

- Electron builds its accessibility tree on the first UIA ask. The first
  `FindAll` over the window returns about 14 elements (the window and its
  native buttons); 250–500 ms later the whole tree is there. Poll for a known
  element (`Forward`) for up to ~5 s before trusting "not found". While
  anything keeps asking, the tree stays on and costs Chromium a little CPU.
- Raw UIA over `ComCall` works with no library. `collapse-all/ClaudeSidebar.ahk`
  holds the plumbing, and these vtable indices are verified on this build:
  - `IUIAutomation` (CLSID `{ff48dba4-60ef-4201-aa87-54103eef594e}`, IID
    `{30cbe57d-d9d0-452a-ab13-7ac5ac4825ee}`): `ElementFromHandle` 6,
    `CreateTrueCondition` 21, `CreatePropertyCondition` 23,
    `CreateAndCondition` 25, `CreateOrCondition` 28.
  - `IUIAutomationElement`: `FindFirst` 5, `FindAll` 6, `GetCurrentPattern` 16,
    `get_CurrentControlType` 21, `get_CurrentName` 23,
    `get_CurrentBoundingRectangle` 43.
  - `IUIAutomationElementArray`: `get_Length` 3, `GetElement` 4.
  - `IUIAutomationExpandCollapsePattern` (IID
    `{619be086-1f4e-4ee4-bafa-210128738730}`, pattern id 10005): `Expand` 3,
    `Collapse` 4, `get_CurrentExpandCollapseState` 5; state 1 expanded, 0
    collapsed.
  - Property ids: ControlType 30003, Name 30005, AutomationId 30011,
    IsExpandCollapsePatternAvailable 30028. Control types: Button 50000, Group
    50026, Text 50020, Document 50030. VARIANT tags: VT_I4 3, VT_BSTR 8, VT_BOOL
    11 (true is −1). 64-bit only: VARIANTs go by pointer.
  A new interface or method is an entry for this list once a ComCall on it has
  worked.
- A cached element reads fast (`get_CurrentName` ≈ 0.3 ms) and throws once it
  is stale; catch, drop it, re-find on the next tick.
- Call `SetThreadDpiAwarenessContext(-4)` first in every script and every
  PowerShell probe, or UIA rects, `WinGetPos` and screenshots disagree with each
  other.
- PowerShell's `UIAutomationClient` assembly is a quicker first probe than AHK:
  `FindAll` with `IsExpandCollapsePatternAvailableProperty`, then
  `GetCurrentPattern(ExpandCollapsePattern.Pattern).Collapse()` collapsed a
  section in 172 ms. Walking the parent chain for a Group named `Sidebar`
  separates sidebar buttons from transcript ones.
- The session's own tools help with setup: `mcp__ccd_window__set_sidebar_collapsed`
  hides and shows the person's sidebar for a test, and
  `mcp__ccd_sidebar__list_sections` reads each section's `collapsed` flag; no
  tool collapses a section, which is why UIA was needed.

## 2. The overlay window

- `Gui("-Caption +ToolWindow +AlwaysOnTop -DPIScale +E0x08000000")`. The last
  flag is `WS_EX_NOACTIVATE`: a click on the overlay never takes focus from
  Claude. Show it with `Show("NA x y w h")`.
- `DwmSetWindowAttribute` 33 = 3 gives small rounded corners; 34 = `0xFFFFFFFE`
  removes the Windows 11 one-pixel border that otherwise outlines the chip.
- Size and place it from the native control's UIA rect each layout, not from
  constants: Forward is 36×35 at 132,5 maximised at 1920×1080, on this build and
  DPI only.
- Sample the title-bar background beside the control for the chip's colour so
  light and dark themes both fit; re-sample every few seconds and on resize, and
  skip the sample when it would land on the overlay itself.
- Gate visibility on what the person asked (focused, maximised, sidebar shown)
  from a 100 ms timer; each gate is a cheap `WinActive`, `WinGetMinMax` or
  cached-label read. A pointer-leave timer at 50 ms clears hover.
- `Picture` control with `HBITMAP:<handle>` draws a GDI+ bitmap; set `.Value`
  again to repaint for hover.

## 3. Drawing the icon with GDI+

- Segoe Fluent Icons has collapse glyphs (`E70E`, `F165`, `E8C4`…) but no
  chevrons-down-up. Render a glyph sheet to PNG (`glyphs.png` pattern,
  `System.Drawing` in PowerShell) before promising a font glyph.
- Draw a Lucide icon by hand: 24-unit viewBox, round caps and joins, stroke ≈
  0.046 × button height, scaled to ≈ 0.45 of the height. Match the native
  icons, measured first: ~16×15 px, ~1.6 px stroke, `#F0EFEC` on `#111111`.
- GDI+ at 1× lands strokes unevenly. The lower chevron came out a row taller
  and the icon sat visibly low in its hover square while its bounding box said
  centred. Draw at 8× (`ZOOM`) with `GdipSetSmoothingMode` 5 (AntiAlias8x8),
  then `GdipDrawImageRectI` onto the final size with `GdipSetInterpolationMode`
  7 (HighQualityBilinear). Centroid error fell from 0.16 px to 0.02 px and
  mirror asymmetry from 23 % to 2 %. `GdipSetPixelOffsetMode` 4 (Half) on both
  canvases so `w/2` is the true centre.
- .NET's `System.Drawing.SmoothingMode` refuses value 5, so that comparison had
  to run through AHK's flat GDI+ calls: draw, read pixels back with
  `GdipBitmapGetPixel`, score (`aatest.ahk` pattern).
- Keep GDI+ started once (`GdiplusStartup` behind a static token) and dispose
  every pen, graphics and bitmap; the icon is redrawn on every hover change.

## 4. Running and debugging a script from a Claude Code tool

- A script started by any Claude Code tool — Bash, PowerShell `Start-Process`,
  even `explorer.exe <script>` — lands in Claude's job object and is killed when
  the app closes (`IsProcessInJob` true; `QueryInformationJobObject` class 3
  lists the job's pids, and the job has no kill-on-close flag, but the overlay
  still died with the app). `Invoke-CimMethod Win32_Process Create` escaped the
  job (parent `WmiPrvSE.exe`), which is fine for one relaunch; the lasting answer
  is the person double-clicking in Explorer, plus a `shell:startup` shortcut
  (`WScript.Shell.CreateShortcut`, target the AHK exe, argument the script).
- A tool-launched AHK has no console. `FileAppend(text, "*")` writes nowhere;
  log to a file beside the script. `/ErrorStdOut` only helps when stdout is
  captured, and an uncaught error otherwise opens a dialog that waits forever: a
  script that overruns is probably sitting on one. Find it with UIA on the AHK
  pid (its window's descendants hold the message and the line) and
  `Stop-Process` it.
- `Start-Process -RedirectStandardError` keeps the file open for the script's
  life; reading it from the same shell fails. Use the log file.
- PowerShell 5.1 in this harness threw "Cannot convert value to type
  System.String" on `Get-Content "$P\a","$P\b"`; `[IO.File]::ReadAllText` or
  `cat` from Bash is safer.
- Confirm a relaunch for a change really restarted:
  `Get-CimInstance Win32_Process -Filter "Name='AutoHotkey64.exe'"` with
  `CommandLine`. `#SingleInstance Force` makes a relaunch replace the old one.
- Running two scripts that both `#Include` `CollapseButton.ahk` is how the
  button was drawn off to one side for a hover screenshot (`hovertest.ahk`
  pattern): `Build`, `Show`, then null `gui` and `Build` again for the hovered
  copy.

## 5. Verifying by pixels

- Capture with `Graphics.CopyFromScreen` after
  `SetProcessDpiAwarenessContext(-4)`; for a window that may be covered,
  `PrintWindow(hwnd, hdc, 2)`. Upscale with `NearestNeighbor` and
  `PixelOffsetMode Half` for a screenshot a person can read.
- "Centred" by bounding box lied. Score a crop (inside the hover square, edges
  excluded) by intensity-weighted centroid against the square's centre, plus a
  mirror-asymmetry figure (sum of |pixel − its vertical mirror| over total
  intensity, and the same horizontally). Measure the native control the same way
  first, so the target is a number.
- A colour histogram of a small region (top five values with counts) is enough
  to read a control's background, text and accent; it was how the Files icon's
  `#3A9AEC` on `#032042` and the native button's `#383838` chip were found.
- Do not synthesize clicks into the Claude window to test an overlay or a band.
  One `mouse_event` click on the band's toggle opened the app's Settings dialog,
  and the click meant to close that opened a panel menu. Drive the overlay by
  posting `WM_LBUTTONDOWN`/`WM_LBUTTONUP` to its own child control (works, and
  never touches Claude), and ask the person for anything inside Claude.
- Moving the pointer for a hover capture needs Claude in front: check
  `GetForegroundWindow` first, or the capture is of whatever is there (it was
  Chrome's tab strip once), and put the cursor back where it was.

## 6. AHK language traps

- Variable names are case-insensitive: `SS` and `s`, `W` and `w` are the same
  variable. Both bit in one session (a wrong scale, then a divide by zero
  scoring an all-black bitmap). Name a zoom factor `ZOOM`, never a short
  upper-case twin of something lower-case.
- `A_ScriptDir "probe.log"` has no separator; write `A_ScriptDir "\probe.log"`.
- A fat-arrow `out(s) => FileAppend(…)` is fine for a logger. After `break`,
  `A_Index` in a `Loop` holds the iteration it broke at.
- `ComValue(13, ptr)` wraps a raw interface pointer as an object AHK releases;
  `ComObjQuery(obj, iid)` casts a pattern to its interface.
