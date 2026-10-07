"""Runs tests: brake to a stop, wait for a full boost tank, hold exact inputs, record HUD regions."""
from __future__ import annotations
import json, time
from pathlib import Path
import numpy as np

from .safety import Guard, Abort
from .vjoy_out import VJoy
from .capture import Grabber, brightness
from . import ocr


def _sleep_guarded(guard, seconds):
    end = time.perf_counter() + seconds
    while time.perf_counter() < end:
        guard.check()
        time.sleep(0.02)


def read_speed(grab, n=3):
    """Median of n speed reads (None if none succeed). Single reads can glitch, e.g. while the HUD flashes."""
    vals = [ocr.read_number(grab.grab()["speed"]) for _ in range(n)] if "speed" in grab.boxes else []
    vals = [v for v in vals if v is not None]
    return float(np.median(vals)) if vals else None


def brake_to_stop(cfg, vj, grab, guard, log):
    """Hold spacebrake until speed reads <= brake_until_mps on 3 consecutive reads (or brake_max_s)."""
    vj.set(buttons={"brake": True})
    t0 = time.perf_counter()
    last, ok_reads = None, 0
    try:
        while time.perf_counter() - t0 < cfg["brake_max_s"]:
            guard.check()
            sp = ocr.read_number(grab.grab()["speed"]) if "speed" in grab.boxes else None
            if sp is not None:
                last = sp
                ok_reads = ok_reads + 1 if sp <= cfg["brake_until_mps"] else 0
                if ok_reads >= 3:
                    break
            _sleep_guarded(guard, 0.3)
    finally:
        vj.set(buttons={"brake": False})
    log(f"  braked to {last} m/s in {time.perf_counter()-t0:.1f} s")
    _sleep_guarded(guard, 1.0)
    return last


def turn_around(cfg, vj, guard, log):
    """Yaw roughly 180 degrees at rest, so consecutive tests fly in opposite directions.
    A yaw flips both forward and left/right in world space, so the run stays near its start point."""
    secs = cfg.get("turnaround_s", 3.6)          # Gladius SCM yaw ~52 deg/s -> ~3.5 s for 180 deg
    vj.set(axes={"yaw": 1.0})
    try:
        _sleep_guarded(guard, secs)
    finally:
        vj.center()
    _sleep_guarded(guard, 1.0)                    # let the rotation stop
    log(f"  turned around ({secs:.1f} s of full yaw)")


def wait_hud_recovered(cfg, grab, guard, log, baseline):
    """After a blackout: wait until the HUD digits are bright again, then a few seconds more."""
    t0 = time.perf_counter()
    good = 0
    while time.perf_counter() - t0 < cfg.get("gloc_recover_max_s", 40):
        guard.check()
        f = grab.grab()
        lum = max(brightness(f[k]) for k in ("speed", "g") if k in f)
        good = good + 1 if lum >= 0.8 * baseline else 0
        if good >= 5:
            break
        _sleep_guarded(guard, 0.2)
    log(f"  HUD back after {time.perf_counter()-t0:.1f} s; resting {cfg.get('gloc_rest_s', 8)} s")
    _sleep_guarded(guard, cfg.get("gloc_rest_s", 8))


def wait_boost_full(cfg, vj, grab, guard, log):
    if "ab" not in grab.boxes:
        log(f"  no AB region; waiting {cfg['refill_max_s']} s")
        _sleep_guarded(guard, cfg["refill_max_s"])
        return
    t0 = time.perf_counter()
    ab = None
    while time.perf_counter() - t0 < cfg["refill_max_s"]:
        ab = ocr.read_number(grab.grab()["ab"], "pct")
        if ab is not None and ab >= cfg["refill_until_pct"]:
            break
        _sleep_guarded(guard, 1.0)
    log(f"  boost tank {ab}% after {time.perf_counter()-t0:.1f} s")


def record(test, cfg, vj, grab, guard):
    """Hold the test's inputs and capture the HUD every frame.

    G-LOC guard: the brightest pixels of the speed/G readouts are tracked. If they drop below
    gloc_dim_frac of their pre-test level for gloc_hold_s while inputs are active (blackout), every input
    is released and the test ends early.

    With test.gloc == "ease", an earlier grey-out (below gloc_ease_frac) scales the test's ease_axes down by
    ease_step instead, at most once per gloc_ease_wait_s, and the test flies on: a pilot reduces the input
    rather than letting go. The scale never comes back up within a test. Below ease_min, or a full blackout
    anyway, falls back to the release above.
    Returns (t, cmds, frames, lum, gloc_at, baseline, ease_events)."""
    period = 1.0 / cfg["target_fps"]
    frames = {k: [] for k in grab.boxes}
    ts, cmds, lum = [], [], []
    last_cmd = None
    base, dim_since, gloc_at = None, None, None
    dim_frac, hold_s = cfg.get("gloc_dim_frac", 0.5), cfg.get("gloc_hold_s", 0.25)
    ease = test.gloc == "ease"
    ease_frac, ease_wait = cfg.get("gloc_ease_frac", 0.8), cfg.get("gloc_ease_wait_s", 1.5)
    scale, grey_since, last_ease, ease_events = 1.0, None, -1e9, []
    t0 = time.perf_counter()
    nxt = t0
    while True:
        guard.check()
        t = time.perf_counter() - t0
        if t >= test.duration:
            break
        axes, buttons = test.inputs_at(t)
        if scale < 1.0:
            axes = {k: (v * scale if k in test.ease_axes else v) for k, v in axes.items()}
        if gloc_at is not None:
            axes, buttons = {}, {}
        cmd = ({k: axes.get(k, 0.0) for k in vj.axis_map}, {"boost": buttons.get("boost", False), "brake": False})
        if cmd != last_cmd:
            vj.set(*cmd)
            last_cmd = cmd
        g = grab.grab()
        now = time.perf_counter() - t0
        l = max(brightness(g[k]) for k in ("speed", "g") if k in g) if ("speed" in g or "g" in g) else 255.0
        ts.append(now)
        cmds.append({**cmd[0], "boost": int(cmd[1]["boost"])})
        lum.append(l)
        for k, v in g.items():
            frames[k].append(v)
        if now < test.pre_s:
            base = float(np.median(lum))                       # HUD brightness before any input
        elif base and base > 40 and gloc_at is None:
            if ease and l < ease_frac * base:                  # greying out: ease off, don't let go
                grey_since = now if grey_since is None else grey_since
                if now - grey_since >= hold_s and now - last_ease >= ease_wait:
                    scale = round(scale - test.ease_step, 3)
                    last_ease = now
                    ease_events.append([round(now - test.pre_s, 2), max(scale, 0.0)])
                    if scale < test.ease_min:                  # eased as far as allowed: release
                        dim_since = dim_since if dim_since is not None else grey_since
                        l = 0.0
            elif ease:
                grey_since = None
            if l < dim_frac * base:
                dim_since = now if dim_since is None else dim_since
                if now - dim_since >= hold_s:
                    gloc_at = round(dim_since - test.pre_s, 2)  # seconds after inputs started
                    vj.center()
                    last_cmd = None
            else:
                dim_since = None
        if gloc_at is not None and now - test.pre_s - gloc_at > 1.0:
            break                                              # keep 1 s after release, then stop
        nxt += period
        d = nxt - time.perf_counter()
        if d > 0:
            time.sleep(d)
        else:
            nxt = time.perf_counter()
    vj.center()
    return np.array(ts), cmds, frames, np.array(lum), gloc_at, base, ease_events


def save(outdir: Path, test, ts, cmds, frames, cfg, grab, lum=None, extra=None):
    outdir.mkdir(parents=True, exist_ok=True)
    arrays = {k: np.stack(v) for k, v in frames.items() if v}
    if lum is not None:
        arrays["hud_lum"] = lum
    np.savez_compressed(outdir / "frames.npz", t=ts, **arrays)
    meta = {"id": test.id, "note": test.note, "expect": test.expect,
            "steps": [{"t": s.t, **s.axes, **s.buttons} for s in test.steps],
            "pre_s": test.pre_s, "post_s": test.post_s, "fps_target": cfg["target_fps"],
            "fps_actual": round(len(ts) / max(ts[-1], 1e-6), 1) if len(ts) else 0,
            "monitor": grab.mon, "roi": cfg["roi"], "recorded": time.strftime("%Y-%m-%d %H:%M:%S"),
            **(extra or {})}
    (outdir / "meta.json").write_text(json.dumps(meta, indent=1))
    with open(outdir / "commands.csv", "w") as f:
        keys = list(cmds[0].keys()) if cmds else []
        f.write("t," + ",".join(keys) + "\n")
        for t, c in zip(ts, cmds):
            f.write(f"{t:.4f}," + ",".join(str(c[k]) for k in keys) + "\n")


def run_tests(tests, cfg, session_dir: Path, dry_run=False, log=print):
    guard = Guard(cfg["window_title_contains"], cfg["abort_key"], enabled=not dry_run)
    vj = VJoy(cfg["vjoy_device"], cfg["axes"], cfg["buttons"], dry_run=dry_run)
    grab = Grabber(cfg["monitor"], cfg["roi"], cfg.get("view_downscale", 480), cfg.get("view_max_px", 450_000),
                   use_view=cfg.get("roll_view", False))
    log(f"Capture: {'one region per frame' if grab.single else 'separate regions (slower)'}; "
        f"{', '.join(grab.boxes)}")
    log(f"Focus the Star Citizen window. Starting in 5 s. Press {cfg['abort_key']} at any time to abort.")
    time.sleep(5)
    start_max = cfg.get("start_max_mps", 3.0)
    try:
        for i, test in enumerate(tests, 1):
            log(f"[{i}/{len(tests)}] {test.id}: {test.note}")
            brake_to_stop(cfg, vj, grab, guard, log)
            if i > 1 and cfg.get("turnaround", True) and "yaw" in vj.axis_map:
                turn_around(cfg, vj, guard, log)
            if test.uses_boost:
                wait_boost_full(cfg, vj, grab, guard, log)
            v0 = read_speed(grab)
            if v0 is not None and v0 > start_max:              # never start a test already moving
                log(f"  speed {v0} m/s before start; braking again")
                brake_to_stop(cfg, vj, grab, guard, log)
                v0 = read_speed(grab)
                if v0 is not None and v0 > start_max:
                    log(f"  SKIPPED {test.id}: still {v0} m/s")
                    continue
            ts, cmds, frames, lum, gloc_at, base, ease_events = record(test, cfg, vj, grab, guard)
            save(session_dir / test.id, test, ts, cmds, frames, cfg, grab, lum,
                 {"start_speed": v0, "gloc_at": gloc_at, "hud_lum_base": base, "gloc_policy": test.gloc,
                  "ease_events": ease_events})
            fps = len(ts) / max(ts[-1], 1e-6)
            log(f"  recorded {len(ts)} frames ({fps:.0f} fps)")
            if fps < 30:
                log("  WARNING: below 30 fps. Run `python run.py fpscheck` and see README 'Troubleshooting'.")
            for t_e, s_e in ease_events:
                log(f"  grey-out at {t_e} s: eased {', '.join(test.ease_axes)} to {s_e:.0%}")
            if gloc_at is not None:
                log(f"  G-LOC: HUD faded {gloc_at} s into the inputs; inputs released, test ended early.")
                wait_hud_recovered(cfg, grab, guard, log, base)
    except Abort as e:
        log(f"ABORTED: {e}. All inputs released.")
    finally:
        vj.close()
