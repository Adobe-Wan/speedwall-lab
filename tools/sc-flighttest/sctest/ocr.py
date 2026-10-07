"""Read HUD numbers from captured regions (offline, after a run; also used live for braking)."""
from __future__ import annotations
import re
import numpy as np

_engine = None


def engine():
    global _engine
    if _engine is None:
        from rapidocr_onnxruntime import RapidOCR
        _engine = RapidOCR()
    return _engine


def trim(img_bgr: np.ndarray, pad: int = 4) -> np.ndarray:
    """Crop to the bright text (HUD digits) so a lone '0' isn't lost in an empty box."""
    v = img_bgr.max(axis=2).astype(np.float32)
    if v.max() < 40:
        return img_bgr
    mask = v > (v.min() + 0.5 * (v.max() - v.min()))
    ys, xs = np.where(mask)
    y0, y1 = max(ys.min() - pad, 0), min(ys.max() + pad + 1, v.shape[0])
    x0, x1 = max(xs.min() - pad, 0), min(xs.max() + pad + 1, v.shape[1])
    return img_bgr[y0:y1, x0:x1]


def prep(img_bgr: np.ndarray) -> np.ndarray:
    """Trim to the text, then upscale so the recognizer sees ~48 px tall text."""
    import cv2
    img_bgr = np.ascontiguousarray(trim(img_bgr))
    h = img_bgr.shape[0]
    f = max(1.0, 48.0 / max(h, 1))
    return cv2.resize(img_bgr, None, fx=f, fy=f, interpolation=cv2.INTER_CUBIC) if f > 1 else img_bgr


FIX = str.maketrans({"O": "0", "o": "0", "D": "0", "Q": "0", "l": "1", "I": "1", "|": "1",
                     "S": "5", "B": "8", ",": ".", "．": ".", "。": "."})
PATTERN = {"int": re.compile(r"\d{1,4}"), "g": re.compile(r"\d{1,2}\.\d"), "pct": re.compile(r"\d{1,3}")}


def _recognize(imgs):
    """Recognizer only: each region IS one text line (skips the detector, which misses tiny crops)."""
    eng = engine()
    rec = getattr(eng, "text_recognizer", None) or getattr(eng, "text_rec", None)
    if rec is not None:
        res = rec(imgs)
        res = res[0] if isinstance(res, tuple) else res
        return [(str(r[0]), float(r[1])) for r in res]
    out = []
    for im in imgs:  # very old/new API without a separate recognizer
        r, _ = eng(im)
        out.append((r[0][1], float(r[0][2])) if r else ("", 0.0))
    return out


def read_number(img_bgr: np.ndarray, kind: str = "int") -> float | None:
    """Best-scoring parse of the crop and its inverse. kind: int (speed), g (one decimal), pct (AB %)."""
    a = prep(img_bgr)
    cands = _recognize([a, 255 - a])
    pat = PATTERN[kind]
    best, parsed = None, []
    for text, score in cands:
        t = text.replace(" ", "").translate(FIX)
        if kind == "g" and "." not in t:          # recognizer dropped the decimal point: "185" -> "18.5"
            digits = re.sub(r"\D", "", t)
            t = digits[:-1] + "." + digits[-1] if len(digits) >= 2 else digits
        m = pat.search(t)
        if m:
            parsed.append(float(m.group(0)))
            if best is None or score > best[1]:
                best = (float(m.group(0)), score)
    if best is None:
        return None
    agree = len(parsed) == 2 and parsed[0] == parsed[1]
    return best[0] if best[1] >= 0.4 or (agree and best[1] >= 0.1) else None


def clean_series(t: np.ndarray, y: np.ndarray, max_rate: float, half_window: int = 3) -> np.ndarray:
    """Reject isolated OCR glitches: a sample is dropped if it disagrees with the median of its
    neighbours (+/- half_window frames) by more than max_rate allows. Real step changes survive
    because the neighbours on the far side of the step agree with each other."""
    y = np.asarray(y, float)
    out = y.copy()
    n = len(y)
    for i in range(n):
        if np.isnan(y[i]):
            continue
        lo, hi = max(0, i - half_window), min(n, i + half_window + 1)
        nb = np.delete(y[lo:hi], i - lo)
        nb = nb[~np.isnan(nb)]
        if len(nb) < 2:
            continue
        span = max(t[min(hi, n) - 1] - t[lo], 1e-3)
        if abs(y[i] - np.median(nb)) > max_rate * span + 3.0:
            out[i] = np.nan
    return out
