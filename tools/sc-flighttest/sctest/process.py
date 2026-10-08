"""Turn a recorded test folder into series.csv: t, commands, speed, g, ab, roll_deg."""
from __future__ import annotations
import csv, json
from pathlib import Path
import numpy as np
from . import ocr
from .capture import cam_dist, cam_mean

MAX_ACCEL = 40 * 9.81  # m/s^2, generous sanity bound for OCR glitch rejection


def process_dir(d: Path, stride: int = 1, log=print) -> Path:
    with np.load(d / "frames.npz") as npz:          # load each array ONCE (NpzFile re-reads on every access)
        z = {k: npz[k] for k in npz.files}
    t = z["t"]
    n = len(t)
    idx = np.arange(0, n, stride)
    cols = {"t": t[idx]}
    for key, kind, rate in (("speed", "int", MAX_ACCEL), ("g", "g", 400.0), ("ab", "pct", 400.0)):
        if key in z:
            vals = []
            for k, i in enumerate(idx):
                v = ocr.read_number(z[key][i], kind)
                vals.append(np.nan if v is None else v)
                if k and k % 300 == 0:
                    log(f"    {key}: {k}/{len(idx)} frames")
            cols[key] = ocr.clean_series(t[idx], np.array(vals, float), rate)
    if "hud_lum" in z:
        cols["hud_lum"] = z["hud_lum"][idx]
    if "cam" in z:                                        # camera-key probe: brightness, and change versus 0.5 s earlier
        fps = n / max(float(t[-1] - t[0]), 1e-6)
        lag = max(1, int(round(0.5 * fps)))
        cam = z["cam"]
        cols["cam_mean"] = np.array([cam_mean(cam[i]) for i in idx])
        cols["cam_chg"] = np.array([cam_dist(cam[i], cam[max(0, i - lag)]) if i >= lag else np.nan for i in idx])
    if "view" in z:
        from .roll import roll_track
        seg, rel, inl = roll_track([z["view"][i] for i in idx])
        cols["roll_seg"], cols["roll_rel_deg"], cols["roll_inliers"] = seg, rel, inl
    cmd = {}
    with open(d / "commands.csv") as f:
        rows = list(csv.DictReader(f))
    for k in rows[0]:
        if k != "t":
            cmd[k] = np.array([float(rows[i][k]) for i in idx])
    out = d / "series.csv"
    keys = list(cols) + list(cmd)
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(keys)
        for r in range(len(idx)):
            w.writerow([f"{cols[k][r]:.4f}" if k in cols else f"{cmd[k][r]:g}" for k in keys])
    ok = np.mean(~np.isnan(cols.get("speed", np.array([np.nan]))))
    log(f"  {d.name}: {len(idx)} rows, speed read on {ok:.0%} of frames -> {out.name}")
    return out
