#!/usr/bin/env python3
"""Launch existing Godot scenes and record evidence, not a benchmark pass."""
import argparse
import datetime
import json
import os
from pathlib import Path
import platform
import shutil
import subprocess
import time

def probe(command, cwd):
    try:
        result = subprocess.run(command, cwd=cwd, capture_output=True, text=True, timeout=10)
        return {"returncode": result.returncode, "stdout": result.stdout.strip(), "stderr": result.stderr.strip()}
    except (OSError, subprocess.TimeoutExpired) as error:
        return {"error": str(error)}

def resolve_engine(value):
    expanded = os.path.expanduser(value)
    if Path(expanded).is_absolute() or "/" in expanded or "\\" in expanded:
        return str(Path(expanded).resolve())
    return shutil.which(expanded) or expanded

def stop(process):
    process.terminate()
    try:
        process.wait(timeout=10)
    except subprocess.TimeoutExpired:
        process.kill()
        process.wait()

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--godot', required=True)
    parser.add_argument('--renderer', choices=['gl_compatibility', 'forward_plus'], required=True)
    parser.add_argument('--scene', choices=['main.tscn', 'net_main.tscn'], default='main.tscn')
    parser.add_argument('--seconds', type=int, default=120)
    parser.add_argument('--label', default='manual')
    parser.add_argument('game_args', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    if args.seconds < 1:
        parser.error('--seconds must be positive')
    engine = resolve_engine(args.godot)
    root = Path(__file__).resolve().parents[1]
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S.%fZ')
    output = root / 'builds' / 'hardware-benchmark' / stamp
    output.mkdir(parents=True, exist_ok=False)
    forwarded = args.game_args[1:] if args.game_args[:1] == ['--'] else args.game_args
    command = [engine, '--path', str(root), '--rendering-method', args.renderer, '--resolution', '1280x720', '--windowed', args.scene]
    if forwarded:
        command += ['--'] + forwarded
    metadata = {
        'schema_version': 2, 'label': args.label, 'command': command,
        'platform': platform.platform(), 'requested_renderer': args.renderer,
        'requested_seconds': args.seconds, 'fps_measured': False,
        'multiplayer_verified': False, 'benchmark_pass': None,
        'engine_version_probe': probe([engine, '--version'], root),
        'source_revision_probe': probe(['git', 'rev-parse', 'HEAD'], root),
        'source_status_probe': probe(['git', 'status', '--porcelain', '--untracked-files=normal'], root),
        'outcome': 'launch_error', 'returncode': None,
        'terminated_at_time_limit': False
    }
    started = time.monotonic()
    exit_code = 1
    try:
        with (output / 'engine.log').open('w', encoding='utf-8') as log:
            process = subprocess.Popen(command, cwd=root, stdout=log, stderr=subprocess.STDOUT)
            try:
                process.wait(timeout=args.seconds)
                metadata['outcome'] = 'exited_cleanly' if process.returncode == 0 else 'exited_with_error'
                exit_code = 0 if process.returncode == 0 else 1
            except subprocess.TimeoutExpired:
                metadata['terminated_at_time_limit'] = True
                metadata['outcome'] = 'time_limit_reached'
                stop(process)
                exit_code = 124
            except KeyboardInterrupt:
                metadata['outcome'] = 'interrupted'
                stop(process)
                exit_code = 130
            metadata['returncode'] = process.returncode
    except OSError as error:
        metadata['launch_error'] = str(error)
    finally:
        metadata['elapsed_seconds'] = round(time.monotonic() - started, 3)
        metadata['launcher_exit_code'] = exit_code
        (output / 'run.json').write_text(json.dumps(metadata, indent=2) + '\n', encoding='utf-8')
        print(output)
    return exit_code

if __name__ == '__main__':
    raise SystemExit(main())
