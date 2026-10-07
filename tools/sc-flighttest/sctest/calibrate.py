"""Drag boxes over the HUD readouts on a live screenshot; saves them as screen fractions."""
from __future__ import annotations
import time
import yaml
from pathlib import Path
from .capture import Grabber, frac_to_box, brightness
from . import ocr

LABELS = {"speed": "SPEED digits only (e.g. 225) - not 'm/s'",
          "g": "G number only (e.g. 0.0) - not the 'G'",
          "ab": "AB boost percent (e.g. 100%)",
          "view": "(optional, only used if roll_view: true) open sky for camera roll tracking; c to skip"}


def calibrate(cfg_path: Path, monitor: int | None):
    import cv2, mss
    cfg = yaml.safe_load(cfg_path.read_text())
    if monitor is not None:
        cfg["monitor"] = monitor
    with mss.mss() as s:
        mons = s.monitors
    print("Monitors:", {i: (m["width"], m["height"]) for i, m in enumerate(mons) if i})
    print(f"Using monitor {cfg['monitor']}. Switch to Star Citizen with the HUD visible; screenshot in 5 s...")
    time.sleep(5)
    g = Grabber(cfg["monitor"], {})
    img = g.full_frame().copy()
    mon = g.mon
    scale = min(1.0, 1600 / img.shape[1])
    small = cv2.resize(img, None, fx=scale, fy=scale)
    for key, label in LABELS.items():
        r = cv2.selectROI(f"Drag box: {label}  (Enter=ok, c=keep default)", small, showCrosshair=True)
        cv2.destroyAllWindows()
        x, y, w, h = r
        if w > 2 and h > 2:
            cfg["roi"][key] = [round(x / scale / mon["width"], 4), round(y / scale / mon["height"], 4),
                               round(w / scale / mon["width"], 4), round(h / scale / mon["height"], 4)]
            print(f"  {key}: {cfg['roi'][key]}")
        else:
            print(f"  {key}: kept {cfg['roi'].get(key)}")
    cfg_path.write_text(yaml.safe_dump(cfg, sort_keys=False))
    print("Saved. Run `python run.py ocrcheck` to verify the readings.")


def ocrcheck(cfg: dict, seconds: float = 10):
    g = Grabber(cfg["monitor"], {k: v for k, v in cfg["roi"].items() if k in ("speed", "g", "ab") and v})
    print("Reading the HUD for", seconds, "s (switch to the game)...")
    time.sleep(3)
    end = time.time() + seconds
    while time.time() < end:
        f = g.grab()
        vals = {k: ocr.read_number(v, {"g": "g", "ab": "pct"}.get(k, "int")) for k, v in f.items()}
        lum = max(brightness(f[k]) for k in ("speed", "g") if k in f) if f else None
        print("  ", vals, f"  HUD brightness {lum:.0f}" if lum is not None else "")
        time.sleep(0.5)


def fpscheck(cfg: dict, seconds: float = 5):
    """How fast can the HUD be captured? Compares one grab per frame with one grab per region."""
    rois = cfg["roi"]
    print("Measuring capture speed (switch to the game; starts in 3 s)...")
    time.sleep(3)
    for label, single in (("one grab per frame", True), ("one grab per region", False)):
        g = Grabber(cfg["monitor"], rois, cfg.get("view_downscale", 480), cfg.get("view_max_px", 450_000),
                    use_view=cfg.get("roll_view", False))
        g.single = single and g.single
        n, t0 = 0, time.perf_counter()
        while time.perf_counter() - t0 < seconds / 2:
            g.grab()
            n += 1
        print(f"  {label:22s}: {n / (time.perf_counter() - t0):5.1f} fps")
    print("Tests need >= 30 fps (60 is ideal). The runner uses one grab per frame.")
