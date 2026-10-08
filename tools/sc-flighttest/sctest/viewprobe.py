"""Camera-key probe logic, shared by the live recorder and the offline analysis (so both read a test the same way).

Star Citizen's camera key cycles THREE views: cockpit -> external A -> external B -> cockpit. Each press does a short
fade-out, a hard CUT (the picture changes completely: consecutive-frame distance above 1, against 0.15 at most for any
roll or drift), then a fade-in of about 0.7 s. The HUD digits are only readable in the cockpit view, and for about a
second after cutting back to it.

What this class tells you, frame by frame:
  * which presses took effect ('cut') and which did nothing ('ignored'), judged from the picture change itself, which
    still works on a nearly black screen (the cut is about 1.0 even when the whole frame averages 5/255);
  * BLACK CHECKS: whenever the screen is suspected to be black (dark for a while, or the HUD gone), an extra press is made
    straight away and every 0.7 s while it lasts. If the camera switches, the pilot was not truly blacked out; if it does
    nothing, the blackout is real (true_blackout_at). This is the arbiter, not the brightness;
  * whether we are in the cockpit view, and whether the HUD digits are trustworthy right now (hud_valid);
  * whether the screen has been black for a while (dark_sustained), in any view;
  * when the key stopped working (probe_ignore_n ignored presses in a row; key_lost_at is the first of them).
It never decides to let go of the controls: a black screen is not the end of a test (a pilot can regain vision by
counter-strafing), so the recorder keeps flying and only logs.
"""
from __future__ import annotations
import numpy as np
from .capture import cam_dist, cam_mean

DEFAULTS = dict(
    probe_views=3,              # how many views the camera key cycles through (camcheck counts them)
    probe_cut_thr=0.5,          # consecutive-frame distance that counts as a camera cut
    probe_cut_window_s=0.8,     # a press must cut within this long
    probe_ignore_n=2,           # this many ignored presses in a row = the key has stopped working
    probe_dark_abs=60.0,        # a probe frame darker than this (0-255) is black (an upper cap)...
    probe_dark_frac=0.5,        # ...or darker than this fraction of the cockpit view's own brightness (whichever is lower)
    probe_dark_hold_s=0.5,      # black this long = sustained (a camera fade-out is black for only about 0.2 s)
    probe_cockpit_thr=0.55,     # distance to the cockpit reference below which a bright frame is the cockpit view
    probe_hud_settle_s=1.2,         # HUD digits are trusted this long after cutting back to the cockpit
    probe_gap_s=1.0,            # seconds between presses while in an external view
    probe_cockpit_dwell_s=2.0,  # seconds to stay in the cockpit view before the next press (HUD samples)
    probe_check_gap_s=0.7,      # seconds between black-check presses while the screen stays black
    probe_blind_max=24.0,       # a frame whose brightest pixel is below this (0-255) is pure black: a cut could not show, so the press is 'blind', not 'ignored'
)


def params(cfg: dict) -> dict:
    return {k: float(cfg.get(k, v)) for k, v in DEFAULTS.items()}


class ViewProbe:
    def __init__(self, cfg: dict, base_frame, first_press_at: float = float("inf")):
        self.p = params(cfg)
        self.base = np.asarray(base_frame)
        self.base_mean = cam_mean(self.base)
        self.dark_thr = min(self.p["probe_dark_abs"], self.p["probe_dark_frac"] * self.base_mean)
        self.prev = None
        self.view_idx = 0                      # 0 cockpit, 1 external A, 2 external B (counted from the cuts)
        self.last_cut = -1e9
        self.last_press = -1e9
        self.next_press = first_press_at
        self.pending: list[dict] = []
        self.log: list[dict] = []              # one entry per press: {t, outcome: cut|ignored|dark, cut_t, idx_after}
        self.stray_cuts: list[float] = []
        self.resyncs: list[dict] = []          # times the picture disagreed with the cut count (a camera switch we did not see)
        self.consec_ignored = 0
        self.first_ignored = None
        self.key_lost_at = None
        self.key_back_at = None
        self.dark_since = None
        self.mean = self.base_mean
        self.maxv = 255.0
        self.step = 0.0
        self.d0 = 0.0
        self.dark = False
        self.dark_sustained = False

    # --- live use -----------------------------------------------------------------------------------
    def due(self, t: float) -> bool:
        return t >= self.next_press

    def press(self, t: float, kind: str = "cycle", level: float | None = None):
        """kind: 'cycle' (the regular cadence), 'check' (black check) or 'restore'. level: darkness 0-1 when known."""
        self.pending.append({"t": float(t), "cut_t": None, "kind": kind, "level": level, "dark": bool(self.dark)})
        self.last_press = float(t)
        self.next_press = float("inf")         # until this press is judged

    def check_due(self, t: float, suspected: bool) -> bool:
        """A black check is due: the screen is suspected black, nothing is waiting to be judged, and the last press is old enough."""
        return suspected and not self.pending and (t - self.last_press) >= self.p["probe_check_gap_s"]

    def update(self, t: float, frame) -> None:
        f = np.asarray(frame)
        self.mean = cam_mean(f)
        self.maxv = float(np.max(f))
        self.step = cam_dist(f, self.prev) if self.prev is not None else 0.0
        self.prev = f
        self.d0 = cam_dist(f, self.base)
        self.dark = self.mean < self.dark_thr
        self.dark_since = (t if self.dark_since is None else self.dark_since) if self.dark else None
        self.dark_sustained = self.dark_since is not None and t - self.dark_since >= self.p["probe_dark_hold_s"]
        if self.step >= self.p["probe_cut_thr"]:
            self._cut(t)
        for pr in list(self.pending):          # presses that had their chance and did not cut
            if t - pr["t"] > self.p["probe_cut_window_s"]:
                self.pending.remove(pr)
                self._ignored(t, pr)
        bright = self.mean >= 0.7 * self.base_mean
        if bright and t - self.last_cut > 0.8 and not self.pending:     # re-sync the view count when the picture is clear
            if self.d0 < self.p["probe_cockpit_thr"]:
                if self.view_idx != 0:
                    self.resyncs.append({"t": round(t, 3), "counted": self.view_idx, "seen": "cockpit"})
                self.view_idx = 0
            elif self.view_idx == 0:
                self.resyncs.append({"t": round(t, 3), "counted": 0, "seen": "external"})
                self.view_idx = 1

    def _cut(self, t: float):
        self.view_idx = (self.view_idx + 1) % int(self.p["probe_views"])
        self.last_cut = t
        if self.pending:
            pr = self.pending.pop(0)
            pr["cut_t"] = t
            self.log.append({"t": pr["t"], "kind": pr["kind"], "level": pr["level"], "dark": pr["dark"], "outcome": "cut",
                             "cut_t": round(t, 3), "idx_after": self.view_idx})
            if self.consec_ignored >= self.p["probe_ignore_n"] and self.key_back_at is None:
                self.key_back_at = pr["t"]
            self.consec_ignored, self.first_ignored = 0, None
            gap = self.p["probe_cockpit_dwell_s"] if self.view_idx == 0 else self.p["probe_gap_s"]
            self.next_press = t + gap
        else:
            self.stray_cuts.append(round(t, 3))

    def _ignored(self, t: float, pr: dict):
        if self.maxv < self.p["probe_blind_max"]:          # pure black: nothing could show whether the key worked
            self.log.append({"t": pr["t"], "kind": pr["kind"], "level": pr["level"], "dark": pr["dark"], "outcome": "blind",
                             "cut_t": None, "idx_after": self.view_idx})
            self.next_press = t + self.p["probe_gap_s"]
            return
        self.log.append({"t": pr["t"], "kind": pr["kind"], "level": pr["level"], "dark": pr["dark"], "outcome": "ignored",
                         "cut_t": None, "idx_after": self.view_idx})
        self.consec_ignored += 1
        self.first_ignored = pr["t"] if self.first_ignored is None else self.first_ignored
        if self.consec_ignored >= self.p["probe_ignore_n"] and self.key_lost_at is None:
            self.key_lost_at = self.first_ignored
        self.next_press = t + self.p["probe_gap_s"]

    # --- state ---------------------------------------------------------------------------------------
    @property
    def cockpit(self) -> bool:
        return self.view_idx == 0

    def hud_valid(self, t: float) -> bool:
        """HUD digits can be trusted: cockpit view, not just cut back to it, no press waiting to be judged."""
        return self.cockpit and not self.pending and (t - self.last_cut) >= self.p["probe_hud_settle_s"]

    def dark_press_plan(self):
        """Presses to make while the screen is black, chosen so that a working key ends in a visibly different state
        (cockpit vs not) from a dead one. Returns (n, expected_cockpit_if_it_works, ambiguous)."""
        if self.pending:
            return 1, None, True
        idx, nv = self.view_idx, int(self.p["probe_views"])
        n = 1 if idx == 0 else nv - idx
        return n, ((idx + n) % nv == 0), False

    def summary(self) -> dict:
        outs = [e["outcome"] for e in self.log]
        checks = [e for e in self.log if e["kind"] == "check" or e["dark"]]
        dead = [e["t"] for e in checks if e["outcome"] == "ignored"]
        alive = [e["t"] for e in checks if e["outcome"] == "cut"]
        return {"presses": len(outs), "cuts": outs.count("cut"), "ignored": outs.count("ignored"), "blind": outs.count("blind"),
                "black_checks": len(checks), "black_checks_worked": len(alive), "black_checks_dead": len(dead),
                "true_blackout_at": dead[0] if dead else None,
                "true_blackout_doubt": bool(dead and any(r["t"] > dead[0] for r in self.resyncs)),   # a switch went unseen after it: the "dead" press may have worked
                "resyncs": self.resyncs,          # first press made on a black screen that did nothing
                "conscious_dark_at": alive[0] if alive else None,       # first press made on a black screen that DID switch the camera
                "key_lost_at": self.key_lost_at, "key_back_at": self.key_back_at, "stray_cuts": self.stray_cuts,
                "log": self.log}


def replay(t, cam, press_times, cfg: dict, t_on: float) -> dict:
    """Run the same logic over a recorded test (cam frames and press times, both in recording time).
    Returns the summary plus per-frame arrays: view_idx, cockpit, hud_valid, dark, dark_sustained, step, d0, mean."""
    t = np.asarray(t, float)
    pre = np.where(t < t_on)[0]
    base_frames = [cam[i] for i in pre] or [cam[0]]
    base = np.median(np.stack([np.asarray(f, np.float32) for f in base_frames]), axis=0)
    vp = ViewProbe(cfg, base)
    presses = sorted((float(x), "cycle") if not isinstance(x, (tuple, list)) else (float(x[0]), x[1]) for x in press_times)
    k = 0
    n = len(t)
    out = {key: np.zeros(n) for key in ("view_idx", "hud_valid", "dark", "dark_sustained", "step", "d0", "mean")}
    for i in range(n):
        while k < len(presses) and presses[k][0] <= t[i]:
            vp.press(presses[k][0], presses[k][1]); k += 1
        vp.update(t[i], cam[i])
        out["view_idx"][i] = vp.view_idx
        out["hud_valid"][i] = vp.hud_valid(t[i])
        out["dark"][i] = vp.dark
        out["dark_sustained"][i] = vp.dark_sustained
        out["step"][i] = vp.step
        out["d0"][i] = vp.d0
        out["mean"][i] = vp.mean
    res = vp.summary()
    res["base_mean"] = vp.base_mean
    res["dark_thr"] = vp.dark_thr
    res["frames"] = out
    return res
