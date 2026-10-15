#Requires AutoHotkey v2.0
#SingleInstance Force
#Include ClaudeSidebar.ahk
#Include CollapseButton.ahk

; CollapseAll.ahk: draws a "collapse all" icon beside the Forward button in the
; Claude desktop app's title bar. Clicking it collapses every sidebar section.
; The icon shows only while the Claude window is focused, maximised and showing its sidebar.

if A_PtrSize != 8 {
    MsgBox "CollapseAll.ahk needs 64-bit AutoHotkey v2.", "Claude collapse all", "Icon!"
    ExitApp
}
DllCall("SetThreadDpiAwarenessContext", "ptr", -4, "ptr")   ; physical pixels, as UIA reports them
CoordMode "Pixel", "Screen"
CoordMode "Mouse", "Screen"
A_IconTip := "Claude: collapse all sidebar sections"

CollapseButton.Start()

