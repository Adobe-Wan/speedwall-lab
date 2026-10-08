"""Set up and eyeball the camera-key probe: does the vJoy view button switch Star Citizen's camera, and can the
centre-of-screen frames tell the views apart?"""
from __future__ import annotations
import time
from pathlib import Path
import numpy as np
from .capture import Grabber, cam_dist, cam_mean
from .vjoy_out import VJoy


def _median_frame(grab, n=10, gap=0.08):
    fr = []
    for _ in range(n):
        fr.append(grab.grab()["cam"]); time.sleep(gap)
    return np.median(np.stack(fr), axis=0)


def _watch(grab, seconds, fps=60.0):
    """Frames and times for `seconds` (centre-of-screen probe frames, colour)."""
    t0 = time.perf_counter(); fr, ts = [], []
    while time.perf_counter() - t0 < seconds:
        fr.append(grab.grab()["cam"]); ts.append(time.perf_counter() - t0)
        time.sleep(max(0.0, 1.0 / fps - 0.004))
    return ts, fr


def camcheck(cfg: dict):
    """Press the camera key until the cockpit view comes back, watching the centre of the screen at about 60 fps. In Arena
    Commander, ship stopped, COCKPIT view, window focused. For each press it prints the fade, the cut (the picture changing
    completely: the probe's sign that the key worked) and the brightness of the view it landed on, then how many views the
    key cycles through. Star Citizen's key cycles three (cockpit, external A, external B); the harness expects the setting
    `probe_views: 3` and a cut score above probe_cut_thr (0.5)."""
    roi = cfg["roi"].get("cam") or [0.25, 0.20, 0.50, 0.50]
    grab = Grabber(cfg["monitor"], {"cam": roi}, cam_w=cfg.get("cam_downscale", 96))
    if "view" not in cfg["buttons"]:
        raise SystemExit("Add `view: 3` under `buttons:` in config.yaml and bind vJoy button 3 to Star Citizen's camera cycle (F4).")
    vj = VJoy(cfg["vjoy_device"], cfg["axes"], cfg["buttons"])
    pulse = cfg.get("probe_pulse_s", 0.12)
    thr = float(cfg.get("probe_cut_thr", 0.5))
    try:
        print("Camera check. Arena Commander free flight, ship stopped, COCKPIT view, window focused. Starting in 5 s.")
        time.sleep(5)
        _, quiet = _watch(grab, 1.5)
        base = np.median(np.stack([np.asarray(f, np.float32) for f in quiet]), axis=0)
        noise = max(cam_dist(quiet[i], quiet[i - 1]) for i in range(1, len(quiet)))
        print(f"  cockpit view: brightness {cam_mean(base):.1f}; largest frame-to-frame change while nothing happens {noise:.3f}")
        views, cut_scores, n_views = [("cockpit", base)], [], None
        for k in range(1, 6):
            vj.set(buttons={"view": True}); t_press = time.perf_counter()
            time.sleep(pulse); vj.set(buttons={"view": False})
            ts, fr = _watch(grab, 2.6)
            steps = [cam_dist(fr[i], fr[i - 1]) for i in range(1, len(fr))]
            i_cut = int(np.argmax(steps)) if steps else 0
            score = steps[i_cut] if steps else 0.0
            means = [cam_mean(f) for f in fr]
            landed = np.median(np.stack([np.asarray(f, np.float32) for f in fr[-20:]]), axis=0)
            d_base = cam_dist(landed, base)
            cut_scores.append(score)
            print(f"  press {k}: cut {score:.2f} at +{ts[i_cut + 1] if i_cut + 1 < len(ts) else 0:.2f} s "
                  f"(darkest during the switch {min(means):.1f}), landed on a view of brightness {cam_mean(landed):.1f}, "
                  f"distance to the cockpit view {d_base:.2f}")
            if d_base < float(cfg.get("probe_cockpit_thr", 0.55)):
                n_views = k
                print(f"  -> the cockpit view is back after {k} presses: the key cycles through {k} views")
                break
        if n_views is None:
            print("RESULT: the cockpit view did not come back within 5 presses. Check that vJoy button 3 is bound to the camera cycle "
                  "key (F4 by default) and that the ship is in a cockpit view; if it did switch, drag a better `cam` box with "
                  "`python run.py calibrate`.")
        else:
            print(f"RESULT: set `probe_views: {n_views}` in config.yaml" + ("" if n_views == int(cfg.get('probe_views', 3)) else "  (it is not that now)") + ".")
            if min(cut_scores) < thr * 1.4:
                print(f"  WARNING: the weakest cut scored {min(cut_scores):.2f}, close to the detection threshold {thr}. Lower probe_cut_thr "
                      f"(the quiet-scene noise above is {noise:.2f}) or drag a `cam` box whose content differs more between the views.")
            else:
                print(f"  Every press cut clearly (weakest {min(cut_scores):.2f}, threshold {thr}); nothing to tune.")
    finally:
        vj.close()


def camstrip(session: Path, test_id: str):
    """Contact sheet of the probe frames around every press, to check the detection by eye: results/<session>/<test>/camstrip.png.
    For each press: the frame just before, 0.3 s after and 0.7 s after."""
    import cv2
    d = session / test_id
    with np.load(d / "frames.npz") as z:
        t, cam = z["t"], z["cam"]
    import csv
    with open(d / "commands.csv") as f:
        rows = list(csv.DictReader(f))
    view = np.array([float(r.get("view", 0)) for r in rows])
    edges = np.where((view[1:] > 0.5) & (view[:-1] <= 0.5))[0] + 1
    if not len(edges):
        raise SystemExit(f"{test_id}: no probe presses recorded")
    tiles = []
    for e in edges:
        row = []
        for dt in (-0.1, 0.3, 0.7):
            i = int(np.argmin(np.abs(t - (t[e] + dt))))
            im = cv2.resize(cam[i], None, fx=3, fy=3, interpolation=cv2.INTER_NEAREST)
            if im.ndim == 2:
                im = cv2.cvtColor(im, cv2.COLOR_GRAY2BGR)
            cv2.putText(im, f"{t[e] + dt:.1f}s", (4, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)
            row.append(im)
        tiles.append(np.hstack(row))
    sheet = np.vstack(tiles)
    out = d / "camstrip.png"
    cv2.imwrite(str(out), sheet)
    print(f"{len(edges)} presses -> {out}")
