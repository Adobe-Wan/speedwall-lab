#!/usr/bin/env python3
"""sc-flighttest: repeatable Star Citizen flight tests with exact vJoy inputs and HUD capture.

  python run.py bind <control>            help SC's binding screen detect one vJoy axis/button
  python run.py hold <control> <value> <s>   hold one input (direction check)
  python run.py dircheck                  push every axis in turn and say what the ship should do
  python run.py camcheck                  does the vJoy view button switch the camera? (G-LOC probe setup)
  python run.py camstrip <session> <test> contact sheet of the probe frames, to check the detection by eye
  python run.py calibrate [--monitor N]   drag boxes over the HUD readouts
  python run.py ocrcheck                  print live HUD readings (verify calibration)
  python run.py fpscheck                  measure capture speed (needs >= 30 fps)
  python run.py list                      list tests in tests.yaml
  python run.py run [ids...] [--tests FILE] [--dry-run]  run tests (all if none given) -> results/<session>/
  python run.py process <session>         OCR + roll-track recorded frames -> series.csv
  python run.py analyze <session>         per-test summary -> summary.csv
  python run.py campaign [--rounds 6 7 5 4]   every outstanding round in ONE session, then process + analyze + pack
  python run.py pack <session>            zip the results (no frames) to send back: results/<session>-data.zip
"""
from __future__ import annotations
import argparse, sys, time
from pathlib import Path
import yaml

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

# Outstanding rounds, in the order worth flying them (docs/flight-model-tests.md).
CAMPAIGN = {"6": "tests_round6.yaml", "7": "tests_round7.yaml", "8": "tests_round8.yaml", "9": "tests_round9.yaml",
            "5": "tests_round5.yaml", "4": "tests_round4.yaml"}


def cfg():
    return yaml.safe_load((ROOT / "config.yaml").read_text())


def tests(c, path="tests.yaml"):
    from sctest.schedule import parse
    return parse(yaml.safe_load((ROOT / path).read_text()), c["axes"])


def campaign(c, args):
    """All the chosen rounds as one list (so the flip between tests carries across rounds), then process,
    analyze and pack. One command, one results folder."""
    from sctest.runner import run_tests
    from sctest.process import process_dir
    from sctest.analyze import summarize_session
    ts = []
    for r in args.rounds:
        ts += tests(c, CAMPAIGN[r])
    ids = [t.id for t in ts]
    if len(ids) != len(set(ids)):
        sys.exit("duplicate test ids across rounds")
    session = ROOT / "results" / (args.resume or time.strftime("%Y%m%d-%H%M%S"))
    if args.resume:
        if not session.is_dir():
            sys.exit(f"no such session folder: {session}")
        done = {x.name for x in session.iterdir() if (x / "frames.npz").exists()}
        ts = [t for t in ts if t.id not in done]
        print(f"Resuming {session.name}: {len(done)} tests already recorded, {len(ts)} left.")
        if not ts:
            sys.exit("nothing left to run")
    flying = sum(t.duration for t in ts)
    between = len(ts) * 35                                       # braking from speed, the flip, the boost refill: a rough allowance
    print(f"Rounds {', '.join(args.rounds)}: {len(ts)} tests, about {(flying + between) / 60:.0f} minutes (more if you grey out: "
          f"each let-go waits for your vision to come back).")
    print("Before you continue: Arena Commander free flight (never the PU, never PvP), Gladius, DECOUPLED, SCM, open space,")
    print("G-safe OFF, nothing ahead of you, you at the keyboard. F12 releases everything and stops.")
    if not (args.yes or args.dry_run):
        input("Press Enter when ready... ")
    run_tests(ts, c, session, dry_run=args.dry_run)
    if args.dry_run:
        return
    for d in sorted(x for x in session.iterdir() if (x / "frames.npz").exists()):
        process_dir(d, 1)
    out = summarize_session(session)
    print(f"Summary: {out}")
    print(f"Packed:  {pack(session, False)}\nSend that zip back (or commit it under research/raw/).")


def pack(session: Path, with_frames: bool) -> Path:
    import zipfile
    zp = session.parent / f"{session.name}-data.zip"
    with zipfile.ZipFile(zp, "w", zipfile.ZIP_DEFLATED) as z:
        for f in sorted(session.rglob("*")):
            if f.is_file() and (with_frames or f.name != "frames.npz"):
                z.write(f, f"{session.name}/{f.relative_to(session)}")
        z.write(ROOT / "config.yaml", f"{session.name}/config.yaml")     # the settings this ran with
    return zp


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = ap.add_subparsers(dest="cmd", required=True)
    b = sub.add_parser("bind"); b.add_argument("control"); b.add_argument("--negative", action="store_true")
    h = sub.add_parser("hold"); h.add_argument("control"); h.add_argument("value", type=float); h.add_argument("seconds", type=float)
    sub.add_parser("dircheck")
    sub.add_parser("camcheck")
    sub.add_parser("throttlecheck")
    cs = sub.add_parser("camstrip"); cs.add_argument("session"); cs.add_argument("test")
    ca = sub.add_parser("calibrate"); ca.add_argument("--monitor", type=int)
    sub.add_parser("ocrcheck")
    sub.add_parser("fpscheck")
    li = sub.add_parser("list"); li.add_argument("--tests", default="tests.yaml")
    r = sub.add_parser("run"); r.add_argument("ids", nargs="*"); r.add_argument("--dry-run", action="store_true")
    r.add_argument("--tests", default="tests.yaml", help="test file, e.g. tests_round2.yaml")
    p = sub.add_parser("process"); p.add_argument("session"); p.add_argument("--stride", type=int, default=1)
    a = sub.add_parser("analyze"); a.add_argument("session")
    cp = sub.add_parser("campaign")
    cp.add_argument("--rounds", nargs="+", default=list(CAMPAIGN), choices=list(CAMPAIGN), help="default: 6 7 8 9 5 4")
    cp.add_argument("--resume", metavar="SESSION", help="continue a session: skip the tests it already has and save new ones into it")
    cp.add_argument("--yes", action="store_true", help="don't wait for Enter before starting")
    cp.add_argument("--dry-run", action="store_true")
    pk = sub.add_parser("pack"); pk.add_argument("session"); pk.add_argument("--with-frames", action="store_true")
    args = ap.parse_args()
    c = cfg()

    if args.cmd == "bind":
        from sctest.bind import wiggle
        wiggle(c, args.control, -1.0 if args.negative else 1.0)
    elif args.cmd == "hold":
        from sctest.bind import hold
        hold(c, args.control, args.value, args.seconds)
    elif args.cmd == "throttlecheck":
        from sctest.throttlecheck import throttlecheck
        throttlecheck(c)
    elif args.cmd == "camcheck":
        from sctest.camcheck import camcheck
        camcheck(c)
    elif args.cmd == "camstrip":
        from sctest.camcheck import camstrip
        camstrip(ROOT / "results" / args.session, args.test)
    elif args.cmd == "dircheck":
        from sctest.bind import dircheck
        dircheck(c)
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
    elif args.cmd == "campaign":
        campaign(c, args)
    elif args.cmd == "pack":
        print(f"Wrote {pack(ROOT / 'results' / args.session, args.with_frames)}")
    elif args.cmd == "analyze":
        from sctest.analyze import summarize_session
        out = summarize_session(ROOT / "results" / args.session)
        print(out.read_text())


if __name__ == "__main__":
    main()
