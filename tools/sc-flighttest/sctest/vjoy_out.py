"""Thin, atomic vJoy writer. All axes in logical units [-1, 1]; buttons as bools."""
from __future__ import annotations

FIELDS = {"x": "wAxisX", "y": "wAxisY", "z": "wAxisZ",
          "rx": "wAxisXRot", "ry": "wAxisYRot", "rz": "wAxisZRot",
          "sl0": "wSlider", "sl1": "wDial"}
CENTER = 0x4000
SPAN = 0x3FFF  # 0x4000 +/- 0x3FFF stays inside vJoy's 0x0001..0x8000 range


def to_raw(v: float) -> int:
    v = max(-1.0, min(1.0, float(v)))
    return int(round(CENTER + v * SPAN))


class VJoy:
    def __init__(self, device_id: int, axis_map: dict, button_map: dict, dry_run: bool = False):
        self.axis_map, self.button_map, self.dry_run = axis_map, button_map, dry_run
        self.state = {k: 0.0 for k in axis_map}
        self.buttons = {k: False for k in button_map}
        self.dev = None
        if not dry_run:
            import pyvjoy  # needs vJoy installed + vJoyInterface.dll on PATH (pyvjoy ships one)
            self.dev = pyvjoy.VJoyDevice(device_id)
        self.center()

    def set(self, axes: dict | None = None, buttons: dict | None = None):
        for k, v in (axes or {}).items():
            if k not in self.axis_map:
                raise KeyError(f"unknown control '{k}' (known: {list(self.axis_map)})")
            self.state[k] = max(-1.0, min(1.0, float(v)))
        for k, v in (buttons or {}).items():
            if k not in self.button_map:
                raise KeyError(f"unknown button '{k}' (known: {list(self.button_map)})")
            self.buttons[k] = bool(v)
        self._flush()

    def center(self):
        self.state = {k: 0.0 for k in self.axis_map}
        self.buttons = {k: False for k in self.button_map}
        self._flush()

    def _flush(self):
        if self.dry_run:
            return
        d = self.dev.data
        for name, field in FIELDS.items():  # untouched axes rest at center
            setattr(d, field, CENTER)
        for ctrl, axis in self.axis_map.items():
            setattr(d, FIELDS[axis], to_raw(self.state[ctrl]))
        mask = 0
        for name, num in self.button_map.items():
            if self.buttons[name]:
                mask |= 1 << (int(num) - 1)
        d.lButtons = mask
        self.dev.update()

    def close(self):
        try:
            self.center()
        finally:
            self.dev = None
