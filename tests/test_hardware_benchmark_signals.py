"""Real POSIX signal tests for the benchmark launcher; no Godot needed."""
import json
import os
from pathlib import Path
import signal
import subprocess
import sys
import time
import unittest
import test_hardware_benchmark as base

@unittest.skipUnless(sys.platform.startswith('linux'), 'Linux process/signal assertions')
class SignalTests(unittest.TestCase):
    setUp = base.LauncherTests.setUp

    def start_engine(self, ignore_term=False):
        self.marker = self.base / 'ready'
        body = "import os, signal, sys, time\nfrom pathlib import Path\nif '--version' in sys.argv:\n print('FAKE-SIGNAL-ENGINE'); raise SystemExit(0)\n"
        if ignore_term:
            body += "signal.signal(signal.SIGTERM, signal.SIG_IGN)\n"
        body += "Path(" + repr(str(self.marker)) + ").write_text(str(os.getpid()))\ntime.sleep(60)\n"
        self.engine.write_text('#!' + sys.executable + '\n' + body, encoding='utf-8')
        self.engine.chmod(0o755)
        seconds = '1' if ignore_term else '30'
        command = [sys.executable, str(self.launcher), '--godot', str(self.engine), '--renderer', 'gl_compatibility', '--seconds', seconds]
        self.process = subprocess.Popen(command, cwd=self.base, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=True)
        self.addCleanup(self.cleanup_processes)
        deadline = time.monotonic() + 10
        while time.monotonic() < deadline:
            if self.marker.exists() and self.marker.read_text().strip():
                return
            if self.process.poll() is not None:
                self.fail('Launcher exited before fake engine readiness')
            time.sleep(0.02)
        self.fail('Fake engine readiness timed out')

    def cleanup_processes(self):
        if self.process.poll() is None:
            self.process.kill()
        self.process.communicate(timeout=5)
        if self.marker.exists():
            try:
                os.kill(int(self.marker.read_text()), signal.SIGKILL)
            except ProcessLookupError:
                pass

    def read_result(self):
        stdout, stderr = self.process.communicate(timeout=20)
        self.assertEqual(stderr, '')
        report = json.loads((Path(stdout.strip()) / 'run.json').read_text())
        self.assertIsNone(report['benchmark_pass'])
        self.assertEqual(report['launcher_exit_code'], self.process.returncode)
        with self.assertRaises(ProcessLookupError):
            os.kill(int(self.marker.read_text()), 0)
        return report

    def test_keyboard_interruption(self):
        self.start_engine()
        self.process.send_signal(signal.SIGINT)
        report = self.read_result()
        self.assertEqual(self.process.returncode, 130)
        self.assertEqual(report['outcome'], 'interrupted')
        self.assertEqual(report['returncode'], -signal.SIGTERM)
        self.assertFalse(report['terminated_at_time_limit'])

    def test_forced_kill_fallback(self):
        self.start_engine(ignore_term=True)
        report = self.read_result()
        self.assertEqual(self.process.returncode, 124)
        self.assertEqual(report['outcome'], 'time_limit_reached')
        self.assertEqual(report['returncode'], -signal.SIGKILL)
        self.assertTrue(report['terminated_at_time_limit'])

if __name__ == '__main__':
    unittest.main()
