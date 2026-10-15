; ClaudeSidebar.ahk: UI Automation helpers for the Claude desktop app's sidebar.
; Raw UIA over ComCall, 64-bit AutoHotkey v2 only (VARIANTs are passed by pointer).

class ClaudeSidebar {
    static UIA := ComObject("{ff48dba4-60ef-4201-aa87-54103eef594e}", "{30cbe57d-d9d0-452a-ab13-7ac5ac4825ee}")

    ; UIA ids
    static P_CONTROLTYPE := 30003, P_NAME := 30005, P_AUTOMATIONID := 30011
    static P_HAS_EXPANDCOLLAPSE := 30028, T_BUTTON := 50000, T_GROUP := 50026
    static PAT_EXPANDCOLLAPSE := 10005, SCOPE_DESCENDANTS := 4
    static EXPANDED := 1

    ; Section headers ("Pinned", "Jobs", "Recents", ...): buttons inside a "Sidebar"
    ; group that expand/collapse and carry no automation id. Session rows' menu
    ; buttons match too, so their "More options for ..." names are skipped.
    static Sections(hwnd) {
        win := this.Window(hwnd)
        groups := this.FindAll(win, this.And(this.Cond(this.P_CONTROLTYPE, 3, this.T_GROUP), this.Cond(this.P_NAME, 8, "Sidebar")))
        isHeader := this.And(this.And(this.Cond(this.P_CONTROLTYPE, 3, this.T_BUTTON), this.Cond(this.P_AUTOMATIONID, 8, ""))
            , this.Cond(this.P_HAS_EXPANDCOLLAPSE, 11, true))
        out := []
        for g in groups
            for b in this.FindAll(g, isHeader) {
                name := this.Name(b)
                if SubStr(name, 1, 16) != "More options for"
                    out.Push({ name: name, pattern: this.ExpandCollapse(b) })
            }
        return out
    }

    ; Collapses every expanded section; returns how many it collapsed.
    static CollapseAll(hwnd) {
        sections := this.Sections(hwnd)
        if !sections.Length {        ; Chromium builds its accessibility tree on first ask
            Sleep 400
            sections := this.Sections(hwnd)
        }
        n := 0
        for s in sections
            try if this.State(s.pattern) = this.EXPANDED {
                ComCall(4, s.pattern)   ; IUIAutomationExpandCollapsePattern::Collapse
                n++
            }
        return n
    }

    ; Screen rect of the title bar's Forward button, or "" before the tree is ready.
    static ForwardRect(hwnd) {
        b := this.FindFirst(this.Window(hwnd), this.And(this.Cond(this.P_CONTROLTYPE, 3, this.T_BUTTON), this.Cond(this.P_NAME, 8, "Forward")))
        return b ? this.Rect(b) : ""
    }

    ; The title bar's sidebar toggle, labelled "Hide sidebar" while the sidebar
    ; shows and "Show sidebar" while it's hidden; "" before the tree is ready.
    static Toggle(hwnd) => this.FindFirst(this.Window(hwnd), this.And(this.Cond(this.P_CONTROLTYPE, 3, this.T_BUTTON)
        , this.Or(this.Cond(this.P_NAME, 8, "Hide sidebar"), this.Cond(this.P_NAME, 8, "Show sidebar"))))

    ; Throws once the toggle element has gone stale.
    static IsShown(toggle) => this.Name(toggle) = "Hide sidebar"

    ; --- raw UIA plumbing ---

    static Window(hwnd) {
        ComCall(6, this.UIA, "ptr", hwnd, "ptr*", &el := 0)       ; ElementFromHandle
        return ComValue(13, el)
    }

    static Cond(propId, vt, value) {
        v := Buffer(24, 0)
        NumPut("ushort", vt, v)
        switch vt {
            case 3: NumPut("int", value, v, 8)                       ; VT_I4
            case 11: NumPut("short", value ? -1 : 0, v, 8)           ; VT_BOOL
            case 8: NumPut("ptr", DllCall("oleaut32\SysAllocString", "wstr", value, "ptr"), v, 8)  ; VT_BSTR
        }
        ComCall(23, this.UIA, "int", propId, "ptr", v, "ptr*", &c := 0)  ; CreatePropertyCondition
        DllCall("oleaut32\VariantClear", "ptr", v)
        return ComValue(13, c)
    }

    static And(a, b) {
        ComCall(25, this.UIA, "ptr", a, "ptr", b, "ptr*", &c := 0)   ; CreateAndCondition
        return ComValue(13, c)
    }

    static Or(a, b) {
        ComCall(28, this.UIA, "ptr", a, "ptr", b, "ptr*", &c := 0)   ; CreateOrCondition
        return ComValue(13, c)
    }

    static FindFirst(el, cond) {
        ComCall(5, el, "int", this.SCOPE_DESCENDANTS, "ptr", cond, "ptr*", &found := 0)
        return found ? ComValue(13, found) : ""
    }

    static FindAll(el, cond) {
        ComCall(6, el, "int", this.SCOPE_DESCENDANTS, "ptr", cond, "ptr*", &arr := 0)
        out := []
        if !arr
            return out
        arr := ComValue(13, arr)
        ComCall(3, arr, "int*", &n := 0)                            ; get_Length
        Loop n {
            ComCall(4, arr, "int", A_Index - 1, "ptr*", &e := 0)    ; GetElement
            out.Push(ComValue(13, e))
        }
        return out
    }

    static Name(el) {
        ComCall(23, el, "ptr*", &bstr := 0)                         ; get_CurrentName
        s := bstr ? StrGet(bstr, "UTF-16") : ""
        DllCall("oleaut32\SysFreeString", "ptr", bstr)
        return s
    }

    static Rect(el) {
        r := Buffer(16)
        ComCall(43, el, "ptr", r)                                   ; get_CurrentBoundingRectangle
        x := NumGet(r, 0, "int"), y := NumGet(r, 4, "int")
        return { x: x, y: y, w: NumGet(r, 8, "int") - x, h: NumGet(r, 12, "int") - y }
    }

    static ExpandCollapse(el) {
        ComCall(16, el, "int", this.PAT_EXPANDCOLLAPSE, "ptr*", &p := 0)  ; GetCurrentPattern
        return ComObjQuery(ComValue(13, p), "{619be086-1f4e-4ee4-bafa-210128738730}")
    }

    static State(pattern) {
        ComCall(5, pattern, "int*", &s := 0)                        ; get_CurrentExpandCollapseState
        return s
    }
}
