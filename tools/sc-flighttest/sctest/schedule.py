"""Test definitions: a test is a list of timed steps holding exact inputs."""
from __future__ import annotations
from dataclasses import dataclass, field

BUTTONS = ("boost", "brake")


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
    # What to do when the pilot greys out. "release": drop every input and end the test (safe default).
    # "ease": scale the ease_axes down by ease_step each time the HUD dims, and keep flying, the way a pilot
    # manages G-LOC; the level that stops the dimming is the sustainable one. Below ease_min, release.
    gloc: str = "release"
    ease_axes: tuple = ("strafe_lat", "strafe_long", "strafe_vert", "roll")
    ease_step: float = 0.15
    ease_min: float = 0.25

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
        return Test(self.id, self.note, steps, self.expect, self.pre_s, self.post_s,
                    self.gloc, self.ease_axes, self.ease_step, self.ease_min)

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
        if gloc not in ("release", "ease"):
            raise ValueError(f"test {d['id']}: gloc must be 'release' or 'ease'")
        ease_axes = tuple(d.get("ease_axes", Test.ease_axes))
        unknown = set(ease_axes) - set(known_axes)
        if unknown:
            raise ValueError(f"test {d['id']}: unknown ease_axes {sorted(unknown)}")
        tests.append(Test(d["id"], d.get("note", ""), steps, d.get("expect", {}),
                          float(d.get("pre_s", 1.0)), float(d.get("post_s", 1.5)),
                          gloc, ease_axes, float(d.get("ease_step", 0.15)), float(d.get("ease_min", 0.25))))
    ids = [t.id for t in tests]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate test ids")
    return tests
