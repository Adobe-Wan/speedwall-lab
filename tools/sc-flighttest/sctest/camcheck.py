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


def camcheck(cfg: dict):
    """Press the view button twice and compare the centre-of-screen frames. In Arena Commander, ship stopped, cockpit view.
    Prints whether the key works and a cam_state_thr to put in config.yaml."""
    roi = cfg["roi"].get("cam") or [0.25, 0.20, 0.50, 0.50]
    grab = Grabber(cfg["monitor"], {"cam": roi}, cam_w=cfg.get("cam_downscale", 96))
    if "view" not in cfg["buttons"]:
        raise SystemExit("Add `view: 3` under `buttons:` in config.yaml and bind vJoy button 3 to Star Citizen's camera cycle (F4).")
    vj = VJoy(cfg["vjoy_device"], cfg["axes"], cfg["buttons"])
    pulse = cfg.get("probe_pulse_s", 0.12)

    def press():
        vj.set(buttons={"view": True}); time.sleep(pulse); vj.set(buttons={"view": False}); time.sleep(2.0)

    try:
        print("Camera check. Arena Commander free flight, ship stopped, COCKPIT view, window focused. Starting in 5 s.")
        time.sleep(5)
        a1 = _median_frame(grab); time.sleep(1.0); a2 = _median_frame(grab)
        same = cam_dist(a1, a2)
        press(); b = _median_frame(grab)
        press(); c = _median_frame(grab)
        d_ab, d_ac, d_bc = cam_dist(a1, b), cam_dist(a1, c), cam_dist(b, c)
        print(f"  same view a second apart : {same:.3f}")
        print(f"  after 1 press (A -> B)   : {d_ab:.3f}   mean brightness {cam_mean(a1):.0f} -> {cam_mean(b):.0f}")
        print(f"  after 2 presses (A -> C) : {d_ac:.3f}   (should be close to the 'same view' number if the key toggles two views)")
        print(f"  B versus C               : {d_bc:.3f}")
        if d_ab < max(0.15, 3 * same):
            print("RESULT: the view did not change clearly. Check that vJoy button 3 is bound to the camera cycle (F4 by default) in Star "
                  "Citizen, and that the ship is in a cockpit view. If it did switch, drag a better `cam` box with `python run.py calibrate` "
                  "(a box whose content differs a lot between the two views).")
        else:
            thr = round((max(same, d_ac) + d_ab) / 2, 2)
            print(f"RESULT: the key works and the views differ clearly. Set `cam_state_thr: {thr}` in config.yaml.")
            if d_ac > 0.5 * d_ab:
                print("  Note: two presses did not bring the cockpit view back, so the camera cycles through more than two views. The harness "
                      "presses until the starting view returns (up to 4 times).")
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
            im = cv2.cvtColor(im, cv2.COLOR_GRAY2BGR)
            cv2.putText(im, f"{t[e] + dt:.1f}s", (4, 14), cv2.FONT_HERSHEY_SIMPLEX, 0.45, (0, 255, 255), 1)
            row.append(im)
        tiles.append(np.hstack(row))
    sheet = np.vstack(tiles)
    out = d / "camstrip.png"
    cv2.imwrite(str(out), sheet)
    print(f"{len(edges)} presses -> {out}")
