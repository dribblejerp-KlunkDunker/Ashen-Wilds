"""Linux/macOS subprocess tests; no Godot installation required."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest

SOURCE = Path(__file__).resolve().parents[1] / 'tools' / 'hardware_benchmark.py'

@unittest.skipIf(os.name == 'nt', 'Fake executable uses a POSIX shebang')
class LauncherTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.root = self.base / 'project'
        (self.root / 'tools').mkdir(parents=True)
        self.launcher = self.root / 'tools' / SOURCE.name
        shutil.copyfile(SOURCE, self.launcher)
        self.engine = self.base / 'fake engine'
        self.engine.write_text('#!' + sys.executable + '\n' + '''import json, sys, time
if '--version' in sys.argv:
    print('FAKE-ENGINE-TEST')
    raise SystemExit(0)
print(json.dumps(sys.argv[1:]), flush=True)
print('stderr-marker', file=sys.stderr, flush=True)
if 'sleep-test' in sys.argv:
    time.sleep(60)
raise SystemExit(7 if 'fail-test' in sys.argv else 0)
''', encoding='utf-8')
        self.engine.chmod(0o755)

    def launch(self, extra=(), executable=None, renderer='gl_compatibility'):
        command = [sys.executable, str(self.launcher), '--godot', str(executable or self.engine), '--renderer', renderer, '--seconds', '1'] + list(extra)
        result = subprocess.run(command, cwd=self.base, capture_output=True, text=True, timeout=30)
        directory = Path(result.stdout.strip())
        report = json.loads((directory / 'run.json').read_text(encoding='utf-8'))
        self.assertEqual(report['launcher_exit_code'], result.returncode)
        self.assertIsNone(report['benchmark_pass'])
        self.assertFalse(report['fps_measured'])
        self.assertFalse(report['multiplayer_verified'])
        return result, report, directory

    def test_clean_exit_and_version(self):
        result, report, _ = self.launch()
        self.assertEqual(result.returncode, 0)
        self.assertEqual(report['outcome'], 'exited_cleanly')
        self.assertEqual(report['returncode'], 0)
        self.assertEqual(report['schema_version'], 2)
        self.assertEqual(report['engine_version_probe']['stdout'], 'FAKE-ENGINE-TEST')

    def test_engine_error(self):
        result, report, _ = self.launch(['--', 'fail-test'])
        self.assertEqual(result.returncode, 1)
        self.assertEqual(report['returncode'], 7)
        self.assertEqual(report['outcome'], 'exited_with_error')

    def test_time_limit_is_not_success(self):
        result, report, _ = self.launch(['--', 'sleep-test'])
        self.assertEqual(result.returncode, 124)
        self.assertEqual(report['outcome'], 'time_limit_reached')
        self.assertTrue(report['terminated_at_time_limit'])

    def test_missing_executable(self):
        result, report, _ = self.launch(executable=self.base / 'missing')
        self.assertEqual(result.returncode, 1)
        self.assertEqual(report['outcome'], 'launch_error')
        self.assertIn('launch_error', report)
        self.assertIn('error', report['engine_version_probe'])

    def test_relative_path_resolved_before_chdir(self):
        result, report, _ = self.launch(executable='./fake engine')
        self.assertEqual(result.returncode, 0)
        self.assertEqual(report['command'][0], str(self.engine.resolve()))

    def test_forwarding_renderer_and_combined_logs(self):
        forwarded = ['--client', '--host', '127.0.0.1', '--player-key', 'alice']
        result, report, directory = self.launch(['--scene', 'net_main.tscn', '--'] + forwarded, renderer='forward_plus')
        self.assertEqual(result.returncode, 0)
        self.assertEqual(report['command'][-len(forwarded):], forwarded)
        log = (directory / 'engine.log').read_text(encoding='utf-8')
        actual = json.loads(log.splitlines()[0])
        self.assertEqual(actual[-len(forwarded):], forwarded)
        self.assertEqual(actual[actual.index('--rendering-method') + 1], 'forward_plus')
        self.assertIn('net_main.tscn', actual)
        self.assertIn('stderr-marker', log)

    def test_invalid_duration(self):
        result = subprocess.run([sys.executable, str(self.launcher), '--godot', str(self.engine), '--renderer', 'gl_compatibility', '--seconds', '0'], capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 2)
        self.assertIn('--seconds must be positive', result.stderr)
        self.assertFalse((self.root / 'builds').exists())

if __name__ == '__main__':
    unittest.main()
