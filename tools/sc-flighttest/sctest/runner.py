"""Runs tests: brake to a stop, wait for a full boost tank, hold exact inputs, record HUD regions."""
from __future__ import annotations
import json, time
from pathlib import Path
import numpy as np

from .safety import Guard, Abort
from .vjoy_out import VJoy
from .capture import Grabber, brightness, cam_dist, cam_mean
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
    """Flip the ship 180 degrees at rest, so consecutive tests fly in opposite directions and the run stays inside
    the arena. A pitch flip reverses forward and up/down in world space (left/right is unchanged: see
    mirror_lateral); a yaw flip reverses forward and left/right. SCM rates: pitch 68 deg/s, yaw 52.1 deg/s."""
    axis = cfg.get("turnaround_axis", "pitch")
    secs = cfg.get("turnaround_s", 2.8 if axis == "pitch" else 3.6)   # 180 / 68 = 2.65 s;  180 / 52.1 = 3.45 s
    vj.set(axes={axis: 1.0})
    try:
        _sleep_guarded(guard, secs)
    finally:
        vj.center()
    _sleep_guarded(guard, 1.0)                    # let the rotation stop
    log(f"  flipped ({secs:.1f} s of full {axis})")


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
    back = time.perf_counter() - t0
    log(f"  HUD back after {back:.1f} s; resting {cfg.get('gloc_rest_s', 8)} s")
    _sleep_guarded(guard, cfg.get("gloc_rest_s", 8))
    return back


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
    grey_at is the first time the HUD stayed below gloc_ease_frac for gloc_hold_s (the grey-out), whatever the
    policy; gloc_at - grey_at is how long the pilot kept control while greyed out.

    Camera-key probe (test.probe > 0): the vJoy "view" button is pressed for probe_pulse_s every test.probe seconds
    while the inputs are held. The last centre-of-screen frame that was not black is kept. After a blackout, once
    inputs are released, the button is pressed once or twice more in the dark (so that the number of presses since that
    last visible frame is odd) and run_tests checks afterwards, with vision back, whether the camera differs from that
    last visible frame: it does only if an odd number of those presses took effect.
    Returns (t, cmds, frames, lum, gloc_at, baseline, ease_events, grey_at, probe) where probe is
    {"presses": [s after inputs start], "dark_press_at": s or None, "dark_presses": n, "since_bright": n,
     "cam_at_dark": last visible frame or None, "cam_base": frame or None}."""
    period = 1.0 / cfg["target_fps"]
    frames = {k: [] for k in grab.boxes}
    ts, cmds, lum = [], [], []
    last_cmd = None
    base, dim_since, gloc_at = None, None, None
    dim_frac, hold_s = cfg.get("gloc_dim_frac", 0.5), cfg.get("gloc_hold_s", 0.25)
    ease = test.gloc == "ease"
    ease_frac, ease_wait = cfg.get("gloc_ease_frac", 0.8), cfg.get("gloc_ease_wait_s", 1.5)
    scale, grey_since, last_ease, ease_events, grey_at = 1.0, None, -1e9, [], None
    pulse, dark_delay = cfg.get("probe_pulse_s", 0.12), cfg.get("probe_dark_delay_s", 0.5)
    t_inputs_end = test.pre_s + sum(s.t for s in test.steps)
    press_until, next_press, presses, dark_press_at, cam_base = -1.0, test.pre_s + test.probe, [], None, None
    dark_mean = cfg.get("probe_dark_mean", 14.0)
    cam_bright, t_bright, dark_plan, dark_done, since_bright = None, 0.0, None, 0, 0
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
        if test.probe > 0:
            if gloc_at is None and next_press <= t < t_inputs_end:           # a press every test.probe seconds
                press_until = t + pulse; next_press += test.probe; presses.append(round(t - test.pre_s, 2))
            elif gloc_at is not None:
                if dark_plan is None:                                              # how many presses since the screen went black?
                    since_bright = sum(1 for p in presses if p + test.pre_s >= t_bright - 0.05)
                    dark_plan = [gloc_at + dark_delay + 0.4 * i for i in range(1 if since_bright % 2 == 0 else 2)]
                if dark_done < len(dark_plan) and t - test.pre_s >= dark_plan[dark_done]:
                    press_until = t + pulse; dark_done += 1                       # a press in the dark
                    dark_press_at = dark_press_at if dark_press_at is not None else round(t - test.pre_s, 2)
        pad = {"boost": buttons.get("boost", False), "brake": False}
        if "view" in vj.button_map:
            pad["view"] = t < press_until
        cmd = ({k: axes.get(k, 0.0) for k in vj.axis_map}, pad)
        if cmd != last_cmd:
            vj.set(*cmd)
            last_cmd = cmd
        g = grab.grab()
        now = time.perf_counter() - t0
        l = max(brightness(g[k]) for k in ("speed", "g") if k in g) if ("speed" in g or "g" in g) else 255.0
        ts.append(now)
        cmds.append({**cmd[0], "boost": int(cmd[1]["boost"]), "view": int(cmd[1].get("view", False))})
        lum.append(l)
        for k, v in g.items():
            frames[k].append(v)
        if "cam" in g and cam_mean(g["cam"]) >= dark_mean:
            cam_bright, t_bright = g["cam"], now                      # the last frame with anything to see
        if now < test.pre_s:
            base = float(np.median(lum))                       # HUD brightness before any input
            if frames.get("cam"):
                cam_base = np.median(np.stack(frames["cam"]), axis=0)
        elif base and base > 40 and gloc_at is None:
            if l < ease_frac * base:                           # greying out
                grey_since = now if grey_since is None else grey_since
                if grey_at is None and now - grey_since >= hold_s:
                    grey_at = round(grey_since - test.pre_s, 2)
                if ease and now - grey_since >= hold_s and now - last_ease >= ease_wait:   # ease off, don't let go
                    scale = round(scale - test.ease_step, 3)
                    last_ease = now
                    ease_events.append([round(now - test.pre_s, 2), max(scale, 0.0)])
                    if scale < test.ease_min:                  # eased as far as allowed: release
                        dim_since = dim_since if dim_since is not None else grey_since
                        l = 0.0
            else:
                grey_since = None
            if l < dim_frac * base:
                dim_since = now if dim_since is None else dim_since
                if now - dim_since >= hold_s:
                    gloc_at = round(dim_since - test.pre_s, 2)  # seconds after inputs started
                    vj.center()
                    last_cmd = None
            else:
                dim_since = None
        keep = dark_delay + 0.4 * len(dark_plan or [0]) + 1.0 if test.probe > 0 else 1.0   # after a blackout: 1 s, or until the dark presses are done
        if gloc_at is not None and now - test.pre_s - gloc_at > keep:
            break
        nxt += period
        d = nxt - time.perf_counter()
        if d > 0:
            time.sleep(d)
        else:
            nxt = time.perf_counter()
    vj.center()
    return (np.array(ts), cmds, frames, np.array(lum), gloc_at, base, ease_events, grey_at,
            {"presses": presses, "dark_press_at": dark_press_at, "dark_presses": dark_done, "since_bright": since_bright,
             "cam_at_dark": None if cam_bright is None else cam_bright.copy(), "cam_base": cam_base})


def press_view(vj, guard, cfg):
    vj.set(buttons={"view": True}); _sleep_guarded(guard, cfg.get("probe_pulse_s", 0.12)); vj.set(buttons={"view": False})


def probe_aftermath(test, cfg, vj, grab, guard, log, probe, blacked_out):
    """After a probe test, once vision is back: did the press made in the dark take effect (the camera now differs from
    the view just before it), and put the camera back to the cockpit view so the next test reads the HUD again.
    Returns fields for meta.json. Raises Abort if the camera can't be restored."""
    thr = cfg.get("cam_state_thr", 0.3)
    _sleep_guarded(guard, 1.0 if blacked_out else cfg.get("probe_settle_s", 3.0))
    out = {"probe_presses": len(probe["presses"]), "dark_press_at": probe["dark_press_at"],
           "dark_presses": probe["dark_presses"], "presses_since_black": probe["since_bright"]}
    cur = grab.grab().get("cam")
    if cur is None:
        return out
    if probe["dark_presses"] and probe["cam_at_dark"] is not None:
        d = cam_dist(cur, probe["cam_at_dark"])
        out.update(dark_press_worked=bool(d > thr), dark_press_dist=round(d, 3))
        log(f"  presses made after the screen went black ({probe['since_bright'] + probe['dark_presses']} in all, odd on purpose) "
            f"{'DID' if d > thr else 'did not'} change the camera (distance {d:.2f}, threshold {thr})")
    if probe["cam_base"] is None:
        return out
    d0 = cam_dist(cur, probe["cam_base"]); tries = 0
    while d0 > thr and tries < 4:                              # not in the starting view: press until it is
        press_view(vj, guard, cfg); _sleep_guarded(guard, 1.2)
        cur = grab.grab()["cam"]; d0 = cam_dist(cur, probe["cam_base"]); tries += 1
    out.update(cam_restore_presses=tries, cam_final_dist=round(d0, 3))
    if tries:
        log(f"  camera back to the cockpit view after {tries} press(es)")
    if d0 > thr:
        raise Abort("could not get the camera back to the cockpit view (is the vJoy view button bound to the camera key? "
                    "run `python run.py camcheck`). Fix it by hand and re-run the remaining tests")
    return out


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
    probing = any(t.probe > 0 for t in tests)
    if probing and "view" not in cfg["buttons"]:
        raise SystemExit("Probe tests press a vJoy 'view' button: add `view: 3` under `buttons:` in config.yaml, bind button 3 "
                         "to Star Citizen's camera cycle (F4), then run `python run.py camcheck`.")
    if probing:
        cfg["roi"].setdefault("cam", [0.25, 0.20, 0.50, 0.50])
    rois = {k: v for k, v in cfg["roi"].items() if k != "cam" or probing}   # the centre-of-screen frames only when probed
    grab = Grabber(cfg["monitor"], rois, cfg.get("view_downscale", 480), cfg.get("view_max_px", 450_000),
                   use_view=cfg.get("roll_view", False), cam_w=cfg.get("cam_downscale", 96))
    log(f"Capture: {'one region per frame' if grab.single else 'separate regions (slower)'}; "
        f"{', '.join(grab.boxes)}")
    log(f"Focus the Star Citizen window. Starting in 5 s. Press {cfg['abort_key']} at any time to abort.")
    time.sleep(5)
    start_max = cfg.get("start_max_mps", 3.0)
    try:
        lateral_runs = 0
        for i, test in enumerate(tests, 1):
            mirrored = False
            if cfg.get("mirror_lateral", True) and test.uses_lateral:
                mirrored = lateral_runs % 2 == 1               # every second lateral test flies the other way
                lateral_runs += 1
                if mirrored:
                    test = test.mirrored()
            log(f"[{i}/{len(tests)}] {test.id}{' (strafe mirrored)' if mirrored else ''}: {test.note}")
            brake_to_stop(cfg, vj, grab, guard, log)
            if i > 1 and cfg.get("turnaround", True) and cfg.get("turnaround_axis", "pitch") in vj.axis_map:
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
            ts, cmds, frames, lum, gloc_at, base, ease_events, grey_at, probe = record(test, cfg, vj, grab, guard)
            save(session_dir / test.id, test, ts, cmds, frames, cfg, grab, lum,
                 {"start_speed": v0, "gloc_at": gloc_at, "grey_at": grey_at, "hud_lum_base": base,
                  "gloc_policy": test.gloc, "ease_events": ease_events, "lat_mirrored": mirrored,
                  "probe_every": test.probe, "probe_press_times": probe["presses"]})
            fps = len(ts) / max(ts[-1], 1e-6)
            log(f"  recorded {len(ts)} frames ({fps:.0f} fps)")
            if fps < 30:
                log("  WARNING: below 30 fps. Run `python run.py fpscheck` and see README 'Troubleshooting'.")
            for t_e, s_e in ease_events:
                log(f"  grey-out at {t_e} s: eased {', '.join(test.ease_axes)} to {s_e:.0%}")
            if grey_at is not None:
                log(f"  grey-out began {grey_at} s into the inputs" + (f", blackout at {gloc_at} s" if gloc_at is not None else ""))
            extra = {}
            if gloc_at is not None:
                log(f"  G-LOC: HUD faded {gloc_at} s into the inputs; inputs released, test ended early.")
                extra["recovery_s"] = round(wait_hud_recovered(cfg, grab, guard, log, base), 1)   # vision back after the let-go
            if test.probe > 0 and "cam" in grab.boxes:
                extra.update(probe_aftermath(test, cfg, vj, grab, guard, log, probe, gloc_at is not None))
            if extra:
                mp = session_dir / test.id / "meta.json"
                meta = json.loads(mp.read_text()); meta.update(extra)
                mp.write_text(json.dumps(meta, indent=1))
    except Abort as e:
        log(f"ABORTED: {e}. All inputs released.")
    finally:
        vj.close()
