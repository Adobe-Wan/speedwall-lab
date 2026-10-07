#!/usr/bin/env python3
"""sc-flighttest: repeatable Star Citizen flight tests with exact vJoy inputs and HUD capture.

  python run.py bind <control>            help SC's binding screen detect one vJoy axis/button
  python run.py hold <control> <value> <s>   hold one input (direction check)
  python run.py calibrate [--monitor N]   drag boxes over the HUD readouts
  python run.py ocrcheck                  print live HUD readings (verify calibration)
  python run.py fpscheck                  measure capture speed (needs >= 30 fps)
  python run.py list                      list tests in tests.yaml
  python run.py run [ids...] [--tests FILE] [--dry-run]  run tests (all if none given) -> results/<session>/
  python run.py process <session>         OCR + roll-track recorded frames -> series.csv
  python run.py analyze <session>         per-test summary -> summary.csv
"""
from __future__ import annotations
import argparse, sys, time
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))


def cfg():
    return yaml.safe_load((ROOT / "config.yaml").read_text())


def tests(c, path="tests.yaml"):
    from sctest.schedule import parse
    return parse(yaml.safe_load((ROOT / path).read_text()), c["axes"])


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("bind"); b.add_argument("control"); b.add_argument("--negative", action="store_true")
    h = sub.add_parser("hold"); h.add_argument("control"); h.add_argument("value", type=float); h.add_argument("seconds", type=float)
    ca = sub.add_parser("calibrate"); ca.add_argument("--monitor", type=int)
    sub.add_parser("ocrcheck")
    sub.add_parser("fpscheck")
    li = sub.add_parser("list"); li.add_argument("--tests", default="tests.yaml")
    r = sub.add_parser("run"); r.add_argument("ids", nargs="*"); r.add_argument("--dry-run", action="store_true")
    r.add_argument("--tests", default="tests.yaml", help="test file, e.g. tests_round2.yaml")
    p = sub.add_parser("process"); p.add_argument("session"); p.add_argument("--stride", type=int, default=1)
    a = sub.add_parser("analyze"); a.add_argument("session")
    args = ap.parse_args()
    c = cfg()

    if args.cmd == "bind":
        from sctest.bind import wiggle
        wiggle(c, args.control, -1.0 if args.negative else 1.0)
    elif args.cmd == "hold":
        from sctest.bind import hold
        hold(c, args.control, args.value, args.seconds)
    elif args.cmd == "calibrate":
        from sctest.calibrate import calibrate
        calibrate(ROOT / "config.yaml", args.monitor)
    elif args.cmd == "ocrcheck":
        from sctest.calibrate import ocrcheck
        ocrcheck(c)
    elif args.cmd == "fpscheck":
        from sctest.calibrate import fpscheck
        fpscheck(c)
    elif args.cmd == "list":
        for t in tests(c, args.tests):
            print(f"{t.id:28} {t.duration:5.1f}s  {'BOOST ' if t.uses_boost else '      '}{t.note}")
    elif args.cmd == "run":
        from sctest.runner import run_tests
        ts = tests(c, args.tests)
        if args.ids:
            want = set(args.ids)
            ts = [t for t in ts if t.id in want]
            missing = want - {t.id for t in ts}
            if missing:
                sys.exit(f"unknown test ids: {sorted(missing)}")
        session = ROOT / "results" / time.strftime("%Y%m%d-%H%M%S")
        run_tests(ts, c, session, dry_run=args.dry_run)
        print(f"Saved to {session}\nNext: python run.py process {session.name}")
    elif args.cmd == "process":
        from sctest.process import process_dir
        s = ROOT / "results" / args.session
        for d in sorted(x for x in s.iterdir() if (x / "frames.npz").exists()):
            process_dir(d, args.stride)
        print(f"Next: python run.py analyze {args.session}")
    elif args.cmd == "analyze":
        from sctest.analyze import summarize_session
        out = summarize_session(ROOT / "results" / args.session)
        print(out.read_text())


if __name__ == "__main__":
    main()
