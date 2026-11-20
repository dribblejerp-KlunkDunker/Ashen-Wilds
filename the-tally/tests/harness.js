// A test harness with no dependencies: `node tests/unit.js`. The design is the specification,
// so every number in these tests is a number from a design section, quoted where it is used.

const tests = [];

export function test(name, fn) {
  tests.push({ name, fn });
}

export function assert(cond, message) {
  if (!cond) throw new Error(message || 'assertion failed');
}

export function near(got, want, tol, label) {
  assert(Math.abs(got - want) <= tol, `${label}: got ${got}, expected ${want} +/- ${tol}`);
}

export async function run() {
  let passed = 0;
  const failed = [];
  for (const t of tests) {
    try {
      await t.fn();
      passed++;
      console.log(`  ok   ${t.name}`);
    } catch (err) {
      failed.push({ name: t.name, err });
      console.log(`  FAIL ${t.name}`);
    }
  }
  if (failed.length) {
    console.log('');
    for (const f of failed) {
      console.log(`${f.name}`);
      console.log(`      ${f.err.message}`);
    }
  }
  console.log('');
  console.log(`${passed} passed, ${failed.length} failed, ${tests.length} total`);
  return failed.length === 0;
}
