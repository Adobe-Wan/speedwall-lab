"""Runs tests: brake to a stop, wait for a full boost tank, hold exact inputs, record HUD regions."""
from __future__ import annotations
import json, time
from pathlib import Path
import numpy as np

from .safety import Guard, Abort
from .vjoy_out import VJoy
from .capture import Grabber, brightness, cam_dist, cam_mean
from .viewprobe import ViewProbe, params as vp_params
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
    settle_throttle(cfg, vj, grab, guard, log)
    _sleep_guarded(guard, 1.0)
    return last


def settle_throttle(cfg, vj, grab, guard, log):
    """The forward axis is the game's THROTTLE, which keeps its setting when the axis returns to centre: after a test
    with forward thrust the ship takes off again as soon as the spacebrake is let go. With the brake released, watch
    the speed briefly; if it climbs, hold the brake and tap the forward axis back (throttle_reset, found by
    `python run.py throttlecheck`), then check again. Never taps when the throttle is already at 0."""
    tr = cfg.get("throttle_reset") or {}
    if not tr or "speed" not in grab.boxes or "strafe_long" not in vj.axis_map:
        return
    limit = cfg.get("start_max_mps", 3.0)
    for attempt in range(int(tr.get("tries", 3)) + 1):
        t0, peak = time.perf_counter(), 0.0
        while time.perf_counter() - t0 < float(tr.get("watch_s", 0.8)):
            guard.check()
            sp = ocr.read_number(grab.grab()["speed"])
            if sp is not None:
                peak = max(peak, sp)
            if peak > limit:
                break
            _sleep_guarded(guard, 0.1)
        if peak <= limit:
            if attempt:
                log(f"  throttle cleared after {attempt} tap(s)")
            return
        if attempt >= int(tr.get("tries", 3)):
            break
        log(f"  throttle still set (ship sped up to {peak} m/s with the brake off): tapping it back")
        vj.set(buttons={"brake": True})
        try:
            vj.set(axes={"strafe_long": float(tr.get("value", -1.0))})
            _sleep_guarded(guard, float(tr.get("seconds", 0.15)))
            vj.set(axes={"strafe_long": 0.0})
            t1, ok = time.perf_counter(), 0
            while time.perf_counter() - t1 < 15.0 and ok < 3:
                guard.check()
                sp = ocr.read_number(grab.grab()["speed"])
                ok = ok + 1 if (sp is not None and sp <= cfg["brake_until_mps"]) else 0
                _sleep_guarded(guard, 0.25)
        finally:
            vj.set(axes={"strafe_long": 0.0}, buttons={"brake": False})
    raise Abort("the throttle stays set after tapping it back: set it to 0 by hand (S), then continue with --resume")


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
    """Hold the test's inputs and capture the HUD, the centre of the screen and (slowly) the whole screen.

    What a blackout is, and is not: a black screen is NOT the end of a test. A pilot whose screen goes dark can still
    regain vision by counter-strafing, and what decides whether he is TRULY blacked out is whether the camera key
    still switches the view. So (with test.probe > 0) the vJoy "view" button is pressed on a cadence, and as soon as
    the screen is suspected black (dark for probe_dark_hold_s, or the HUD digits gone) a black check is pressed at
    once and every probe_check_gap_s while it lasts: camera switched = not truly blacked out; no switch = real
    blackout (see viewprobe.py). The camera cycles three views, and the HUD digits exist only in the cockpit view,
    so HUD-based decisions use only the frames where the cockpit is up and settled.

    gloc policies (see schedule.Test): "release" lets go at a HUD blackout and ends the test; "ease" cuts ease_axes
    by ease_step per grey-out and flies on; "reverse" flips reverse_axes when the screen is practically black and
    flips them back when vision returns; "hold" never intervenes. In every policy grey_at (HUD < gloc_ease_frac of
    its pre-test level, held gloc_hold_s) and hud_black_at (< gloc_dim_frac) are recorded, and a darkness level
    (1 - centre brightness / its cockpit baseline, 0 clear .. 1 black) is saved with every frame.

    Returns a dict: ts, cmds, frames (per-frame crops, 'full' = whole-screen thumbnails with times t_full), lum
    (HUD brightness, nan when the HUD can't be read), dark (darkness level, nan outside the cockpit), gloc_at, base,
    ease_events, grey_at, hud_black_at, reversals, probe (summary of the camera-key probe) and probe_cfg."""
    period = 1.0 / cfg["target_fps"]
    frames = {k: [] for k in grab.boxes}
    ts, cmds, lum, dark_series = [], [], [], []
    thumbs, t_thumbs = [], []
    full_every = float(cfg.get("full_every_s", 0.5))
    next_full = 0.0
    last_cmd = None
    base, dim_since, gloc_at, hud_black_at = None, None, None, None
    dim_frac, hold_s = cfg.get("gloc_dim_frac", 0.5), cfg.get("gloc_hold_s", 0.25)
    legacy = test.gloc in ("release", "ease")
    ease = test.gloc == "ease"
    ease_frac, ease_wait = cfg.get("gloc_ease_frac", 0.8), cfg.get("gloc_ease_wait_s", 1.5)
    scale, grey_since, last_ease, ease_events, grey_at = 1.0, None, -1e9, [], None
    pulse = cfg.get("probe_pulse_s", 0.12)
    t_inputs_end = test.pre_s + sum(s.t for s in test.steps)
    press_until = -1.0
    probing = test.probe > 0 and "cam" in grab.boxes
    vp, cam_base, cam_base_mean = None, None, None
    pcfg = vp_params(cfg)
    dark_level, dark_ema = float("nan"), None
    black_since, reversing_since, flip, cooldown_until, rec_since = None, None, 1.0, 0.0, None
    reversals = []
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
        if flip < 0:
            axes = {k: (-v if k in test.reverse_axes else v) for k, v in axes.items()}
        if gloc_at is not None:
            axes, buttons = {}, {}
        inputs_on = gloc_at is None and test.pre_s <= t < t_inputs_end
        if probing and vp is not None and inputs_on:
            suspected = vp.dark_sustained or (hud_black_at is not None and dim_since is not None and t - dim_since >= hold_s)
            if vp.check_due(t, suspected):
                press_until = t + pulse
                vp.press(t, "check", None if np.isnan(dark_level) else round(float(dark_level), 3))
            elif vp.due(t):
                press_until = t + pulse
                vp.press(t, "cycle", None if np.isnan(dark_level) else round(float(dark_level), 3))
        pad = {"boost": buttons.get("boost", False), "brake": False}
        if "view" in vj.button_map:
            pad["view"] = t < press_until
        cmd = ({k: axes.get(k, 0.0) for k in vj.axis_map}, pad)
        if cmd != last_cmd:
            vj.set(*cmd)
            last_cmd = cmd
        g = grab.grab()
        now = time.perf_counter() - t0
        raw_l = max(brightness(g[k]) for k in ("speed", "g") if k in g) if ("speed" in g or "g" in g) else 255.0
        if full_every > 0 and now >= next_full:
            thumbs.append(grab.full_thumb(int(cfg.get("full_w", 128)))); t_thumbs.append(now)
            next_full = now + full_every
        cam = g.get("cam")
        # --- the camera-key probe and the darkness level ---------------------------------------------------
        hud_ok = True
        if probing and cam is not None and now >= test.pre_s:
            if vp is None:
                cam_base = np.median(np.stack([np.asarray(f, np.float32) for f in frames["cam"]]), axis=0)
                vp = ViewProbe(cfg, cam_base, first_press_at=test.pre_s + pcfg["probe_cockpit_dwell_s"])
                cam_base_mean = vp.base_mean
            vp.update(now, cam)
            hud_ok = vp.hud_valid(now)
        elif cam is not None and now >= test.pre_s and cam_base_mean is None:
            cam_base_mean = max(cam_mean(np.median(np.stack([np.asarray(f, np.float32) for f in frames["cam"]]), axis=0)), 1.0) if frames["cam"] else None
        if cam is not None and cam_base_mean and now >= test.pre_s:
            cockpit_now = vp.cockpit and vp.hud_valid(now) if vp is not None else True
            lvl = float(np.clip(1.0 - cam_mean(cam) / cam_base_mean, 0.0, 1.0))
            dark_ema = lvl if dark_ema is None else 0.6 * dark_ema + 0.4 * lvl
            dark_level = dark_ema if cockpit_now else float("nan")
        l = raw_l if hud_ok else float("nan")
        ts.append(now)
        cmds.append({**cmd[0], "boost": int(cmd[1]["boost"]), "view": int(cmd[1].get("view", False))})
        lum.append(l)
        dark_series.append(dark_level)
        for k, v in g.items():
            frames[k].append(v)
        if now < test.pre_s:
            base = float(np.nanmedian(lum))                    # HUD brightness before any input
        elif base and base > 40 and gloc_at is None:
            if not hud_ok:                                     # camera not in the cockpit view: no HUD to read
                grey_since, dim_since = None, None
            else:
                if l < ease_frac * base:                       # greying out
                    grey_since = now if grey_since is None else grey_since
                    if grey_at is None and now - grey_since >= hold_s:
                        grey_at = round(grey_since - test.pre_s, 2)
                    if ease and now - grey_since >= hold_s and now - last_ease >= ease_wait:
                        scale = round(scale - test.ease_step, 3)
                        last_ease = now
                        ease_events.append([round(now - test.pre_s, 2), max(scale, 0.0)])
                        if scale < test.ease_min:              # eased as far as allowed: release
                            dim_since = dim_since if dim_since is not None else grey_since
                            l = 0.0
                else:
                    grey_since = None
                if l < dim_frac * base:
                    dim_since = now if dim_since is None else dim_since
                    if now - dim_since >= hold_s:
                        if hud_black_at is None:
                            hud_black_at = round(dim_since - test.pre_s, 2)
                        if legacy:                             # old behaviour: let go and end the test
                            gloc_at = hud_black_at
                            vj.center()
                            last_cmd = None
                else:
                    dim_since = None
        # --- reverse policy: counter-strafe to stay conscious --------------------------------------------
        if test.gloc == "reverse" and gloc_at is None and test.pre_s <= now < t_inputs_end and cam_base_mean:
            black = (not np.isnan(dark_level) and dark_level >= test.reverse_at) or (vp is not None and vp.dark_sustained)
            clear = (not np.isnan(dark_level) and dark_level < 0.3) or (vp is not None and not vp.dark and np.isnan(dark_level))
            if flip > 0:
                black_since = (now if black_since is None else black_since) if black else None
                if (black_since is not None and now - black_since >= test.reverse_delay_s and now >= cooldown_until
                        and sum(1 for r in reversals if r["action"] == "reverse") < test.reverse_max):
                    flip = -1.0
                    reversing_since, rec_since = now, None
                    reversals.append({"t": round(now - test.pre_s, 2), "action": "reverse",
                                      "level": None if np.isnan(dark_level) else round(float(dark_level), 3)})
            else:
                rec_since = (now if rec_since is None else rec_since) if clear else None
                if (rec_since is not None and now - rec_since >= 0.4) or now - reversing_since >= test.reverse_hold_s:
                    flip, black_since, cooldown_until = 1.0, None, now + 1.0
                    reversals.append({"t": round(now - test.pre_s, 2), "action": "resume",
                                      "level": None if np.isnan(dark_level) else round(float(dark_level), 3)})
        if gloc_at is not None and now - test.pre_s - gloc_at > 1.0:
            break
        nxt += period
        d = nxt - time.perf_counter()
        if d > 0:
            time.sleep(d)
        else:
            nxt = time.perf_counter()
    vj.center()
    psum = None
    if vp is not None:
        psum = vp.summary()
        psum["final_view_idx"] = vp.view_idx
        psum["base_mean"] = vp.base_mean
        psum["dark_thr"] = vp.dark_thr
    if thumbs:
        frames["full"] = thumbs
    return {"ts": np.array(ts), "cmds": cmds, "frames": frames, "lum": np.array(lum), "dark": np.array(dark_series),
            "gloc_at": gloc_at, "base": base, "ease_events": ease_events, "grey_at": grey_at, "hud_black_at": hud_black_at,
            "reversals": reversals, "probe": psum, "probe_cfg": pcfg, "t_full": np.array(t_thumbs), "vp": vp,
            "cam_base_mean": cam_base_mean}


def press_view(vj, guard, cfg):
    vj.set(buttons={"view": True}); _sleep_guarded(guard, cfg.get("probe_pulse_s", 0.12)); vj.set(buttons={"view": False})


def _hud_readable(crops) -> bool:
    """Cockpit view test that ignores the scenery: the speed, G and boost digits all parse."""
    try:
        return all(ocr.read_number(crops[k], kind) is not None
                   for k, kind in (("speed", "int"), ("g", "g"), ("ab", "pct")) if k in crops)
    except Exception:
        return False


def probe_recover(cfg, vj, grab, guard, log, rec):
    """After a probe test: wait until the screen is visible again, then press the camera key until the cockpit view
    is back (the next test reads the HUD there). Returns fields for meta.json. Raises Abort if the camera can't be
    restored."""
    vp = rec["vp"]
    out = {}
    if vp is None:
        return out
    thr = vp.p["probe_cockpit_thr"]
    t0 = time.perf_counter()
    tries, last_press = 0, -1e9
    ok_frames = 0
    max_tries = int(cfg.get("probe_restore_tries", 8))
    while time.perf_counter() - t0 < cfg.get("gloc_recover_max_s", 40):
        guard.check()
        crops = grab.grab()
        cur = crops["cam"]
        settled = time.perf_counter() - last_press > 1.6
        # The cockpit view is recognised by its HUD readouts (speed, G and boost all readable), which does not depend on
        # the scenery. Comparing the picture with the pre-test cockpit frame fails when a planet or moon has moved in
        # the view, which is what aborted the first campaign.
        hud_ok = _hud_readable(crops)
        bright = cam_mean(cur) >= 0.5 * vp.base_mean or cam_mean(cur) >= 30
        same_picture = bright and cam_dist(cur, vp.base) < thr
        if hud_ok or same_picture:
            ok_frames += 1
            if ok_frames >= 3:
                break
        else:
            ok_frames = 0
            if settled and bright:
                if tries >= max_tries:
                    raise Abort("could not get the camera back to the cockpit view after %d presses (is the vJoy view button bound "
                                "to the camera key? run `python run.py camcheck`). Fix it by hand and re-run the remaining tests" % tries)
                press_view(vj, guard, cfg); last_press = time.perf_counter(); tries += 1
        _sleep_guarded(guard, 0.1)
    out.update(cam_restore_presses=tries, cam_recover_s=round(time.perf_counter() - t0, 1))
    if tries:
        log(f"  camera back to the cockpit view after {tries} press(es)")
    return out


def save(outdir: Path, test, ts, cmds, frames, cfg, grab, lum=None, extra=None, arrays_extra=None):
    outdir.mkdir(parents=True, exist_ok=True)
    arrays = {k: np.stack(v) for k, v in frames.items() if len(v)}
    if lum is not None:
        arrays["hud_lum"] = lum
    for k, v in (arrays_extra or {}).items():
        arrays[k] = v
    np.savez_compressed(outdir / "frames.npz", t=ts, **arrays)
    meta = {"id": test.id, "note": test.note, "expect": test.expect,
            "steps": [{"t": s.t, **s.axes, **s.buttons} for s in test.steps],
            "pre_s": test.pre_s, "post_s": test.post_s, "fps_target": cfg["target_fps"],
            "fps_actual": round(len(ts) / max(ts[-1], 1e-6), 1) if len(ts) else 0,
            "monitor": grab.mon, "roi": cfg["roi"], "recorded": time.strftime("%Y-%m-%d %H:%M:%S"),
            **(extra or {})}
    (outdir / "meta.json").write_text(json.dumps(meta, indent=1, default=lambda o: o.item() if hasattr(o, "item") else str(o)))
    with open(outdir / "commands.csv", "w") as f:
        keys = list(cmds[0].keys()) if cmds else []
        f.write("t," + ",".join(keys) + "\n")
        for t, c in zip(ts, cmds):
            f.write(f"{t:.4f}," + ",".join(str(c[k]) for k in keys) + "\n")


def forward_check(cfg, vj, grab, guard, log):
    """Before a run: push the throttle +0.3 for 1 s from rest and check the ship goes FORWARD. Forward is rated 13.7 G
    and backward 4.24 G, so +0.3 for 1 s reaches ~40 m/s forward but only ~12 m/s if the axis is inverted in game."""
    fc = cfg.get("forward_check", {"value": 0.3, "seconds": 1.0, "min_mps": 25.0})
    if not fc or "speed" not in grab.boxes or "strafe_long" not in vj.axis_map:
        return
    brake_to_stop(cfg, vj, grab, guard, log)
    vj.set(axes={"strafe_long": float(fc.get("value", 0.3))})
    try:
        _sleep_guarded(guard, float(fc.get("seconds", 1.0)))
    finally:
        vj.set(axes={"strafe_long": 0.0})
    v = read_speed(grab)
    log(f"Forward check: throttle +{fc.get('value', 0.3)} for {fc.get('seconds', 1.0)} s -> {v} m/s")
    brake_to_stop(cfg, vj, grab, guard, log)
    if v is None or v < float(fc.get("min_mps", 25.0)):
        raise Abort(f"forward check failed ({v} m/s): the throttle axis looks INVERTED (or unbound) in Star Citizen. "
                    "Fix it in Keybindings (vJoy Y, Throttle - Forward / Back, invert off) and run again")


def run_tests(tests, cfg, session_dir: Path, dry_run=False, log=print):
    session_dir.mkdir(parents=True, exist_ok=True)
    _console = log
    def log(msg=""):                                   # every line also goes to run.log, so an abort is never lost
        _console(msg)
        try:
            with open(session_dir / "run.log", "a", encoding="utf-8") as fh:
                fh.write(f"{time.strftime('%H:%M:%S')} {msg}\n")
        except OSError:
            pass
    guard = Guard(cfg["window_title_contains"], cfg["abort_key"], enabled=not dry_run)
    vj = VJoy(cfg["vjoy_device"], cfg["axes"], cfg["buttons"], dry_run=dry_run)
    probing = any(t.probe > 0 for t in tests)
    need_cam = probing or any(t.gloc in ("reverse", "hold") for t in tests)
    if probing and "view" not in cfg["buttons"]:
        raise SystemExit("Probe tests press a vJoy 'view' button: add `view: 3` under `buttons:` in config.yaml, bind button 3 "
                         "to Star Citizen's camera cycle (F4), then run `python run.py camcheck`.")
    if need_cam:
        cfg["roi"].setdefault("cam", [0.25, 0.20, 0.50, 0.50])
    rois = {k: v for k, v in cfg["roi"].items() if k != "cam" or need_cam}   # the centre-of-screen frames only when needed
    grab = Grabber(cfg["monitor"], rois, cfg.get("view_downscale", 480), cfg.get("view_max_px", 450_000),
                   use_view=cfg.get("roll_view", False), cam_w=cfg.get("cam_downscale", 96))
    log(f"Capture: {'one region per frame' if grab.single else 'separate regions (slower)'}; "
        f"{', '.join(grab.boxes)}")
    log(f"Focus the Star Citizen window. Starting in 5 s. Press {cfg['abort_key']} at any time to abort.")
    time.sleep(5)
    start_max = cfg.get("start_max_mps", 3.0)
    try:
        if not dry_run and any(t.uses_forward for t in tests):
            forward_check(cfg, vj, grab, guard, log)
        lateral_runs = 0
        skips_in_a_row = 0
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
                    skips_in_a_row += 1
                    if skips_in_a_row >= int(cfg.get("abort_after_skips", 2)):
                        raise Abort(f"{skips_in_a_row} tests in a row could not start: the ship still reads {v0} m/s after braking. "
                                    "It is probably out of bounds (being pushed back), destroyed or at the respawn menu. Respawn or fly "
                                    "back to the middle of the arena, then continue with: run_campaign.bat --resume <this session's folder name>")
                    continue
            skips_in_a_row = 0
            rec = record(test, cfg, vj, grab, guard)
            ts, base, gloc_at = rec["ts"], rec["base"], rec["gloc_at"]
            psum = rec["probe"]
            meta_extra = {"start_speed": v0, "gloc_at": gloc_at, "grey_at": rec["grey_at"], "hud_black_at": rec["hud_black_at"],
                          "hud_lum_base": base, "gloc_policy": test.gloc, "ease_events": rec["ease_events"],
                          "reversals": rec["reversals"], "lat_mirrored": mirrored, "probe_every": test.probe,
                          "probe_cfg": rec["probe_cfg"] if test.probe > 0 else None, "cam_base_mean": rec["cam_base_mean"],
                          "probe": None if psum is None else {k: v for k, v in psum.items() if k != "log"},
                          "probe_log": None if psum is None else psum["log"],
                          "full_every_s": cfg.get("full_every_s", 0.5)}
            arrays_extra = {"dark_level": rec["dark"]}
            if len(rec["t_full"]):
                arrays_extra["t_full"] = rec["t_full"]
            save(session_dir / test.id, test, ts, rec["cmds"], rec["frames"], cfg, grab, rec["lum"], meta_extra, arrays_extra)
            fps = len(ts) / max(ts[-1], 1e-6)
            log(f"  recorded {len(ts)} frames ({fps:.0f} fps)")
            if fps < 30:
                log("  WARNING: below 30 fps. Run `python run.py fpscheck` and see README 'Troubleshooting'.")
            for t_e, s_e in rec["ease_events"]:
                log(f"  grey-out at {t_e} s: eased {', '.join(test.ease_axes)} to {s_e:.0%}")
            if rec["grey_at"] is not None:
                log(f"  grey-out began {rec['grey_at']} s into the inputs"
                    + (f", HUD gone at {rec['hud_black_at']} s" if rec["hud_black_at"] is not None else ""))
            for r in rec["reversals"]:
                log(f"  {r['action']} at {r['t']} s (darkness {r['level']})")
            if psum:
                log(f"  camera key: {psum['cuts']} of {psum['presses']} presses switched the view; black checks "
                    f"{psum['black_checks_worked']} worked / {psum['black_checks_dead']} did nothing"
                    + (f"; TRUE blackout from {psum['true_blackout_at']:.2f} s" if psum["true_blackout_at"] is not None else "")
                    + (f"; key stopped at {psum['key_lost_at']:.2f} s" if psum["key_lost_at"] is not None else ""))
            extra = {}
            if gloc_at is not None:
                log(f"  HUD gone {gloc_at} s into the inputs (policy {test.gloc}): inputs released, test ended early.")
            if test.probe > 0 and rec["vp"] is not None:
                extra.update(probe_recover(cfg, vj, grab, guard, log, rec))
            affected = (gloc_at is not None or rec["hud_black_at"] is not None or rec["grey_at"] is not None
                        or (len(rec["dark"]) and np.nanmax(np.where(np.isnan(rec["dark"]), 0, rec["dark"])) >= 0.3))
            if affected and base:
                extra["recovery_s"] = round(wait_hud_recovered(cfg, grab, guard, log, base), 1)   # vision back after the let-go / the test
            if extra:
                mp = session_dir / test.id / "meta.json"
                meta = json.loads(mp.read_text()); meta.update(extra)
                mp.write_text(json.dumps(meta, indent=1))
    except Abort as e:
        log(f"ABORTED: {e}. All inputs released.")
    finally:
        vj.close()
