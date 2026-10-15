; CollapseButton.ahk: the title-bar icon. Shows while the Claude window is focused,
; maximised and showing its sidebar; sits beside Forward and collapses every
; sidebar section on click.

class CollapseButton {
    static WINDOW := "ahk_exe claude.exe ahk_class Chrome_WidgetWin_1"
    static gui := "", pic := "", w := 0, h := 0, x := 0, y := 0, dx := 0, dy := 0
    static owner := 0, winSize := "", nextLayout := 0, placed := false, visible := false, hovering := false, leaveTimer := ""
    static toggle := "", wasShown := false
    static bg := 0x111111, fg := 0xF0EFEC, hoverBg := 0x292929

    static Start() {
        this.leaveTimer := ObjBindMethod(this, "CheckLeave")
        OnMessage(0x200, ObjBindMethod(this, "OnMouseMove"))   ; WM_MOUSEMOVE
        SetTimer(ObjBindMethod(this, "Tick"), 100)
    }

    static Tick() {
        try {
            hwnd := WinActive(this.WINDOW)
            if !hwnd || WinGetMinMax(hwnd) != 1 {     ; focused and maximised only
                this.owner := 0                     ; lay out afresh when it is again
                return this.Hide()
            }
            WinGetPos &wx, &wy, &ww, &wh, hwnd
            shown := this.SidebarShown()
            ; a sidebar coming back re-lays out too, so the colours are sampled with it showing
            if hwnd != this.owner || ww "x" wh != this.winSize || A_TickCount >= this.nextLayout || shown && !this.wasShown
                this.Layout(hwnd, wx, wy, ww "x" wh), shown := this.SidebarShown()
            this.wasShown := shown
            if !this.placed || !shown
                return this.Hide()                  ; not the main window, tree not ready, or sidebar hidden
            this.Place(wx + this.dx, wy + this.dy)
        } catch {
            this.owner := 0
            this.Hide()
        }
    }

    ; One cheap read per tick: the cached toggle's label. A stale toggle reads as
    ; hidden and is looked up again straight away.
    static SidebarShown() {
        try return ClaudeSidebar.IsShown(this.toggle)
        if this.toggle
            this.toggle := "", this.nextLayout := 0
        return false
    }

    ; Finds Forward and sits just right of it, matching its size, and finds the
    ; sidebar toggle. Re-runs on resize and every 5 seconds, for app zoom and theme changes.
    static Layout(hwnd, wx, wy, winSize) {
        this.owner := hwnd, this.winSize := winSize
        r := ClaudeSidebar.ForwardRect(hwnd)
        this.toggle := r ? ClaudeSidebar.Toggle(hwnd) : ""
        this.placed := !!(r && this.toggle)
        this.nextLayout := A_TickCount + (this.placed ? 5000 : 300)   ; Chromium wakes its tree on the first ask
        if !this.placed
            return
        gap := Round(r.w / 8)
        this.dx := r.x + r.w + gap - wx, this.dy := r.y - wy
        if !this.gui || r.w != this.w || r.h != this.h
            this.Build(r.w, r.h)
        this.Theme(r.x + 2 * r.w + 3 * gap, r.y + r.h // 2)
    }

    static Build(w, h) {
        if this.gui
            this.gui.Destroy()
        this.w := w, this.h := h, this.visible := false, this.hovering := false
        g := Gui("-Caption +ToolWindow +AlwaysOnTop -DPIScale +E0x08000000")   ; WS_EX_NOACTIVATE: Claude keeps focus
        g.MarginX := 0, g.MarginY := 0
        this.pic := g.Add("Picture", "x0 y0 w" w " h" h, "HBITMAP:" this.Icon(w, h, this.bg, this.fg))
        this.pic.OnEvent("Click", (*) => this.Collapse())
        this.pic.OnEvent("DoubleClick", (*) => this.Collapse())
        DllCall("dwmapi\DwmSetWindowAttribute", "ptr", g.Hwnd, "int", 33, "int*", 3, "int", 4)   ; small rounded corners
        DllCall("dwmapi\DwmSetWindowAttribute", "ptr", g.Hwnd, "int", 34, "uint*", 0xFFFFFFFE, "int", 4)   ; no Win11 border
        this.gui := g
    }

    ; Lucide's chevrons-down-up, drawn with GDI+ at the size and weight of the
    ; app's own title-bar icons (about 0.45 of the button tall, 1.6px stroke at 35px).
    ; GDI+ anti-aliasing at 1x lands unevenly (the lower chevron came out a row
    ; taller), so it draws at 8x and scales down, which keeps the icon centred.
    static Icon(w, h, bg, fg) {
        static token := 0, ZOOM := 8
        if !token {
            DllCall("LoadLibrary", "str", "gdiplus", "ptr")
            si := Buffer(24, 0), NumPut("uint", 1, si)
            DllCall("gdiplus\GdiplusStartup", "ptr*", &token, "ptr", si, "ptr", 0)
        }
        big := this.Canvas(w * ZOOM, h * ZOOM, bg, &g)
        DllCall("gdiplus\GdipSetSmoothingMode", "ptr", g, "int", 5)            ; antialias 8x8
        DllCall("gdiplus\GdipCreatePen1", "uint", 0xFF000000 | fg, "float", h * 0.046 * ZOOM, "int", 2, "ptr*", &pen := 0)
        DllCall("gdiplus\GdipSetPenLineCap197819", "ptr", pen, "int", 2, "int", 2, "int", 2)   ; round caps
        DllCall("gdiplus\GdipSetPenLineJoin", "ptr", pen, "int", 2)                           ; round joins
        s := h * 0.025 * ZOOM, ox := w * ZOOM / 2 - 12 * s, oy := h * ZOOM / 2 - 12 * s   ; 24-unit viewBox, centred
        for line in [[7, 4, 12, 9, 17, 4], [7, 20, 12, 15, 17, 20]] {
            pts := Buffer(24)
            for i, v in line
                NumPut("float", (i & 1 ? ox : oy) + v * s, pts, (i - 1) * 4)
            DllCall("gdiplus\GdipDrawLines", "ptr", g, "ptr", pen, "ptr", pts, "int", 3)
        }
        DllCall("gdiplus\GdipDeletePen", "ptr", pen)
        DllCall("gdiplus\GdipDeleteGraphics", "ptr", g)

        bmp := this.Canvas(w, h, bg, &g)
        DllCall("gdiplus\GdipSetInterpolationMode", "ptr", g, "int", 7)        ; high-quality bilinear
        DllCall("gdiplus\GdipDrawImageRectI", "ptr", g, "ptr", big, "int", 0, "int", 0, "int", w, "int", h)
        DllCall("gdiplus\GdipCreateHBITMAPFromBitmap", "ptr", bmp, "ptr*", &hbm := 0, "uint", 0xFF000000 | bg)
        DllCall("gdiplus\GdipDeleteGraphics", "ptr", g)
        DllCall("gdiplus\GdipDisposeImage", "ptr", bmp)
        DllCall("gdiplus\GdipDisposeImage", "ptr", big)
        return hbm
    }

    ; A w x h bitmap filled with bg, and its graphics in &g with pixel edges on integers.
    static Canvas(w, h, bg, &g) {
        DllCall("gdiplus\GdipCreateBitmapFromScan0", "int", w, "int", h, "int", 0, "int", 0x26200A, "ptr", 0, "ptr*", &bmp := 0)
        DllCall("gdiplus\GdipGetImageGraphicsContext", "ptr", bmp, "ptr*", &g := 0)
        DllCall("gdiplus\GdipSetPixelOffsetMode", "ptr", g, "int", 4)
        DllCall("gdiplus\GdipGraphicsClear", "ptr", g, "uint", 0xFF000000 | bg)
        return bmp
    }

    ; Takes its colours from the title bar beside the icon, so light and dark themes both fit.
    static Theme(x, y) {
        if this.visible && x >= this.x && x < this.x + this.w && y >= this.y && y < this.y + this.h
            return
        c := Integer(PixelGetColor(x, y))
        if c = this.bg
            return
        dark := (c >> 16 & 0xFF) * 299 + (c >> 8 & 0xFF) * 587 + (c & 0xFF) * 114 < 128000
        this.bg := c
        this.hoverBg := this.Shift(c, dark ? 0x18 : -0x14)
        this.fg := dark ? 0xF0EFEC : 0x1F1E1D       ; the app's own title-bar icon colours
        this.Paint()
    }

    static Shift(c, d) {
        out := 0
        for s in [16, 8, 0]
            out |= Min(255, Max(0, (c >> s & 0xFF) + d)) << s
        return out
    }

    static Paint() {
        this.pic.Value := "HBITMAP:" this.Icon(this.w, this.h, this.hovering ? this.hoverBg : this.bg, this.fg)
    }

    static Place(x, y) {
        if this.visible && x = this.x && y = this.y
            return
        this.gui.Show("NA x" x " y" y " w" this.w " h" this.h)
        this.visible := true, this.x := x, this.y := y
    }

    static Hide() {
        if this.visible
            this.gui.Hide(), this.visible := false
        if this.hovering
            this.Leave()
    }

    static OnMouseMove(wParam, lParam, msg, hwnd) {
        if !this.gui || this.hovering || (hwnd != this.gui.Hwnd && hwnd != this.pic.Hwnd)
            return
        this.hovering := true
        this.Paint()
        ToolTip "Collapse all sections"
        SetTimer(this.leaveTimer, 50)
    }

    static CheckLeave() {
        MouseGetPos , , &win
        if win != this.gui.Hwnd
            this.Leave()
    }

    static Leave() {
        SetTimer(this.leaveTimer, 0)
        this.hovering := false
        this.Paint()
        ToolTip
    }

    static Collapse() {
        if hwnd := this.owner || WinActive(this.WINDOW)
            try ClaudeSidebar.CollapseAll(hwnd)
    }
}
