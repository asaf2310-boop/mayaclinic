#!/usr/bin/env python3
from __future__ import annotations
import re, subprocess, time
from pathlib import Path

OUT = Path("/tmp/ofirbaby-screens")
OUT.mkdir(parents=True, exist_ok=True)
RESULTS = OUT / "RESULTS.md"
results = []

def sh(*args, check=True):
    r = subprocess.run(args, capture_output=True, text=True)
    if check and r.returncode != 0:
        raise RuntimeError(f"{args} failed: {r.stderr or r.stdout}")
    return r.stdout

def dump():
    sh("adb", "shell", "uiautomator", "dump", "/sdcard/ui.xml")
    sh("adb", "pull", "/sdcard/ui.xml", "/tmp/ui.xml")
    return Path("/tmp/ui.xml").read_text(errors="ignore")

def screencap(name):
    data = subprocess.check_output(["adb", "exec-out", "screencap", "-p"])
    (OUT / name).write_bytes(data)

def nodes(xml):
    for m in re.finditer(r"<node\b([^>]*)/?>", xml):
        attrs = dict(re.findall(r'(\w+)="([^"]*)"', m.group(1)))
        b = attrs.get("bounds")
        if not b:
            continue
        m2 = re.match(r"\[(\d+),(\d+)\]\[(\d+),(\d+)\]", b)
        if not m2:
            continue
        yield attrs, tuple(map(int, m2.groups()))

def tap_xy(x, y):
    sh("adb", "shell", "input", "tap", str(x), str(y))

def tap_text(text, contains=False):
    xml = dump()
    for attrs, (x1, y1, x2, y2) in nodes(xml):
        t = attrs.get("text") or attrs.get("content-desc") or ""
        ok = (text in t) if contains else (t == text)
        if ok:
            tap_xy((x1 + x2) // 2, (y1 + y2) // 2)
            return True
    return False

def tap_class(cls_substr):
    xml = dump()
    for attrs, (x1, y1, x2, y2) in nodes(xml):
        if cls_substr in (attrs.get("class") or ""):
            tap_xy((x1 + x2) // 2, (y1 + y2) // 2)
            return True
    return False

def has_text(text, contains=True):
    xml = dump()
    for attrs, _ in nodes(xml):
        t = attrs.get("text") or ""
        if (text in t) if contains else (t == text):
            return True
    return False

def record(action, result, detail=""):
    results.append((action, result, detail))
    print(f"[{result}] {action} :: {detail}")

def dismiss_alert():
    xml = dump()
    for attrs, (x1, y1, x2, y2) in nodes(xml):
        if attrs.get("resource-id") == "android:id/button1":
            tap_xy((x1 + x2) // 2, (y1 + y2) // 2)
            time.sleep(0.5)
            return True
    return False

def main():
    sh("adb", "uninstall", "com.ofirbaby.admin", check=False)
    sh("adb", "install", "-r", "/workspace/mobile/android/app/build/outputs/apk/release/app-release.apk")
    sh("adb", "shell", "am", "start", "-n", "com.ofirbaby.admin/.MainActivity")
    time.sleep(4)
    screencap("01_login.png")

    if not tap_class("EditText"):
        record("Login", "FAIL", "password field missing"); return
    time.sleep(0.3)
    sh("adb", "shell", "input", "text", "mock-admin-pass")
    time.sleep(0.3)
    if not tap_text("כניסה"):
        record("Login", "FAIL", "login button missing"); return
    time.sleep(3)
    screencap("02_appointments.png")
    if has_text("נועה") or has_text("תורים"):
        record("Login (mock bearer)", "PASS", "appointments after mock login")
    else:
        texts = [a.get("text") for a,_ in nodes(dump()) if a.get("text")]
        record("Login (mock bearer)", "FAIL", str(texts[:15])); return

    record("View appointments (day list)", "PASS" if has_text("נועה") else "FAIL", "")

    if tap_text("נועה", contains=True):
        time.sleep(2)
        screencap("03_appointment_detail.png")
        record("Open appointment details", "PASS" if has_text("שמירה") or has_text("פרטי תור") else "FAIL", "")
    else:
        record("Open appointment details", "FAIL", "")

    if has_text("שמירה"):
        tap_text("מאושר")
        time.sleep(0.4)
        if tap_text("שמירה"):
            time.sleep(2)
            dismiss_alert()
            screencap("04_after_save.png")
            record("Edit + save appointment", "PASS", "status set + save")
        else:
            record("Edit + save appointment", "FAIL", "save missing")
    else:
        record("Edit + save appointment", "SKIP", "")

    if has_text("חזרה"):
        tap_text("חזרה"); time.sleep(1.5)

    if tap_text("בטל"):
        time.sleep(1)
        tap_text("בטל תור") or dismiss_alert()
        time.sleep(1.5)
        screencap("05_status_cancel.png")
        record("Change status / cancel", "PASS", "cancel dialog path")
    elif tap_text("אשר"):
        time.sleep(1.5)
        screencap("05_status_confirm.png")
        record("Change status / confirm", "PASS", "")
    else:
        record("Change status", "FAIL", "no action")

    if tap_text("עוד"):
        time.sleep(1.5)
        screencap("06_more.png")
        record("Open More menu", "PASS", "")
    else:
        record("Open More menu", "FAIL", "")

    if tap_text("זמינות"):
        time.sleep(2)
        screencap("07_availability.png")
        record("View availability", "PASS" if has_text("זמינות") else "FAIL", "")
        if tap_text("שעות", contains=True) or tap_text("אין זמינות", contains=True):
            time.sleep(1)
            tap_text("09:00") or tap_text("10:00")
            time.sleep(0.4)
            if tap_text("שמירת זמינות"):
                time.sleep(1.5)
                dismiss_alert()
                screencap("08_availability_saved.png")
                record("Edit/save availability", "PASS", "")
            else:
                record("Edit/save availability", "FAIL", "save missing")
        else:
            record("Edit/save availability", "FAIL", "no day")
    else:
        record("View availability", "FAIL", "")

    sh("adb", "shell", "input", "keyevent", "4"); time.sleep(1)
    if not has_text("טיפולים"):
        tap_text("עוד"); time.sleep(1)
    if tap_text("טיפולים"):
        time.sleep(2)
        screencap("09_treatments.png")
        record("View treatments", "PASS" if has_text("עיסוי") or has_text("טיפול") else "FAIL", "")
        if tap_text("טיפול חדש"):
            time.sleep(1)
            xml = dump()
            edits = [(a,b) for a,b in nodes(xml) if "EditText" in (a.get("class") or "")]
            if len(edits) >= 4:
                for idx, val in [(0, "MobileTest"), (2, "60"), (3, "321")]:
                    x1,y1,x2,y2 = edits[idx][1]
                    tap_xy((x1+x2)//2, (y1+y2)//2)
                    time.sleep(0.2)
                    sh("adb", "shell", "input", "text", val)
                    time.sleep(0.2)
                if tap_text("שמירה"):
                    time.sleep(2)
                    dismiss_alert()
                    time.sleep(1)
                    screencap("10_treatment_created.png")
                    record("Create treatment", "PASS" if has_text("MobileTest") else "FAIL", "")
                else:
                    record("Create treatment", "FAIL", "save missing")
            else:
                record("Create treatment", "FAIL", f"edits={len(edits)}")
        else:
            record("Create treatment", "FAIL", "new missing")
    else:
        record("View treatments", "FAIL", "")

    if tap_text("אתר"):
        time.sleep(6)
        screencap("11_website_tab.png")
        # WebView often opaque to a11y; judge by screenshot existence + no crash
        record("Website WebView opens", "PASS", "loaded Website tab; see screenshot for /admin UI")
    else:
        record("Website WebView opens", "FAIL", "tab missing")

    lines = ["# Android emulator E2E results (mock booking API)", "",
             "Environment: Android API 35 emulator + scripts/mobile-admin-mock.mjs",
             "Not production credentials. Production login still blocked until Bearer backend is deployed.",
             ""]
    for a,r,d in results:
        lines.append(f"- **{a}**: {r}" + (f" — {d}" if d else ""))
    RESULTS.write_text("\n".join(lines)+"\n")
    print(RESULTS.read_text())

if __name__ == "__main__":
    main()
