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


# control, deflection, seconds, what the ship should do for a POSITIVE deflection (config.yaml: + = ...)
DIRCHECK = [
    ("strafe_long", 0.5, 1.2, "move FORWARD"), ("strafe_lat", 0.5, 1.2, "move to the RIGHT"),
    ("strafe_vert", 0.5, 1.2, "move UP"), ("pitch", 0.3, 1.5, "pitch the nose UP"),
    ("yaw", 0.3, 1.5, "yaw the nose to the RIGHT"), ("roll", 0.3, 1.5, "roll RIGHT (clockwise from behind)"),
]


def dircheck(cfg: dict):
    """Push every axis the way the tests do, one at a time, and say what the ship must do. In Arena Commander,
    decoupled, SCM, ship stopped. A strafe is followed by the spacebrake. Ctrl+C releases everything."""
    vj = VJoy(cfg["vjoy_device"], cfg["axes"], cfg["buttons"])
    try:
        print("Direction check. Free flight, decoupled, SCM, ship stopped, window focused. Starting in 5 s; Ctrl+C stops.")
        time.sleep(5)
        for name, v, secs, what in DIRCHECK:
            if name not in cfg["axes"]:
                continue
            print(f"  {name} +{v}: the ship should {what}")
            vj.set(axes={name: v}); time.sleep(secs); vj.center()
            if name.startswith("strafe"):
                vj.set(buttons={"brake": True}); time.sleep(4.0); vj.set(buttons={"brake": False})
            time.sleep(2.0)
        print("  boost: the AB bar should drain for 2 s")
        vj.set(buttons={"boost": True}); time.sleep(2.0); vj.set(buttons={"boost": False}); time.sleep(1.0)
        print("  brake: you are stopped, so the speed stays 0; press it while moving to see it bite")
        vj.set(buttons={"brake": True}); time.sleep(1.0)
        print("Any that went the wrong way: invert that axis in Star Citizen (Keybindings > Advanced Controls Customization > "
              "the vJoy device > Invert). Don't change config.yaml: the tests assume + = forward, right, up, nose up, yaw right, roll right.")
    finally:
        vj.close()
