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

    @property
    def uses_boost(self) -> bool:
        return any(s.buttons.get("boost") for s in self.steps)

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
        tests.append(Test(d["id"], d.get("note", ""), steps, d.get("expect", {}),
                          float(d.get("pre_s", 1.0)), float(d.get("post_s", 1.5))))
    ids = [t.id for t in tests]
    if len(ids) != len(set(ids)):
        raise ValueError("duplicate test ids")
    return tests
