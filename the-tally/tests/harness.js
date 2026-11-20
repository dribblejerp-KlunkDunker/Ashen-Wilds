// A tiny no-dependency runner, the repo's own pattern: one file per feature, run with
// `node tests/unit.js`. No browser, no framework.

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(condition, message) {
  if (!condition) throw new Error(message || 'assertion failed');
}

export function near(actual, expected, tolerance, message) {
  if (!(Math.abs(actual - expected) <= tolerance)) {
    throw new Error(`${message || 'not near'}: got ${actual}, expected ${expected} +/- ${tolerance}`);
  }
}

export function run() {
  let passed = 0;
  const failures = [];
  for (const t of tests) {
    try {
      t.fn();
      passed++;
      console.log(`  ok   ${t.name}`);
    } catch (err) {
      failures.push({ name: t.name, err });
      console.log(`  FAIL ${t.name}`);
      console.log(`       ${err.message}`);
    }
  }
  console.log(`\n${passed} passed, ${failures.length} failed, ${tests.length} total`);
  if (failures.length) {
    for (const f of failures) console.log(`\n${f.name}\n${f.err.stack}`);
    process.exitCode = 1;
  }
}
