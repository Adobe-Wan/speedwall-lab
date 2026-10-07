"""Help Star Citizen's keybinding screen detect one vJoy axis/button at a time."""
from __future__ import annotations
import time
from .vjoy_out import VJoy


def wiggle(cfg: dict, control: str, direction: float = 1.0, delay: float = 4.0):
    vj = VJoy(cfg["vjoy_device"], cfg["axes"], cfg["buttons"])
    try:
        print(f"In SC: Options > Keybindings > Advanced Controls Customization, double-click the action for "
              f"'{control}', then wait. Moving vJoy in {delay:.0f} s...")
        time.sleep(delay)
        if control in cfg["buttons"]:
            vj.set(buttons={control: True}); time.sleep(0.6); vj.set(buttons={control: False})
        else:
            for k in range(31):           # sweep 0 -> full -> 0 over ~1.5 s
                v = direction * (1 - abs(k - 15) / 15)
                vj.set(axes={control: v}); time.sleep(0.05)
        print("Done. If SC bound the wrong axis or direction, rebind/invert in SC and re-run.")
    finally:
        vj.close()


def hold(cfg: dict, control: str, value: float, seconds: float):
    """Hold one input steady, e.g. to verify direction in flight."""
    vj = VJoy(cfg["vjoy_device"], cfg["axes"], cfg["buttons"])
    try:
        time.sleep(3)
        if control in cfg["buttons"]:
            vj.set(buttons={control: True})
        else:
            vj.set(axes={control: value})
        time.sleep(seconds)
    finally:
        vj.close()
