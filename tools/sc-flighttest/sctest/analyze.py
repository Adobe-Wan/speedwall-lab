"""Summaries per test: plateau speed, time-to-thresholds, mean acceleration (G), roll rate."""
from __future__ import annotations
import csv, json, math
from pathlib import Path
import numpy as np

G0 = 9.80665


def load(d: Path):
    with open(d / "series.csv") as f:
        rows = list(csv.DictReader(f))
    cols = {k: np.array([float(r[k]) if r[k] not in ("", "nan") else np.nan for r in rows]) for k in rows[0]}
    meta = json.loads((d / "meta.json").read_text())
    return cols, meta


def active_window(cols, meta):
    t = cols["t"]
    t_on = meta["pre_s"]
    t_off = meta["pre_s"] + sum(s["t"] for s in meta["steps"])
    return t, t_on, t_off


def roll_from_speed(t, v, a_hint=None, w_min=0.05, w_max=6.5):
    """Roll rate from the speed oscillation of a rolling ship that holds a sideways strafe (decoupled).

    The strafe thrust is fixed to the ship, so rolling spins it at the roll rate w. Velocity then
    traces a circle of radius R = a / w around a fixed centre c, and the HUD speed is
        |v|^2 = c^2 + R^2 + 2 c R cos(w t + phi),
    which is linear in (P, Q, S) = (c^2 + R^2, 2cR cos phi, -2cR sin phi) for a fixed w. So: grid-search
    w, least squares for the rest, refine. Returns dict(w_dps, a_G, R, c, rms, cycles) or None."""
    ok = ~np.isnan(v)
    t, v = t[ok], v[ok]
    if len(t) < 15:
        return None
    cuts = np.where(np.diff(t) > 0.5)[0] + 1                 # OCR dropouts split the record; a reset
    segs = np.split(np.arange(len(t)), cuts)                  # state after a gap breaks the circle model,
    seg = max(segs, key=len)                                  # so use the longest unbroken stretch
    t, v = t[seg], v[seg]
    if len(t) < 15:
        return None
    y = v * v

    def fit(w):
        X = np.column_stack([np.ones_like(t), np.cos(w * t), np.sin(w * t)])
        coef, *_ = np.linalg.lstsq(X, y, rcond=None)
        res = np.sqrt(np.clip(X @ coef, 0, None)) - v
        return float(np.sqrt(np.mean(res ** 2))), coef

    ws = np.linspace(w_min, w_max, 1300)
    errs = [fit(w)[0] for w in ws]
    k = int(np.argmin(errs))
    lo, hi = ws[max(k - 1, 0)], ws[min(k + 1, len(ws) - 1)]
    for _ in range(40):                                     # golden-section refine
        m1, m2 = lo + 0.382 * (hi - lo), lo + 0.618 * (hi - lo)
        if fit(m1)[0] < fit(m2)[0]:
            hi = m2
        else:
            lo = m1
    w = (lo + hi) / 2
    rms, (P, Q, S) = fit(w)
    A = math.hypot(Q, S)
    s1, s2 = math.sqrt(max(P + A, 0)), math.sqrt(max(P - A, 0))     # c+R and |c-R|
    r1, r2 = (s1 + s2) / 2, (s1 - s2) / 2                            # the two radii; one is R, one is c
    if a_hint:
        R = min((r1, r2), key=lambda r: abs(r * w - a_hint * G0))
    else:
        R = r2                                                       # from rest the circle starts near 0
    c = r1 if R == r2 else r2
    return {"w_dps": math.degrees(w), "a_G": R * w / G0, "R": R, "c": c, "rms": rms,
            "cycles": w * (t[-1] - t[0]) / (2 * math.pi)}


def dominant_period_dps(t, y):
    """Roll rate implied by the strongest oscillation in a series (e.g. the G meter in a corkscrew).
    Needs at least two full cycles in the window; slow drifts are removed first."""
    ok = ~np.isnan(y)
    t, y = t[ok], y[ok]
    if len(t) < 20:
        return None
    y = y - np.polyval(np.polyfit(t, y, 1), t)
    if np.std(y) < 0.2:                                       # a flat meter carries no roll information
        return None
    w_lo = max(0.3, 2 * 2 * math.pi / (t[-1] - t[0]))
    ws = np.linspace(w_lo, 7.0, 3000)
    p = [abs(np.sum(y * np.exp(-1j * w * t))) for w in ws]
    return math.degrees(ws[int(np.argmax(p))])


SCM_CAP = 225.0
HUD_LATENCY_S = 0.3   # fixture: the HUD shows an input's effect about 0.3 s after it


def release_trace(cols, meta, t_on):
    """How fast speed falls once boost is let go (tests whose boosted steps are followed by a boost-free one).

    The release is the end of the last boosted step. Times are seconds after the release as commanded; the HUD
    lags by about HUD_LATENCY_S, so the first 0.3 s are flat. rel_t_to_N is the first time the speed stays at or
    below N m/s for three samples; None means it never got there inside the recording, which is itself the answer
    to "does speed stay above the SCM cap"."""
    steps = meta.get("steps") or []
    last = max((i for i, s in enumerate(steps) if s.get("boost")), default=None)
    sp = cols.get("speed")
    if last is None or last == len(steps) - 1 or sp is None:
        return {}
    t = cols["t"]
    t_rel = t_on + sum(s["t"] for s in steps[: last + 1])
    ok = ~np.isnan(sp)
    pre = ok & (t >= t_rel - 0.5) & (t <= t_rel)
    post = ok & (t >= t_rel)
    if pre.sum() < 3 or post.sum() < 10:
        return {}
    tt, ss = t[post] - t_rel, sp[post]
    out = {"rel_start_mps": round(float(np.median(sp[pre])), 1)}
    for sec in (0.5, 1, 2, 3, 5, 8, 12, 20):
        m = np.abs(tt - sec) <= 0.1
        if m.any():
            out[f"rel_speed_at_{sec:g}s"] = round(float(np.median(ss[m])), 1)
    for thr in (400, 300, 260, 240, 230, 226):
        below = ss <= thr
        hit = [i for i in range(len(ss) - 2) if below[i] and below[i + 1] and below[i + 2]]
        out[f"rel_t_to_{thr}"] = round(float(tt[hit[0]]), 2) if hit else None
    m = (tt >= HUD_LATENCY_S) & (tt <= HUD_LATENCY_S + 1.0)
    if m.sum() > 5:
        out["rel_decel_G_first1s"] = round(float(-np.polyfit(tt[m], ss[m], 1)[0] / G0), 2)
    m = (ss <= 300) & (ss >= SCM_CAP + 10)          # the tail: just above the SCM cap, where a quadratic bleed would fade away
    if m.sum() > 8:
        out["rel_decel_G_300_to_235"] = round(float(-np.polyfit(tt[m], ss[m], 1)[0] / G0), 2)
    out["rel_end_mps"] = round(float(np.median(ss[tt >= tt.max() - 2.0])), 1)
    out["rel_end_above_scm_mps"] = round(out["rel_end_mps"] - SCM_CAP, 1)
    out["rel_recorded_s"] = round(float(tt.max()), 1)
    return out


PROBE_RATIO = 2.5     # a press "toggled" when the view changed this many times more than it does between presses...
PROBE_MIN = 0.15      # ...and by at least this much (camera-probe distance, see capture.cam_dist)
PROBE_DARK = 14.0     # a probe frame darker than this (0-255) is black: nothing can be seen either way


def probe_report(cols, meta, t_on):
    """Camera-key probe: for each press, did the view change? A pilot who is greying out can still switch camera until
    fully blacked out, so the last press that took effect marks when control was lost.

    Each press is classified from the centre-of-screen frames: 'toggled' (the view changed clearly more than it changes
    between presses), 'no_change', or 'dark' (the screen was black, so it can't be told). The press made in the dark after
    the blackout is judged afterwards, by comparing the camera once vision is back (meta: dark_press_worked)."""
    if "view" not in cols or "cam_chg" not in cols:
        return {}
    t, chg, mean = cols["t"], cols["cam_chg"], cols["cam_mean"]
    view = cols["view"]
    press_t = t[np.where((view[1:] > 0.5) & (view[:-1] <= 0.5))[0] + 1]
    press_t = press_t[press_t >= t_on]
    if not len(press_t):
        return {}
    quiet = (t >= t_on) & ~np.isnan(chg)
    for tp in press_t:
        quiet &= (t < tp) | (t > tp + 0.7)
    noise = max(float(np.median(chg[quiet])) if quiet.sum() > 10 else 0.0, 0.03)
    states = []
    for tp in press_t:
        w = (t >= tp + 0.15) & (t <= tp + 0.6) & ~np.isnan(chg)
        if not w.any():
            continue
        score, bright = float(np.max(chg[w])), float(np.mean(mean[w]))
        if bright < PROBE_DARK:
            s = "dark"
        else:
            s = "toggled" if score >= PROBE_MIN and score / noise >= PROBE_RATIO else "no_change"
        states.append((round(float(tp - t_on), 2), s))
    out = {"probe_presses": len(states), "probe_toggled": sum(s == "toggled" for _, s in states),
           "probe_noise": round(noise, 3), "probe_states": " ".join(f"{t:g}:{s}" for t, s in states)}
    toggled = [t for t, s in states if s == "toggled"]
    if toggled:
        out["probe_last_toggle_s"] = toggled[-1]
        lost = [t for t, s in states if t > toggled[0] and s in ("no_change", "dark")]
        if lost:
            out["probe_control_lost_s"] = lost[0]     # first press after control was working that did nothing (or couldn't be seen)
    dark = [t for t, s in states if s == "dark"]
    if dark:
        out["probe_first_dark_s"] = dark[0]
    for k in ("dark_press_at", "dark_presses", "presses_since_black", "dark_press_worked", "dark_press_dist", "cam_final_dist",
              "cam_restore_presses"):
        if meta.get(k) is not None:
            out[k if k.startswith(("dark", "presses")) else f"probe_{k}"] = meta[k]
    return out


def summarize(d: Path) -> dict:
    cols, meta = load(d)
    t, t_on, t_off = active_window(cols, meta)
    out = {"test": meta["id"], "fps": meta.get("fps_actual"),
           "start_speed": meta.get("start_speed"), "gloc_at": meta.get("gloc_at")}
    if meta.get("grey_at") is not None:
        out["grey_at"] = meta["grey_at"]                        # HUD dimmed to 80 %: the grey-out
        if meta.get("gloc_at") is not None:
            out["grey_to_black_s"] = round(meta["gloc_at"] - meta["grey_at"], 2)   # control kept while greyed out
    if meta.get("recovery_s") is not None:
        out["recovery_s"] = meta["recovery_s"]                  # seconds for the HUD to come back after the let-go
    if meta.get("lat_mirrored"):
        out["lat_mirrored"] = True
    if meta.get("ease_events"):
        out["ease_events"] = meta["ease_events"]                # [s after inputs start, input scale]
        if meta.get("gloc_at") is None:
            out["sustained_scale"] = meta["ease_events"][-1][1] # the level the pilot could hold
    if meta.get("gloc_at") is not None:
        t_off = min(t_off, t_on + meta["gloc_at"])           # nothing after a blackout is valid
    sp = cols.get("speed")
    if sp is not None:
        on = (t >= t_on) & (t <= t_off) & ~np.isnan(sp)
        tt, ss = t[on] - t_on, sp[on]
        if len(ss) > 10:
            tail = ss[tt >= tt.max() - 3.0]
            plateau = float(np.median(tail))
            out["plateau_mps"] = round(plateau, 1)
            out["plateau_spread"] = round(float(np.percentile(tail, 90) - np.percentile(tail, 10)), 1)
            tm = tt >= tt.max() - 3.0
            if tm.sum() > 5:                                   # still creeping? (velocity sliding along the wall)
                out["plateau_drift_mps_per_s"] = round(float(np.polyfit(tt[tm], ss[tm], 1)[0]), 2)
            for thr in (100, 200, 300, 400, 480):
                hit = np.where(ss >= thr)[0]
                out[f"t_to_{thr}"] = round(float(tt[hit[0]]), 3) if len(hit) else None
            lo, hi = 0.15 * plateau, 0.70 * plateau   # fit the straight part, away from ramp-in and the wall
            m = (ss >= lo) & (ss <= hi)
            if m.sum() >= 5:
                k = np.polyfit(tt[m], ss[m], 1)[0]
                out["accel_G_fit"] = round(k / G0, 2)
    gcol = cols.get("g")
    if gcol is not None:
        on = (t >= t_off - 3.0) & (t <= t_off) & ~np.isnan(gcol)
        if on.sum():
            out["g_meter_end"] = round(float(np.median(gcol[on])), 1)
        act = (t >= t_on) & (t <= t_off) & ~np.isnan(gcol)
        if act.sum() > 5:
            out["g_meter_peak"] = round(float(np.percentile(gcol[act], 90)), 1)
    rot_axes = [k for k in ("roll", "pitch", "yaw") if k in cols and np.nanmax(np.abs(cols[k])) > 0]
    if rot_axes and sp is not None:
        win = (t >= t_on) & (t <= t_off)
        no_fwd = "strafe_long" not in cols or np.nanmax(np.abs(cols["strafe_long"][win])) == 0
        side = max(np.nanmax(np.abs(cols[k][win])) for k in ("strafe_lat", "strafe_vert") if k in cols)
        if no_fwd and side > 0 and len(rot_axes) == 1:        # rotation gauge: strafe + one rotation, no forward
            m = (t >= t_on + 0.7) & (t <= t_off)               # skip the thrust ramp-up
            gm = cols.get("g")
            a_hint = float(np.nanmedian(gm[m])) if gm is not None and np.any(~np.isnan(gm[m])) else None
            rf = roll_from_speed(t[m], sp[m], a_hint)
            if rf:
                out["rot_axis"] = rot_axes[0]
                out["rot_dps_osc"] = round(rf["w_dps"], 1)
                out["rot_osc_a_G"] = round(rf["a_G"], 2)
                out["rot_osc_rms_mps"] = round(rf["rms"], 2)
                out["rot_osc_cycles"] = round(rf["cycles"], 2)
        gm = cols.get("g")
        if gm is not None and not no_fwd and side > 0:       # corkscrews: G meter pulses at the roll rate
            m = (t >= t_on + 1.0) & (t <= t_off)
            if "plateau_mps" in out and out["plateau_mps"] > 20:   # only once settled at the wall
                m &= sp >= 0.98 * out["plateau_mps"]
            if m.sum() > 20:
                out["g_meter_mean_late"] = round(float(np.nanmean(gm[m])), 2)
                k = dominant_period_dps(t[m], gm[m])
                if k:
                    out["roll_dps_gmeter"] = round(k, 0)
    if "roll_rel_deg" in cols:
        from .roll import common_slope
        on = (t >= t_on + 1.0) & (t <= t_off)        # skip the first second (roll ramp-up)
        if on.sum() > 10:
            k = common_slope(t, cols["roll_seg"], cols["roll_rel_deg"], on)
            out["roll_dps_fit"] = None if math.isnan(k) else round(abs(k), 1)
            out["roll_tracked_frac"] = round(float(np.mean(~np.isnan(cols["roll_rel_deg"][on]))), 2)
    steps = meta.get("steps") or []
    if len(steps) > 1 and sp is not None and cols.get("g") is not None:
        gm = cols["g"]
        t0 = t_on
        for k, st in enumerate(steps, 1):                    # multi-step tests (e.g. reach the wall, then dodge)
            t1 = min(t0 + st["t"], t_off)
            m = (t >= t0) & (t <= t1)
            if m.sum() > 5:
                ss = sp[m]; gg = gm[m]; tt = t[m] - t0
                out[f"s{k}_speed_end"] = round(float(np.nanmedian(ss[tt >= tt.max() - 0.3])), 1)
                out[f"s{k}_g_first1s"] = round(float(np.nanmean(gg[(tt >= 0.2) & (tt <= 1.2)])), 2)
                out[f"s{k}_g_mean"] = round(float(np.nanmean(gg)), 2)
                hi = (gg > 1.0) & (tt >= 0.2)
                out[f"s{k}_g_over1_s"] = round(float(hi.sum() * np.nanmedian(np.diff(t))), 2)
            t0 = t1
    out.update(release_trace(cols, meta, t_on))
    out.update(probe_report(cols, meta, t_on))
    for k, v in (meta.get("expect") or {}).items():
        out[f"expect_{k}"] = v
    return out


def summarize_session(session: Path) -> Path:
    rows = [summarize(d) for d in sorted(session.iterdir()) if (d / "series.csv").exists()]
    keys = []
    for r in rows:
        keys += [k for k in r if k not in keys]
    out = session / "summary.csv"
    with open(out, "w", newline="") as f:
        w = csv.DictWriter(f, fieldnames=keys)
        w.writeheader()
        w.writerows(rows)
    return out
