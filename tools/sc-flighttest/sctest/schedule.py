"""Test definitions: a test is a list of timed steps holding exact inputs."""
from __future__ import annotations
from dataclasses import dataclass, field, replace

BUTTONS = ("boost", "brake", "view")


@dataclass
class Step:
    t: float
    axes: dict = field(default_factory=dict)
    buttons: dict = field(default_factory=dict)


@dataclass
class Test:
    id: str
    note: str
    steps: list
    expect: dict
    pre_s: float = 1.0
    post_s: float = 1.5
    # What to do when the pilot greys out / blacks out / reds out:
    #  "release": drop every input on a HUD blackout and end the test (the old default; a black screen is NOT the end
    #     for a real pilot, so use it only where the onset time is all you want).
    #  "ease": scale the ease_axes down by ease_step each time the HUD dims, and keep flying, the way a pilot
    #     manages G-LOC; the level that stops the dimming is the sustainable one. Below ease_min, release.
    #  "reverse": when the screen is practically black, wait reverse_delay_s (the black checks run meanwhile), then flip the
    #     direction of reverse_axes (a pilot counter-strafes and reverses the roll to stay conscious), hold that until
    #     vision is back (or reverse_hold_s), resume, and repeat up to reverse_max times. Logged in meta "reversals".
    #  "hold": never intervene; only record (the inputs run to the end of the test whatever the screen looks like).
    gloc: str = "release"
    reverse_axes: tuple = ("strafe_lat", "strafe_vert", "roll")
    reverse_at: float = 0.6        # darkness (0 clear .. 1 black, from the cockpit view) at which the screen counts as practically black
    reverse_delay_s: float = 0.8
    reverse_hold_s: float = 4.0
    reverse_max: int = 4
    ease_axes: tuple = ("strafe_lat", "strafe_long", "strafe_vert", "roll")
    ease_step: float = 0.15
    ease_min: float = 0.25
    # Camera-key probe: press the vJoy "view" button (bound to Star Citizen's camera cycle, F4 by default) every
    # `probe` seconds while the inputs are held. A pilot who is greying out can still switch to the external camera
    # until fully blacked out; the probe records when the presses stop taking effect. 0 = off.
    probe: float = 0.0

    @property
    def uses_boost(self) -> bool:
        return any(s.buttons.get("boost") for s in self.steps)

    @property
    def uses_lateral(self) -> bool:
        return any(s.axes.get("strafe_lat") for s in self.steps)

    def mirrored(self) -> "Test":
        """Same test with left/right strafe swapped. The ship is left/right symmetric, so results are the same; flying
        every second lateral test mirrored cancels the sideways drift that a pitch flip does not."""
        steps = [Step(s.t, {k: (-v if k == "strafe_lat" else v) for k, v in s.axes.items()}, dict(s.buttons)) for s in self.steps]
        return replace(self, steps=steps)

    @property
    def duration(self) -> float:
        return self.pre_s + sum(s.t for s in self.steps) + self.post_s

    def inputs_at(self, t: float):
        """(axes, buttons) commanded at time t since recording start. Unlisted controls = 0 / released."""
        t -= self.pre_s
        if t < 0:
            return {}, {}
        for s in self.steps:
            if t < s.t:
                return s.axes, s.buttons
            t -= s.t
        return {}, {}


def parse(doc: dict, known_axes) -> list[Test]:
    tests = []
    for d in doc["tests"]:
        steps = []
        for s in d["steps"]:
            s = dict(s)
            t = float(s.pop("t"))
            buttons = {b: bool(s.pop(b)) for b in BUTTONS if b in s}
            unknown = set(s) - set(known_axes)
            if unknown:
                raise ValueError(f"test {d['id']}: unknown controls {sorted(unknown)}")
            steps.append(Step(t, {k: float(v) for k, v in s.items()}, buttons))
        gloc = d.get("gloc", "release")
        if gloc not in ("release", "ease", "reverse", "hold"):
            raise ValueError(f"test {d['id']}: gloc must be 'release', 'ease', 'reverse' or 'hold'")
        ease_axes = tuple(d.get("ease_axes", Test.ease_axes))
        rev_axes = tuple(d.get("reverse_axes", Test.reverse_axes))
        unknown = (set(ease_axes) | set(rev_axes)) - set(known_axes)
        if unknown:
            raise ValueError(f"test {d['id']}: unknown ease_axes/reverse_axes {sorted(unknown)}")
        tests.append(Test(id=d["id"], note=d.get("note", ""), steps=steps, expect=d.get("expect", {}),
                          pre_s=float(d.get("pre_s", 1.0)), post_s=float(d.get("post_s", 1.5)),
                          gloc=gloc, ease_axes=ease_axes, ease_step=float(d.get("ease_step", 0.15)),
                          ease_min=float(d.get("ease_min", 0.25)), probe=float(d.get("probe", 0.0)),
                          reverse_axes=rev_axes, reverse_at=float(d.get("reverse_at", 0.6)),
                          reverse_delay_s=float(d.get("reverse_delay_s", 0.8)),
                          reverse_hold_s=float(d.get("reverse_hold_s", 4.0)), reverse_max=int(d.get("reverse_max", 4))))
    ids = [t.id for t in tests]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate test ids")
    return tests
