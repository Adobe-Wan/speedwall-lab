"""Estimate roll rate from a view patch (open sky / planet through the canopy).

Each frame is matched (ORB + RANSAC similarity transform) against a keyframe. Frames that match give
the rotation since that keyframe; frames that don't are left as gaps (never extrapolated). A new
keyframe starts once rotation passes ~20 degrees or the lock is lost for a while. The roll rate is then
one common slope fitted across all keyframe segments (each with its own offset), which is robust to
gaps and accurate for slow rolls because each segment spans many frames.
"""
from __future__ import annotations
import math
import numpy as np


def _features(orb, f):
    import cv2
    return orb.detectAndCompute(cv2.GaussianBlur(f, (3, 3), 0.8), None)  # suppress pixel noise, keep stars


def _rot(bf, kd0, kd1):
    import cv2
    kp0, d0 = kd0
    kp1, d1 = kd1
    if d0 is None or d1 is None or len(kp0) < 8 or len(kp1) < 8:
        return math.nan, 0
    m = bf.match(d0, d1)
    if len(m) < 8:
        return math.nan, 0
    p0 = np.float32([kp0[x.queryIdx].pt for x in m])
    p1 = np.float32([kp1[x.trainIdx].pt for x in m])
    M, mask = cv2.estimateAffinePartial2D(p0, p1, method=cv2.RANSAC, ransacReprojThreshold=1.5,
                                          maxIters=3000, confidence=0.995)
    if M is None:
        return math.nan, 0
    n = int(mask.sum())
    scale = math.hypot(M[0, 0], M[1, 0])
    if n < 8 or abs(scale - 1.0) > 0.03:      # roll is a pure rotation; reject zoom-like garbage fits
        return math.nan, n
    return math.degrees(math.atan2(M[1, 0], M[0, 0])), n


def roll_track(frames, rekey_deg: float = 20.0, max_gap: int = 10, fast_threshold: int = 8):
    """Returns (segment_id, rel_deg, inliers) per frame. rel_deg is rotation since the segment's
    keyframe (NaN where the lock failed). + = scene rotates clockwise on screen."""
    import cv2
    orb = cv2.ORB_create(nfeatures=1500, fastThreshold=fast_threshold, edgeThreshold=15, patchSize=15)
    bf = cv2.BFMatcher(cv2.NORM_HAMMING, crossCheck=True)
    seg, rel, inl = [0], [0.0], [0]
    key = _features(orb, frames[0])
    sid, misses = 0, 0
    for f in frames[1:]:
        cur = _features(orb, f)
        r, n = _rot(bf, key, cur)
        seg.append(sid)
        rel.append(r)
        inl.append(n)
        misses = misses + 1 if math.isnan(r) else 0
        if (not math.isnan(r) and abs(r) > rekey_deg) or misses > max_gap:
            sid += 1
            key, misses = cur, 0
            seg[-1], rel[-1] = sid, 0.0          # this frame is the new keyframe (rotation 0 by definition)
    return np.array(seg), np.array(rel, float), np.array(inl)


def common_slope(t, seg, rel, mask=None):
    """Least-squares rate (deg/s) shared by all segments, each with its own intercept."""
    t, seg, rel = np.asarray(t, float), np.asarray(seg), np.asarray(rel, float)
    ok = ~np.isnan(rel) if mask is None else (~np.isnan(rel) & mask)
    num = den = 0.0
    for s in np.unique(seg[ok]):
        m = ok & (seg == s)
        if m.sum() < 3:
            continue
        tc, ac = t[m] - t[m].mean(), rel[m] - rel[m].mean()
        num += float((tc * ac).sum())
        den += float((tc * tc).sum())
    return num / den if den > 0 else math.nan
