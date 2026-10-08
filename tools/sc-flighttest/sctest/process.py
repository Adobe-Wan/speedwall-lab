"""Turn a recorded test folder into series.csv: t, commands, speed, g, ab, roll_deg."""
from __future__ import annotations
import csv, json
from pathlib import Path
import numpy as np
from . import ocr
from .capture import cam_dist, cam_mean, cam_gray, cam_red
from . import viewprobe

MAX_ACCEL = 40 * 9.81  # m/s^2, generous sanity bound for OCR glitch rejection


def _press_times(d: Path):
    """Rising edges of the vJoy view button in commands.csv, with the kind (cycle/check) the recorder logged for each."""
    with open(d / "commands.csv") as f:
        rows = list(csv.DictReader(f))
    if not rows or "view" not in rows[0]:
        return []
    tt = np.array([float(r["t"]) for r in rows]); v = np.array([float(r["view"]) for r in rows])
    return [float(tt[i]) for i in np.where((v[1:] > 0.5) & (v[:-1] <= 0.5))[0] + 1]


def _probe_replay(d: Path, t, cam, meta, pre):
    """Replay the camera-key probe offline (same code as the live run) and save probe.json."""
    presses = _press_times(d)
    if not presses:
        return None
    logged = meta.get("probe_log") or []
    out = []
    for p in presses:
        kind = "cycle"
        for e in logged:
            if abs(e["t"] - p) < 0.1:
                kind = e.get("kind", "cycle")
                break
        out.append((p, kind))
    res = viewprobe.replay(t, cam, out, meta.get("probe_cfg") or {}, pre)
    summ = {k: v for k, v in res.items() if k != "frames"}
    (d / "probe.json").write_text(json.dumps(summ, indent=1, default=lambda o: o.item() if hasattr(o, "item") else str(o)))
    return res


def _rings(img):
    """Mean grey brightness, and red share, of the centre box, the middle ring and the edge frame of a whole-screen thumbnail."""
    g = cam_gray(img)
    h, w = g.shape
    yy, xx = np.mgrid[0:h, 0:w]
    r = np.hypot((xx - (w - 1) / 2) / (w / 2), (yy - (h - 1) / 2) / (h / 2))      # 0 centre .. ~1.4 corners
    masks = {"centre": r < 0.35, "mid": (r >= 0.35) & (r < 0.8), "edge": r >= 0.8}
    out = {}
    for k, m in masks.items():
        out["lum_" + k] = float(g[m].mean())
        px = np.asarray(img, np.float32)[m]
        tot = float(px.sum())
        out["red_" + k] = float(px[:, 2].sum() / tot) if tot > px.size * 2.0 else float("nan")
    return out


def _vision_csv(d: Path, z, t, meta, rp):
    """vision.csv: the vision gradient over the test, one row per whole-screen thumbnail, for the simulator's pilot view.
    darkness (0 clear .. 1 black) of the centre, the middle ring and the edge frame, each against its own pre-test level
    (so tunnel vision shows as edge darkness running ahead of the centre); the red share of each (red-out); the HUD fade;
    the pilot's inputs; and `valid`: 1 only when the cockpit view is up and settled (other views have no baseline)."""
    tf, th = z["t_full"], z["full"]
    pre = float(meta.get("pre_s", 1.0))
    rings = [_rings(x) for x in th]
    basel = {k: float(np.nanmedian([r[k] for r, tt in zip(rings, tf) if tt < pre] or [np.nan])) for k in rings[0]}
    hud = z["hud_lum"] if "hud_lum" in z else None
    hbase = meta.get("hud_lum_base") or 255.0
    with open(d / "commands.csv") as f:
        rows = list(csv.DictReader(f))
    ct = np.array([float(r["t"]) for r in rows])
    keep = [k for k in ("strafe_long", "strafe_lat", "strafe_vert", "roll", "pitch", "yaw", "boost") if rows and k in rows[0]]
    out = d / "vision.csv"
    with open(out, "w", newline="") as f:
        w = csv.writer(f)
        w.writerow(["t_s", "valid", "view_idx", "dark_centre", "dark_mid", "dark_edge", "red_centre", "red_mid", "red_edge",
                    "red_excess_centre", "red_excess_edge", "hud_level"] + keep)
        for tt, r in zip(tf, rings):
            i = int(np.argmin(np.abs(t - tt)))
            vi = int(rp["frames"]["view_idx"][i]) if rp else 0
            valid = int(bool(rp["frames"]["hud_valid"][i])) if rp else 1
            dk = lambda name: float(np.clip(1.0 - r["lum_" + name] / max(basel["lum_" + name], 1.0), 0.0, 1.0))
            rc, re_ = r["red_centre"], r["red_edge"]
            hl = "" if hud is None or np.isnan(hud[i]) else f"{min(1.0, hud[i] / hbase):.3f}"
            j = int(np.argmin(np.abs(ct - tt)))
            w.writerow([f"{tt - pre:.2f}", valid, vi, f"{dk('centre'):.3f}", f"{dk('mid'):.3f}", f"{dk('edge'):.3f}",
                        f"{rc:.3f}", f"{r['red_mid']:.3f}", f"{re_:.3f}",
                        f"{rc - basel['red_centre']:.3f}", f"{re_ - basel['red_edge']:.3f}", hl]
                       + [rows[j][k] for k in keep])
    return out


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
    if "cam" in z:                                        # centre-of-screen probe frames: brightness, red share, camera state
        cam = z["cam"]
        meta = json.loads((d / "meta.json").read_text())
        pre = float(meta.get("pre_s", 1.0))
        base_mean = max(float(np.median([cam_mean(cam[i]) for i in range(n) if t[i] < pre] or [cam_mean(cam[0])])), 1.0)
        cols["cam_mean"] = np.array([cam_mean(cam[i]) for i in idx])
        cols["dark_level_cam"] = np.clip(1.0 - cols["cam_mean"] / base_mean, 0.0, 1.0)
        cols["cam_red"] = np.array([cam_red(cam[i]) for i in idx])
        cols["cam_red_edge"] = np.array([cam_red(cam[i], edge=0.15) for i in idx])
        if "dark_level" in z:
            cols["dark_level"] = z["dark_level"][idx]       # what the recorder saw live (nan outside the cockpit view)
        cols_probe = _probe_replay(d, t, cam, meta, pre)
        if cols_probe is not None:
            fr = cols_probe["frames"]
            for key in ("view_idx", "hud_valid", "dark_sustained", "step", "d0"):
                cols["cam_" + key] = fr[key][idx]
    if "full" in z and "t_full" in z:
        _vision_csv(d, z, t, json.loads((d / "meta.json").read_text()), locals().get("cols_probe"))
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
