"""Region capture with mss. Regions are fractions of the chosen monitor.

Each mss grab on a game screen can block for a whole display refresh (~16.7 ms at 60 Hz), so grabbing
four regions separately caps capture at ~15 fps. Instead, ONE rectangle covering every region is
grabbed per frame and the regions are cropped out of it in memory.
"""
from __future__ import annotations
import numpy as np

UNION_MAX_PX = 3_000_000   # above this the union grab gets slow; fall back to separate grabs


def frac_to_box(frac, mon):
    l, t, w, h = frac
    return {"left": mon["left"] + int(round(l * mon["width"])),
            "top": mon["top"] + int(round(t * mon["height"])),
            "width": max(4, int(round(w * mon["width"]))),
            "height": max(4, int(round(h * mon["height"])))}


def shrink_box(box, max_px):
    """Shrink a capture box around its centre (same aspect) to at most max_px pixels."""
    w, h = box["width"], box["height"]
    if w * h <= max_px:
        return box
    f = (max_px / (w * h)) ** 0.5
    nw, nh = int(w * f), int(h * f)
    return {"left": box["left"] + (w - nw) // 2, "top": box["top"] + (h - nh) // 2, "width": nw, "height": nh}


def union_box(boxes):
    l = min(b["left"] for b in boxes)
    t = min(b["top"] for b in boxes)
    r = max(b["left"] + b["width"] for b in boxes)
    btm = max(b["top"] + b["height"] for b in boxes)
    return {"left": l, "top": t, "width": r - l, "height": btm - t}


class Grabber:
    def __init__(self, monitor_index: int, rois: dict, view_downscale: int = 480, view_max_px: int = 450_000,
                 use_view: bool = False, cam_w: int = 96):
        import mss
        self.sct = mss.mss()
        if monitor_index >= len(self.sct.monitors):
            raise SystemExit(f"monitor {monitor_index} not found; mss sees {len(self.sct.monitors)-1} monitors")
        self.mon = self.sct.monitors[monitor_index]
        self.boxes = {k: frac_to_box(v, self.mon) for k, v in rois.items()
                      if v and (k != "view" or use_view)}
        if "view" in self.boxes:
            self.boxes["view"] = shrink_box(self.boxes["view"], view_max_px)
        self.view_w = view_downscale
        self.cam_w = cam_w
        self.union = union_box(list(self.boxes.values())) if self.boxes else None
        self.single = bool(self.union) and self.union["width"] * self.union["height"] <= UNION_MAX_PX

    def _post(self, k, img):
        if k == "cam":                                    # centre of the screen, small and grey: the camera-key probe
            import cv2
            g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            h = max(4, int(round(g.shape[0] * self.cam_w / g.shape[1])))
            return cv2.resize(g, (self.cam_w, h), interpolation=cv2.INTER_AREA)
        if k == "view":
            import cv2
            g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
            h = int(round(g.shape[0] * self.view_w / g.shape[1]))
            img = cv2.resize(g, (self.view_w, h), interpolation=cv2.INTER_AREA)
        return img

    def grab(self) -> dict:
        out = {}
        if self.single:
            big = np.asarray(self.sct.grab(self.union))[:, :, :3]       # BGRA -> BGR, one grab per frame
            ux, uy = self.union["left"], self.union["top"]
            for k, b in self.boxes.items():
                x, y = b["left"] - ux, b["top"] - uy
                out[k] = self._post(k, np.ascontiguousarray(big[y:y + b["height"], x:x + b["width"]]))
        else:
            for k, b in self.boxes.items():
                out[k] = self._post(k, np.asarray(self.sct.grab(b))[:, :, :3])
        return out

    def full_frame(self):
        return np.asarray(self.sct.grab(self.mon))[:, :, :3]


def brightness(img) -> float:
    """Brightness of the brightest pixels in a crop (98th percentile, 0-255): the HUD digits.
    They fade to black when the pilot greys out / blacks out from G-LOC."""
    return float(np.percentile(np.asarray(img).max(axis=-1) if np.ndim(img) == 3 else img, 98))


def cam_mean(img) -> float:
    """Average brightness (0-255) of a probe frame: near 0 means the screen is black."""
    return float(np.mean(img))


def cam_dist(a, b) -> float:
    """How different two probe frames look, ignoring overall brightness: mean absolute difference of the two
    frames after each is divided by its own mean. About 0.05 for the same view a moment apart; a switch between
    the cockpit and the external camera is several times that. Meaningless when either frame is nearly black."""
    a = np.asarray(a, dtype=np.float32); b = np.asarray(b, dtype=np.float32)
    return float(np.mean(np.abs(a / max(a.mean(), 8.0) - b / max(b.mean(), 8.0))))
