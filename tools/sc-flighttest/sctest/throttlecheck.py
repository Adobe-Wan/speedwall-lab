"""`python run.py throttlecheck`: find out how the forward axis behaves in the game and how to zero it.

The first campaign found that after a test with forward thrust (e.g. 50 %) the game kept that throttle: the HUD throttle
line stayed above 0 even with the spacebrake held, and the ship took off the moment the brake was released. This command
reproduces that at rest and tries a few ways to put the throttle back to 0, and says which one works. Free flight,
decoupled, SCM, ship stopped, nothing around. It only ever pushes the forward axis for a few seconds with the brake in
between, so the ship never goes far. F12 aborts. The result is also saved to throttlecheck.log next to config.yaml."""
from __future__ import annotations
import time
from pathlib import Path
from .safety import Guard, Abort
from .vjoy_out import VJoy
from .capture import Grabber
from . import ocr

# (label, axis value, seconds) pushed on the forward axis, with the spacebrake held, to clear a latched throttle
CANDIDATES = [
    ("full back, tap (-1.0 for 0.15 s)", -1.0, 0.15),
    ("full back, short (-1.0 for 0.3 s)", -1.0, 0.3),
    ("full back, long (-1.0 for 1.5 s)", -1.0, 1.5),
    ("half back (-0.5 for 1.0 s)", -0.5, 1.0),
    ("light back (-0.3 for 1.0 s)", -0.3, 1.0),
    ("tiny back (-0.1 for 1.0 s)", -0.1, 1.0),
    ("tiny back, long (-0.05 for 2.0 s)", -0.05, 2.0),
]
OK_MPS = 3.0


def _speed(grab):
    try:
        return ocr.read_number(grab.grab()["speed"])
    except Exception:
        return None


def _watch(grab, guard, secs, every=0.25):
    out, t0 = [], time.perf_counter()
    while time.perf_counter() - t0 < secs:
        guard.check()
        out.append((round(time.perf_counter() - t0, 2), _speed(grab)))
        time.sleep(every)
    return out


def _stop(vj, grab, guard, max_s=25.0):
    """Spacebrake until the speed reads <= 1 three times in a row; leaves the brake HELD."""
    vj.set(buttons={"brake": True})
    ok, t0 = 0, time.perf_counter()
    while time.perf_counter() - t0 < max_s:
        guard.check()
        s = _speed(grab)
        ok = ok + 1 if (s is not None and s <= 1.0) else 0
        if ok >= 3:
            return True
        time.sleep(0.25)
    return False


def throttlecheck(cfg: dict):
    log_path = Path(__file__).resolve().parent.parent / "throttlecheck.log"
    lines = []

    def log(msg=""):
        print(msg)
        lines.append(msg)
        log_path.write_text("\n".join(lines) + "\n", encoding="utf-8")

    if "speed" not in cfg["roi"] or "strafe_long" not in cfg["axes"]:
        raise SystemExit("needs the speed region and the strafe_long axis in config.yaml")
    guard = Guard(cfg["window_title_contains"], cfg["abort_key"], enabled=True)
    vj = VJoy(cfg["vjoy_device"], cfg["axes"], cfg["buttons"])
    grab = Grabber(cfg["monitor"], {"speed": cfg["roi"]["speed"]}, cfg.get("view_downscale", 480),
                   cfg.get("view_max_px", 450_000), use_view=False, cam_w=cfg.get("cam_downscale", 96))
    log("Throttle check. Arena Commander free flight, decoupled, SCM, ship STOPPED, window focused. Starting in 5 s. F12 aborts.")
    log("Watch the HUD throttle line while this runs and tell me what it does.")
    time.sleep(5)
    results = []
    try:
        if not _stop(vj, grab, guard):
            log("Could not stop the ship (speed never read <= 1). Stop it by hand and run again.")
            return
        # 1. Does the game hold the throttle after the stick returns to centre?
        log("\n1) Forward axis +0.5 for 3 s, then back to centre, spacebrake released.")
        vj.set(buttons={"brake": False}, axes={"strafe_long": 0.5})
        a = _watch(grab, guard, 3.0)
        vj.set(axes={"strafe_long": 0.0})
        b = _watch(grab, guard, 3.0)
        log("   speed while pushing : " + " ".join(f"{s}" for _, s in a))
        log("   speed after centring: " + " ".join(f"{s}" for _, s in b))
        end = [s for _, s in b[-4:] if s is not None]
        latched = bool(end) and min(end) > OK_MPS
        log("   -> " + ("THROTTLE LATCHED: the ship keeps going with the stick centred." if latched else
                        "no latch: the speed fell back with the stick centred."))
        _stop(vj, grab, guard)
        if not latched:
            log("\nNothing to fix with these settings. If the HUD throttle still showed above 0, tell me what you saw.")
            return
        # 2. Which push on the forward axis clears it?
        for label, val, secs in CANDIDATES:
            guard.check()
            log(f"\n2) Latch again (+0.5 for 3 s), brake to a stop, then try: {label}")
            vj.set(buttons={"brake": False}, axes={"strafe_long": 0.5}); _watch(grab, guard, 3.0)
            vj.set(axes={"strafe_long": 0.0})
            _stop(vj, grab, guard)
            vj.set(axes={"strafe_long": val})                 # brake still held
            time.sleep(secs)
            vj.set(axes={"strafe_long": 0.0})
            time.sleep(0.5)
            vj.set(buttons={"brake": False})
            w = _watch(grab, guard, 3.0)
            sp = [s for _, s in w if s is not None]
            peak = max(sp) if sp else None
            ok = peak is not None and peak <= OK_MPS
            log("   speed with the brake released: " + " ".join(f"{s}" for _, s in w))
            log(f"   -> {'CLEARED the throttle' if ok else 'still moving'} (peak {peak})")
            results.append((label, val, secs, ok, peak))
            _stop(vj, grab, guard)
            if ok:
                break
        good = [r for r in results if r[3]]
        log("\nResult: " + (f"use  {good[0][0]}  -> throttle_reset: {{value: {good[0][1]}, seconds: {good[0][2]}}}"
                            if good else "none of the pushes cleared it. Tell me what clears it by hand (key, tap, hold)."))
    except Abort as e:
        log(f"ABORTED: {e}")
    finally:
        vj.close()
        log("Inputs released. Saved to " + str(log_path))
