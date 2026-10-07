"""Focus guard + abort key. Polling (GetAsyncKeyState) needs no keyboard hook or admin rights."""
from __future__ import annotations
import sys

VK = {f"F{i}": 0x6F + i for i in range(1, 13)}
VK.update({"ESC": 0x1B, "PAUSE": 0x13, "END": 0x23})


class Abort(Exception):
    pass


class Guard:
    def __init__(self, title_contains: str, abort_key: str = "F12", enabled: bool = True):
        self.title = title_contains.lower()
        self.vk = VK[abort_key.upper()]
        self.enabled = enabled and sys.platform == "win32"
        if self.enabled:
            import win32api, win32gui  # pywin32
            self._api, self._gui = win32api, win32gui

    def focused(self) -> bool:
        if not self.enabled:
            return True
        return self.title in self._gui.GetWindowText(self._gui.GetForegroundWindow()).lower()

    def abort_pressed(self) -> bool:
        return self.enabled and bool(self._api.GetAsyncKeyState(self.vk) & 0x8000)

    def check(self):
        if self.abort_pressed():
            raise Abort("abort key pressed")
        if not self.focused():
            raise Abort("game window lost focus")
