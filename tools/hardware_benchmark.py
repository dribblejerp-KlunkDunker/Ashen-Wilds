#!/usr/bin/env python3
"""Launch an existing scene without modifying project settings."""
import argparse
import datetime
import json
from pathlib import Path
import platform
import subprocess
import time

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--godot', required=True, help='Path to the pinned Godot executable')
    parser.add_argument('--renderer', choices=['gl_compatibility', 'forward_plus'], required=True)
    parser.add_argument('--scene', choices=['main.tscn', 'net_main.tscn'], default='main.tscn')
    parser.add_argument('--seconds', type=int, default=120)
    parser.add_argument('--label', default='manual')
    parser.add_argument('game_args', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.seconds < 1:
        parser.error('--seconds must be positive')
    root = Path(__file__).resolve().parents[1]
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    output = root / 'builds' / 'hardware-benchmark' / stamp
    output.mkdir(parents=True, exist_ok=False)
    game_args = args.game_args
    if game_args[:1] == ['--']:
        game_args = game_args[1:]
    command = [args.godot, '--path', str(root), '--rendering-method', args.renderer, '--resolution', '1280x720', '--windowed', args.scene]
    if game_args:
        command += ['--'] + game_args
    metadata = {'label': args.label, 'command': command, 'platform': platform.platform(), 'requested_renderer': args.renderer, 'requested_seconds': args.seconds, 'fps_measured': False, 'multiplayer_verified': False}
    started = time.monotonic()
    timed_out = False
    try:
        with (output / 'engine.log').open('w', encoding='utf-8') as log:
            process = subprocess.Popen(command, cwd=root, stdout=log, stderr=subprocess.STDOUT)
            try:
                process.wait(timeout=args.seconds)
            except subprocess.TimeoutExpired:
                timed_out = True
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
            except KeyboardInterrupt:
                process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
                metadata['interrupted'] = True
        metadata['returncode'] = process.returncode
    except OSError as error:
        metadata['launch_error'] = str(error)
    finally:
        metadata['elapsed_seconds'] = round(time.monotonic() - started, 3)
        metadata['terminated_at_time_limit'] = timed_out
        (output / 'run.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
        print(output)
    return 1 if 'launch_error' in metadata or (metadata.get('returncode', 0) != 0 and not timed_out and not metadata.get('interrupted')) else 0

if __name__ == '__main__':
    raise SystemExit(main())
